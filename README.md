# rsbuild-plugin-rsc

This package provides [React Server Components](https://react.dev/reference/rsc/server-components) (RSC) support for Rsbuild.

## Examples

- **[client](./examples/client)** - Client-driven RSC integration
- **[server](./examples/server)** - Full server-rendered app with routing and Server Actions
- **[static](./examples/static)** - Static site generation

Each example includes a complete setup with development and production configurations.

## Getting Started

### 1. Create an Rsbuild React Project

First, ensure you have a functional Rsbuild React project. If you are starting from scratch, follow the [Rsbuild - React](https://rsbuild.rs/guide/framework/react) guide.

### 2. Install Dependencies

Install the plugin along with the necessary RSC runtime dependencies for Rspack:

```bash
npm install rsbuild-plugin-rsc react-server-dom-rspack
```

> Note: Server Components require `react` and `react-dom` v19.1.0 or later.

## License

MIT
