import type { RsbuildConfig, RsbuildEntry, RsbuildPlugin, SourceConfig } from '@rsbuild/core';
import { rspack } from '@rsbuild/core';
import { SsrEntryPlugin } from './ssrEntryPlugin.js';
import type { PluginRSCOptions } from './types.js';

export const PLUGIN_RSC_NAME = 'rsbuild:rsc';

const { createRscPlugins, RSC_LAYERS_NAMES } = rspack.experiments;

const ENVIRONMENT_NAMES = {
  SERVER: 'server',
  CLIENT: 'client',
};

function normalizeEntry(entry: string | string[] | RsbuildEntry, layer?: string): RsbuildEntry {
  if (typeof entry === "string" || Array.isArray(entry)) {
    return {
      index: {
        import: entry,
        layer,
      },
    };
  }
  return entry;
}

function normalizeServerEntry(entry: string | string[] | RsbuildEntry): RsbuildEntry {
  const normalized = normalizeEntry(entry, RSC_LAYERS_NAMES.REACT_SERVER_COMPONENTS);
  for (const key in normalized) {
    const item = normalized[key];
    if (typeof item === "string" || Array.isArray(item)) {
      normalized[key] = {
        import: item,
        layer: RSC_LAYERS_NAMES.REACT_SERVER_COMPONENTS,
      };
    } else {
      item.layer = RSC_LAYERS_NAMES.REACT_SERVER_COMPONENTS;
    }
  }
  return normalized;
}

export const pluginRSC = (
  pluginOptions: PluginRSCOptions = {},
): RsbuildPlugin => ({
  name: PLUGIN_RSC_NAME,

  setup(api) {
    const entries = pluginOptions.entries || {};

    api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
      const serverSource: SourceConfig | undefined = entries.rsc
        ? {
          entry: normalizeServerEntry(entries.rsc),
        }
        : undefined;

      const clientSource: SourceConfig | undefined = entries.client
        ? {
          entry: normalizeEntry(entries.client),
        }
        : undefined;

      const rscEnvironmentsConfig: RsbuildConfig = {
        tools: {
          swc: {
            rspackExperiments: {
              reactServerComponents: true,
            },
          },
        },
        environments: {
          server: {
            source: serverSource,
            output: {
              target: 'node',
            },
          },
          client: {
            source: clientSource,
            output: {
              target: 'web',
            },
          },
        },
      };
      return mergeRsbuildConfig(config, rscEnvironmentsConfig);
    });

    let rscPlugins: ReturnType<typeof createRscPlugins>;

    api.modifyBundlerChain(async (chain, { environment }) => {
      // The RSC plugin is currently incompatible with lazyCompilation; this feature has been forcibly disabled.
      chain.lazyCompilation(false);

      if (!rscPlugins) {
        rscPlugins = createRscPlugins();
      }

      if (environment.name === ENVIRONMENT_NAMES.SERVER) {
        if (entries.ssr) {
          chain
            .plugin('rsc-ssr-entry')
            .use(SsrEntryPlugin, [entries.ssr]);
        } else {
          // If entries.ssr exists, SsrEntryPlugin will handle the addition, so no need to add it again.
          chain.module
            .rule('rsc-resolve')
            .issuerLayer(RSC_LAYERS_NAMES.REACT_SERVER_COMPONENTS)
            .resolve.conditionNames.add('react-server')
            .add('...');
        }
        chain.plugin('rsc-server').use(rscPlugins.ServerPlugin);
      }
      if (environment.name === ENVIRONMENT_NAMES.CLIENT) {
        chain.plugin('rsc-client').use(rscPlugins.ClientPlugin);
      }
    });
  },
});
