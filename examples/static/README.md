# Rsbuild RSC Static Rendering Example

This example demonstrates a multi-page static site built with Rsbuild and React Server Components (RSC). It showcases file-based page routing, server-side HTML rendering, client-side hydration, and client-side navigation between pages — all powered by `rsbuild-plugin-rsc`.

## Getting Started

```bash
# Start development server
pnpm dev

# Build for production
pnpm build
```

## Project Structure

```
src/
├── pages/           # Page components (file-based routing)
│   ├── Index.tsx
│   └── Other.tsx
├── components/      # Shared components
│   ├── Counter.tsx   # Client component
│   ├── Nav.tsx       # Server component
│   └── style.css
└── framework/       # Framework layer
    ├── entry.rsc.tsx    # RSC entrypoint (server)
    ├── entry.ssr.tsx    # SSR entrypoint (server)
    ├── entry.client.tsx # Client entrypoint (browser)
    ├── request.tsx      # RSC/SSR request routing
    ├── shared.tsx       # Shared types
    └── ssg.tsx          # Page types
```

### Page Components (`src/pages/*.tsx`)

Each file under `src/pages/` represents a page. Pages are React Server Components that render the full `<html>` document tree using the `"use server-entry"` directive. The file name determines the route (e.g., `Index.tsx` → `/index`, `Other.tsx` → `/other`).

```tsx
'use server-entry';

import { Counter } from '../components/Counter';
import { Nav } from '../components/Nav';

export default function Index({ pages, currentPage }: PageProps) {
  return (
    <html lang="en">
      <head><title>Static RSC</title></head>
      <body>
        <h1>This is an RSC!</h1>
        <Nav pages={pages} currentPage={currentPage} />
        <Counter />
      </body>
    </html>
  );
}
```

Pages are automatically discovered at build time via `import.meta.webpackContext` in `entry.rsc.tsx`, so adding a new `.tsx` file to `src/pages/` is all that's needed to create a new route.

### Server Components (`src/components/Nav.tsx`)

Server components run only on the server. `Nav` renders a list of links for all pages, highlighting the current page via `aria-current`.

### Client Components (`src/components/Counter.tsx`)

Client components use the `"use client"` directive and run in the browser. `Counter` demonstrates interactive state with `useState`.

## Framework Layer

### RSC Entrypoint (`src/framework/entry.rsc.tsx`)

The RSC entrypoint runs in the `react-server-components` layer. It:

1. Discovers all pages under `src/pages/` using `import.meta.webpackContext`
2. Matches the incoming request URL to a page
3. Renders the page component to an RSC stream via `react-server-dom-rspack`
4. For RSC requests (client-side navigation), returns the RSC stream directly
5. For SSR requests (initial page load), delegates to `entry.ssr.tsx` to produce HTML

### SSR Entrypoint (`src/framework/entry.ssr.tsx`)

The SSR entrypoint consumes the RSC stream and renders it to an HTML stream using `react-dom/server`. The RSC payload is injected into the HTML via `rsc-html-stream` for seamless client hydration.

### Client Entrypoint (`src/framework/entry.client.tsx`)

The client entrypoint hydrates the server-rendered HTML using the embedded RSC payload. It also implements a simple client-side router that:

- Intercepts link clicks to perform client-side navigation
- Fetches RSC payloads from the server for new pages (via `_.rsc` URL convention)
- Updates the page without a full browser reload

## Rsbuild Configuration

The `rsbuild.config.ts` configures two environments:

- **server**: Builds `entry.rsc.tsx` with the RSC layer for server-side rendering
- **client**: Builds `entry.client.tsx` for browser hydration and navigation

```ts
import { Layers, pluginRSC } from 'rsbuild-plugin-rsc';

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
});
```

## How It Works

### Initial Page Load

1. Browser requests a URL (e.g., `/`)
2. The server matches the URL to a page component (`Index.tsx`)
3. The RSC entrypoint renders the page to an RSC stream
4. The SSR entrypoint converts the RSC stream to HTML, injecting the RSC payload
5. The browser receives fully-rendered HTML and hydrates it using the embedded RSC payload

### Client-Side Navigation

1. User clicks a link (e.g., from `Index` to `Other`)
2. The client router intercepts the click and calls `history.pushState`
3. The client fetches the RSC payload for the new page (via `_.rsc` URL suffix)
4. React updates the page in-place without a full reload
