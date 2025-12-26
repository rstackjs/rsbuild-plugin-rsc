import type { Rspack } from "@rsbuild/core";

export type PluginRSCOptions = {
  /**
   * Configuration for assigning modules to specific Rspack layers.
   * * This determines which modules are processed as React Server Components (RSC)
   * and which remain in the standard Server-Side Rendering (SSR) environment.
   */
  layers?: {
    /**
     * The condition to match React Server Components (RSC).
     * * Modules matching this rule will be assigned to the `react-server` layer
     * and processed with the `react-server` export condition (server-only runtime).
     */
    rsc?: Rspack.RuleSetCondition;

    /**
     * The condition to match modules that must remain in the standard SSR (Node.js) layer.
     * * **Priority:** This rule has higher priority than `rsc`.
     * * Use this to explicitly force specific files (e.g., server entry points) to stay 
     * in the standard Node.js environment, even if they overlap with the `rsc` pattern.
     */
    ssr?: Rspack.RuleSetCondition;
  };
};
