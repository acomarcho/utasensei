# UtaSensei Workspace

This repo is now a `pnpm` workspace with multiple apps.

## Apps

- `apps/cli` — the original UtaSensei CLI
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
pnpm cli translate-song <url>
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
```

### CLI database commands

```bash
pnpm db:generate
pnpm db:push
```

## CLI App Notes

Main entrypoint:

- `apps/cli/src/index.ts`

Core modules:

- `apps/cli/src/lib/markdown-source.ts`
- `apps/cli/src/commands/extract-html.ts`
- `apps/cli/src/commands/translate-song.ts`

The CLI's local `.env` and SQLite database now live under `apps/cli/`.
