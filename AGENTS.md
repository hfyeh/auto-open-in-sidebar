# Repository Guidelines

## Project Structure & Module Organization
- `src/main.ts` is the plugin entrypoint and contains runtime behavior.
- `manifest.json` defines Obsidian plugin metadata (ID, version, min app version).
- `main.js` is the generated bundle loaded by Obsidian.
- `styles.css` is optional plugin styling (currently minimal).
- Tooling/config files live at root: `esbuild.config.mjs`, `tsconfig.json`, `version-bump.mjs`, `package.json`, and `Makefile`.

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run dev` — start esbuild in watch mode for local iteration.
- `npm run build` — run strict TypeScript checks and produce production `main.js`.
- `make` — convenience target that builds plugin artifacts.
- `npm run version` — sync package version into `manifest.json` and `versions.json`.

## Coding Style & Naming Conventions
- Language: TypeScript with strict null checks and strict compiler options enabled.
- Formatting: use 2-space indentation, semicolons, and double quotes to match existing files.
- Naming: `PascalCase` for classes/types, `camelCase` for functions/variables.
- Keep behavior-focused logic in small private methods on the plugin class.
- Prefer explicit Obsidian API types (`TFile`, `WorkspaceLeaf`) and guard internal canvas fields defensively.

