import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { Layers, pluginRSC } from 'rsbuild-plugin-rsc';
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
            layer: Layers.rsc,
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
  server: {
    setup: ({ server }) => {
      server.middlewares.use(async (req, res, next) => {
        // Custom middleware to handle RSC (React Server Components) requests
        // Intercepts requests with 'text/x-component' accept header and routes them to the server bundle
        if (req.headers.accept?.includes('text/x-component')) {
          const indexModule = await server.environments.server.loadBundle<{
            default: typeof Fetch;
          }>('index');
          await toNodeHandler(() => indexModule.default.fetch())(req, res);
        } else {
          next();
        }
      });
    },
  },
});
