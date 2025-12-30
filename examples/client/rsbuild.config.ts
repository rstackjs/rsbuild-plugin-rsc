import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginRSC, RSC_LAYERS_NAMES } from 'rsbuild-plugin-rsc';
import { toNodeHandler } from 'srvx/node';
import type Fetch from './server';

export default defineConfig({
  plugins: [pluginReact(), pluginRSC()],
  environments: {
    server: {
      source: {
        entry: {
          index: {
            import: './server/index.tsx',
            layer: RSC_LAYERS_NAMES.REACT_SERVER_COMPONENTS,
          },
        },
      },
    },
    client: {
      source: {
        entry: {
          index: './client/index.tsx',
        },
      },
    },
  },
  dev: {
    setupMiddlewares: (middlewares, serverAPI) => {
      middlewares.unshift(async (req, res, next) => {
        // Custom middleware to handle RSC (React Server Components) requests
        // Intercepts requests with 'text/x-component' accept header and routes them to the server bundle
        if (req.headers.accept?.includes('text/x-component')) {
          const indexModule = await serverAPI.environments.server.loadBundle<{
            default: typeof Fetch;
          }>('index');
          await toNodeHandler((req) => indexModule.default.fetch(req))(
            req,
            res,
          );
        } else {
          next();
        }
      });
    },
  },
});
