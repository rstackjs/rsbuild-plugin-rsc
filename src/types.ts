import type { RsbuildEntry } from '@rsbuild/core';

export type PluginRSCOptions = {
    entries?: {
        /**
         * The entry for React Server Components (RSC).
         * This will be used as the entry point for the server compiler,
         * and its layer will be set to RSC_LAYERS_NAMES.REACT_SERVER_COMPONENTS,
         * enabling server-only runtime and the use of `react-server` export conditions.
         */
        rsc?: string | string[] | RsbuildEntry,
        /**
         * The entry for server-side rendering (SSR).
         * You need to manually import this in your RSC application to render the RSC payload as HTML.
         * Rsbuild's only responsibility is to set its layer to RSC_LAYERS_NAMES.SERVER_SIDE_RENDERING.
         */
        ssr?: string | string[],
        /**
         * The browser (client) entry.
         * This will be used as the entry point for the client compiler.
         * Rsbuild will inject the browser-side output of "use client" modules into this entry.
         */
        client?: string | string[] | RsbuildEntry,
    }
};
