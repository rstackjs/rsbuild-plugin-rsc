import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginRSC, RSC_LAYERS_NAMES } from 'rsbuild-plugin-rsc';
import { toNodeHandler } from 'srvx/node';

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginRSC({
      layers: {
        ssr: path.join(__dirname, './src/framework/entry.ssr.tsx'),
      },
    }),
  ],
  environments: {
    server: {
      source: {
        entry: {
          index: {
            import: './src/framework/entry.rsc.tsx',
            layer: RSC_LAYERS_NAMES.REACT_SERVER_COMPONENTS,
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

      async function fetch(
        req: IncomingMessage,
        res: ServerResponse<IncomingMessage>,
        id?: number,
      ) {
        const indexModule =
          await serverAPI.environments.server.loadBundle<any>('index');
        await toNodeHandler((req) => indexModule.default.fetch(req, id))(
          req,
          res,
        );
      }

      middlewares.unshift(async (req, res, next) => {
        // Handle GET requests to root path
        if (req.method === 'GET' && req.url === '/') {
          await fetch(req, res);
          return;
        }

        // Handle POST requests to root path
        if (req.method === 'POST' && req.url === '/') {
          await fetch(req, res);
          return;
        }

        // Handle GET requests to /todos/:id
        if (req.method === 'GET' && req.url?.startsWith('/todos/')) {
          const id = req.url.split('/')[2];
          if (id) {
            await fetch(req, res, Number(id));
            return;
          }
        }

        // Handle POST requests to /todos/:id
        if (req.method === 'POST' && req.url?.startsWith('/todos/')) {
          const id = req.url.split('/')[2];
          if (id) {
            await fetch(req, res, Number(id));
            return;
          }
        }

        next();
      });
    },
  },
});
