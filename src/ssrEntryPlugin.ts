import path from 'node:path';
import type { Rspack } from '@rsbuild/core';
import { rspack } from '@rsbuild/core';

const { RSC_LAYERS_NAMES } = rspack.experiments;

export class SsrEntryPlugin {
  #ssrEntries: string[];

  constructor(ssrEntries: string | string[]) {
    this.#ssrEntries = Array.isArray(ssrEntries) ? ssrEntries : [ssrEntries];
  }

  apply(compiler: Rspack.Compiler): void {
    const normalResolver = compiler.resolverFactory.get('normal');

    const exclude: string[] = [];
    for (const ssrEntry of this.#ssrEntries) {
      const entryPath = path.isAbsolute(ssrEntry)
        ? ssrEntry
        : normalResolver.resolveSync({}, compiler.context, ssrEntry);

      if (!entryPath) {
        throw new Error(
          `Can't resolve '${ssrEntry}' in '${compiler.context}'`,
        );
      }

      exclude.push(entryPath);

      compiler.options.module.rules.push({
        resource: entryPath,
        layer: RSC_LAYERS_NAMES.SERVER_SIDE_RENDERING,
      });
    }

    compiler.options.module.rules.push({
      issuerLayer: RSC_LAYERS_NAMES.REACT_SERVER_COMPONENTS,
      exclude,
      resolve: {
        conditionNames: ['react-server', '...'],
      },
    });
  }
}
