import { defineConfig } from '@rsbuild/core';
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginRSC } from 'rsbuild-plugin-rsc';

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginRSC({
      entries: {
        rsc: './server/index.tsx',
        client: './client/index.tsx',
      },
    })
  ],
  server: {
    port: 3001,
  },
});
