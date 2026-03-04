import path from 'node:path';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { Layers, pluginRSC } from 'rsbuild-plugin-rsc';
import type NodeHandler from './src/framework/entry.rsc';

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginRSC({
      layers: {
        ssr: path.join(import.meta.dirname, './src/framework/entry.ssr.tsx'),
      },
    }),
  ],
  environments: {
    server: {
      source: {
        entry: {
          index: {
            import: './src/framework/entry.rsc.tsx',
            layer: Layers.rsc,
          },
        },
      },
    },
    client: {
      source: {
        entry: {
          index: './src/framework/entry.client.tsx',
        },
      },
    },
  },
  dev: {
    setupMiddlewares: (middlewares, serverAPI) => {
      // Custom middleware to handle RSC (React Server Components) requests
      middlewares.unshift(async (req, res, next) => {
        const indexModule = await serverAPI.environments.server.loadBundle<{
          default: NodeHandler;
        }>('index');
        await indexModule.default.nodeHandler(req, res, next);
      });
    },
  },
});
