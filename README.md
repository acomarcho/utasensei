# UtaSensei Workspace

This repo is now a `pnpm` workspace with multiple apps.

## Apps

- `apps/cli` — the original UtaSensei CLI
- `apps/web-app` — the TanStack Start web app
- `apps/ai-studio-prototype` — the Google AI Studio prototype app

## Requirements

- Node.js `>= 22`
- `pnpm`

## Workspace Setup

```bash
pnpm install
```

### CLI app setup

```bash
cp apps/cli/.env.example apps/cli/.env
```

Then open `apps/cli/.env` and set:

```bash
FIREWORKS_API_KEY=your_key_here
```

## Common Commands

### Run the CLI

```bash
pnpm cli --help
pnpm cli extract-html <url>
pnpm cli translate-song <url> [--model <modelId>]
```

### Run the AI Studio prototype

```bash
pnpm studio
```

### Workspace checks

```bash
pnpm typecheck
pnpm build
pnpm lint
pnpm format
```

### Database commands

```bash
pnpm db:generate:cli
pnpm db:push:cli
pnpm db:generate:web-app
pnpm db:push:web-app
```

## CLI App Notes

Main entrypoint:

- `apps/cli/src/index.ts`

Core modules:

- `apps/cli/src/lib/markdown-source.ts`
- `apps/cli/src/commands/extract-html.ts`
- `apps/cli/src/commands/translate-song.ts`

The CLI's local `.env` and SQLite database now live under `apps/cli/`.

## Contributing

See [AGENTS.md](./AGENTS.md) for the contributor guide. In short: use Node `22.x` with `pnpm`, prefer root workspace commands, keep filenames descriptive and kebab-case (for example `song-model-picker.tsx`), and use PascalCase for React component names inside those files.
