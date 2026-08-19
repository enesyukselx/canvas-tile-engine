# Canvas Tile Engine Documentation

This is the official documentation for **Canvas Tile Engine**, a high-performance HTML5 Canvas library for building interactive grid-based maps.

The documentation is built using [Docusaurus](https://docusaurus.io/).

## 🚀 Getting Started

### Installation

This site is a standalone npm project - it is not part of the repository's pnpm workspace, so a root `pnpm install` does not install these dependencies.

```bash
npm ci
```

Equivalently, `pnpm install:docs` from the repository root. Use `npm install` only when you are intentionally adding or upgrading a dependency, and commit the resulting `package-lock.json`.

### Local Development

Start the development server:

```bash
npm start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build

Build the static website for production:

```bash
npm run build
```

This command generates static content into the `build` directory.
