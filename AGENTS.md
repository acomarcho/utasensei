# Repository Guidelines

## Project Structure & Module Organization
This repository is a `pnpm` workspace. Application code lives in `apps/`:

- `apps/cli`: TypeScript CLI, with commands in `src/commands`, shared helpers in `src/lib`, and Drizzle database code in `src/db`.
- `apps/web-app`: TanStack Start web app, with routes in `src/routes`, UI in `src/components`, and server/client utilities in `src/utils`.
- `apps/ai-studio-prototype`: Vite-based React prototype in `src/`.

Supporting docs live in `docs/`, implementation notes in `learnings/`, and dated plans in `plans/`. Do not hand-edit generated files such as `apps/web-app/src/routeTree.gen.ts`.

## Build, Test, and Development Commands
Use Node `22.x` (`.nvmrc` pins `v22.20.0`) and `pnpm >= 10`.

- `pnpm install`: install workspace dependencies.
- `pnpm web-app`: run the TanStack Start app locally.
- `pnpm studio`: run the AI Studio prototype on port `3000`.
- `pnpm cli --help`: inspect CLI commands; `pnpm cli translate-song <url>` is a common flow.
- `pnpm build`: build every workspace package that exposes a build script.
- `pnpm typecheck`: run TypeScript checks across the workspace.
- `pnpm lint` / `pnpm format`: run Biome linting and formatting.
- `pnpm db:generate:cli`, `pnpm db:push:web-app`: app-scoped Drizzle schema tasks.

## Coding Style & Naming Conventions
Biome is the formatter and linter (`biome.json`), and Lefthook runs it before commit. Follow the existing style: tabs for indentation, double quotes in TS/JS, and descriptive kebab-case filenames such as `song-model-picker.tsx`, `translate-song.ts`, and `song.$songId.tsx`. Inside those files, use PascalCase for React component names and camelCase for functions, helpers, and variables. Keep feature logic close to the app that owns it instead of introducing cross-app coupling.

## Testing Guidelines
There is no workspace-wide automated test suite yet. Before opening a PR, run `pnpm typecheck`, `pnpm lint`, and the relevant app build command. For the CLI, `pnpm --filter @utasensei/cli test:lyrics-prompt` exercises the current prompt script. If you add automated tests, keep them near the feature they cover and use `*.test.ts` or `*.test.tsx` naming.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit prefixes such as `feat(web-app): ...`, `fix(song-generation): ...`, and `refactor(cli): ...`. Keep commits scoped to one app or concern. PRs should include a short description, any environment or schema changes, linked issues when available, and screenshots or terminal output for UI/CLI behavior changes.

## Security & Configuration Tips
Copy the relevant `.env.example` file before local development. Current apps expect secrets such as `FIREWORKS_API_KEY`, and CLI/web DB files default to local SQLite paths. Never commit populated `.env` files or production secrets.
