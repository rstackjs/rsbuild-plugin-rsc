import type { RsbuildConfig, RsbuildPlugin } from '@rsbuild/core';
import { rspack } from '@rsbuild/core';
import type { PluginRSCOptions } from './types.js';

export const PLUGIN_RSC_NAME = 'rsbuild:rsc';

const { createRscPlugins } = rspack.experiments;

export const RSC_LAYERS_NAMES: typeof rspack.experiments.RSC_LAYERS_NAMES = rspack.experiments.RSC_LAYERS_NAMES;

const ENVIRONMENT_NAMES = {
  SERVER: 'server',
  CLIENT: 'client',
};

export const pluginRSC = (
  pluginOptions: PluginRSCOptions = {},
): RsbuildPlugin => ({
  name: PLUGIN_RSC_NAME,

  setup(api) {
    api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
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
            output: {
              target: 'node',
            },
          },
          client: {
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
        const { rsc, ssr } = pluginOptions.layers || {};

        if (ssr) {
          chain.module
            .rule('ssr-entry')
            .test(ssr)
            .layer(RSC_LAYERS_NAMES.SERVER_SIDE_RENDERING);
        }
        if (rsc) {
          chain.module
            .rule('rsc-entry')
            .test(rsc)
            .layer(RSC_LAYERS_NAMES.REACT_SERVER_COMPONENTS);
        }

        let rule = chain.module.rule('rsc-resolve');
        if (ssr) {
          rule = rule.exclude.add(ssr).end();
        }
        rule
          .issuerLayer([
            RSC_LAYERS_NAMES.REACT_SERVER_COMPONENTS,
            RSC_LAYERS_NAMES.ACTION_BROWSER,
          ])
          .resolve.conditionNames.add("react-server")
          .add("...");

        chain.plugin('rsc-server').use(rscPlugins.ServerPlugin);
      }
      if (environment.name === ENVIRONMENT_NAMES.CLIENT) {
        chain.plugin('rsc-client').use(rscPlugins.ClientPlugin);
      }
    });
  },
});
