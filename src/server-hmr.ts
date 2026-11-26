import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as vm from 'node:vm';
import { type RsbuildDevServer, type Rspack, rspack } from '@rsbuild/core';

type HotEntry = {
  hash(): string;
  publicPath(): string;
  check(): Promise<unknown>;
  exports(): unknown;
};

const PLUGIN_NAME = 'rsbuild-plugin-rsc:server-hmr';

// Compare the manifest emitted by Rspack for each entry. A changed reference
// graph can move Flight factories between chunks and requires a fresh renderer.
const manifests = new WeakMap<Rspack.Compilation, Map<string, string>>();

class ServerHotRuntime extends rspack.RuntimeModule {
  constructor(private readonly entryId: string | number) {
    super('RSC server hot entry', rspack.RuntimeModule.STAGE_TRIGGER);
  }

  override generate(): string {
    const {
      require: req,
      interceptModuleExecution,
      getFullHash,
      publicPath,
    } = rspack.RuntimeGlobals;
    const id = JSON.stringify(this.entryId);
    // The isolated module runner supplies the registration function. Other
    // consumers of the dev output can still execute it as a normal bundle.
    return `if (import.meta.rscHotEntry) {
      ${interceptModuleExecution}.push(function (options) {
        if (options.id !== ${id}) return;
        var hot = options.module.hot;
        hot.accept();
        import.meta.rscHotEntry({
          hash: () => ${getFullHash}(),
          publicPath: () => ${publicPath},
          check: () => hot.check(true),
          exports: () => ${req}(${id})
        });
      });
    }`;
  }
}

export class ServerHotPlugin {
  apply(compiler: Rspack.Compiler): void {
    if (
      !compiler.options.plugins.some(
        (plugin) => plugin instanceof rspack.HotModuleReplacementPlugin,
      )
    ) {
      new rspack.HotModuleReplacementPlugin().apply(compiler);
    }
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      const byEntry = new Map<string, string>();
      manifests.set(compilation, byEntry);
      compilation.hooks.runtimeModule.tap(PLUGIN_NAME, (mod, chunk) => {
        if (mod.name === 'rsc_manifest' && chunk.name && mod.source) {
          byEntry.set(chunk.name, mod.source.source.toString());
        }
      });
      compilation.hooks.additionalTreeRuntimeRequirements.tap(
        PLUGIN_NAME,
        (chunk, requirements) => {
          if (!chunk.hasRuntime()) return;
          const entries = [
            ...compilation.chunkGraph.getChunkEntryModulesIterable(chunk),
          ];
          const entry = entries.at(-1);
          if (!entry) return;
          const id = compilation.chunkGraph.getModuleId(entry);
          if (id == null) return;
          requirements.add(rspack.RuntimeGlobals.getFullHash);
          requirements.add(rspack.RuntimeGlobals.publicPath);
          requirements.add(rspack.RuntimeGlobals.require);
          requirements.add(rspack.RuntimeGlobals.interceptModuleExecution);
          compilation.addRuntimeModule(chunk, new ServerHotRuntime(id));
        },
      );
    });
  }
}

// Keep ESM identities within a compilation. On the next compilation, lazy
// chunks with unchanged filenames must resolve against the new output FS.
class ServerModuleRunner {
  hot?: HotEntry;
  private modules = new Map<string, Promise<vm.Module>>();
  private evaluations = new WeakMap<vm.Module, Promise<void>>();
  private assets = new Set<string>();
  private compiler: Rspack.Compiler;

  constructor(compilation: Rspack.Compilation) {
    this.compiler = compilation.compiler;
    this.update(compilation);
  }

  update(compilation: Rspack.Compilation): void {
    this.assets = new Set(compilation.getAssets().map(({ name }) => name));
    this.modules.clear();
  }

  private async link(specifier: string, parent: vm.Module): Promise<vm.Module> {
    // Rspack imports hot updates using the runtime public path, which may be
    // an absolute URL. Read emitted files from the server compiler's output FS.
    const prefix = this.hot?.publicPath();
    if (prefix !== undefined && specifier.startsWith(prefix)) {
      const name = specifier.slice(prefix.length);
      if (this.assets.has(name)) return this.asset(name);
    }
    if (
      specifier.startsWith('.') ||
      path.isAbsolute(specifier) ||
      specifier.startsWith('file:')
    ) {
      const filename = fileURLToPath(new URL(specifier, parent.identifier));
      const name = path
        .relative(this.compiler.outputPath, filename)
        .split(path.sep)
        .join('/');
      if (this.assets.has(name)) return this.asset(name);
    }

    // Match Rsbuild's loadBundle interop for external CommonJS and ESM modules.
    const require = createRequire(parent.identifier);
    const value = require(
      specifier.startsWith('file:') ? fileURLToPath(specifier) : specifier,
    );
    const keys = new Set(['default', ...Object.keys(value ?? {})]);
    return new vm.SyntheticModule([...keys], function () {
      for (const key of keys) {
        const useValue =
          key === 'default' &&
          !(value?.[Symbol.toStringTag] === 'Module' && 'default' in value);
        this.setExport(key, useValue ? value : value[key]);
      }
    });
  }

  private async evaluate(mod: vm.Module): Promise<void> {
    let evaluation = this.evaluations.get(mod);
    if (!evaluation) {
      evaluation = (async () => {
        if (mod.status === 'unlinked') {
          await mod.link((id, parent) => this.link(id, parent));
        }
        await mod.evaluate();
      })();
      this.evaluations.set(mod, evaluation);
    }
    await evaluation;
  }

  private asset(name: string): Promise<vm.Module> {
    let loading = this.modules.get(name);
    if (!loading) {
      loading = this.readAsset(name);
      this.modules.set(name, loading);
    }
    return loading;
  }

  private async readAsset(name: string): Promise<vm.Module> {
    const filename = path.join(this.compiler.outputPath, name);
    const url = pathToFileURL(filename).href;
    const source = await new Promise<string>((resolve, reject) => {
      this.compiler.outputFileSystem!.readFile(filename, (error, bytes) => {
        if (error || bytes == null)
          reject(error ?? new Error(`Missing RSC asset: ${name}`));
        else resolve(bytes.toString());
      });
    });
    return new vm.SourceTextModule(source, {
      identifier: url,
      initializeImportMeta: (meta) => {
        meta.url = url;
        Object.assign(meta, {
          rscHotEntry: (entry: HotEntry) => {
            this.hot = entry;
          },
        });
      },
      importModuleDynamically: async (id, parent) => {
        const child = await this.link(id, parent);
        await this.evaluate(child);
        return child;
      },
    });
  }

  async start(filename: string): Promise<unknown> {
    const mod = await this.asset(filename);
    await this.evaluate(mod);
    const ns = mod.namespace as { default?: unknown };
    return ns.default instanceof Promise ? ns.default : ns;
  }
}

class ServerEntry {
  stats?: Rspack.Stats;
  pending?: Promise<unknown>;
  private runner?: ServerModuleRunner;
  private manifest?: string;

  async load(
    stats: Rspack.Stats,
    name: string,
    file: string,
    warn: (message: string) => void,
  ) {
    const compilation = stats.compilation;
    const manifest = manifests.get(compilation)?.get(name);
    const runner = this.runner;
    if (runner?.hot && manifest === this.manifest) {
      runner.update(compilation);
      try {
        if (runner.hot.hash() !== stats.hash) await runner.hot.check();
        if (runner.hot.hash() === stats.hash) {
          const ns = (await runner.hot.exports()) as { default?: unknown };
          return ns?.default instanceof Promise ? ns.default : ns;
        }
      } catch (error) {
        warn(
          `[rsbuild:rsc] Reloading server entry "${name}" after hot update: ${error}`,
        );
      }
    }

    this.runner = undefined;
    const fresh = new ServerModuleRunner(compilation);
    const result = await fresh.start(file);
    this.runner = fresh;
    this.manifest = manifest;
    return result;
  }
}

export function enableServerHmr(
  environment: RsbuildDevServer['environments'][string],
  warn: (message: string) => void,
): void {
  const load = environment.loadBundle.bind(environment);
  const entries = new Map<string, ServerEntry>();
  environment.loadBundle = async <T>(name: string): Promise<T> => {
    const stats = await environment.getStats();
    const state = entries.get(name) ?? new ServerEntry();
    if (state.stats === stats) return state.pending as Promise<T>;
    const compilation = stats.compilation;
    if (!vm.SourceTextModule || !manifests.has(compilation))
      return load<T>(name);
    if (stats.hasErrors())
      throw new Error(stats.toString({ all: false, errors: true }));

    const entry = compilation.entrypoints.get(name);
    if (!entry || entry.getRuntimeChunk().id !== entry.getEntrypointChunk().id)
      return load<T>(name);
    const files = [...entry.getEntrypointChunk().files].filter(
      (file) =>
        /\.m?js$/.test(file) &&
        !compilation.getAsset(file)?.info.hotModuleReplacement,
    );
    if (files.length !== 1) return load<T>(name);

    // Coalesce concurrent requests and finish each update before starting the next.
    const next = () => state.load(stats, name, files[0], warn);
    const pending = state.pending ? state.pending.then(next, next) : next();
    state.stats = stats;
    state.pending = pending;
    entries.set(name, state);
    pending.catch(() => {
      if (state.pending === pending) entries.delete(name);
    });
    return pending as Promise<T>;
  };
}
