#!/usr/bin/env node

import "dotenv/config";
import { runExtractHtml } from "./commands/extract-html";
import { runSongs } from "./commands/songs";
import { runTranslateSong } from "./commands/translate-song";

const HELP_TEXT = [
  "Usage:",
  "  pnpm cli extract-html <url>",
  "  pnpm cli translate-song <url>",
  "  pnpm cli songs [id]",
  "",
  "Examples:",
  "  pnpm cli extract-html https://genius.com/Genius-romanizations-rokudenashi-one-voice-romanized-lyrics",
  "  pnpm cli translate-song https://www.lyrical-nonsense.com/global/lyrics/sayuri/hana-no-tou/",
  "  pnpm cli songs",
  "  pnpm cli songs 1"
].join("\n");

type CliArgs =
  | { command: "extract-html" | "translate-song"; url: string }
  | { command: "songs"; id?: number };

function parseCliArgs(argv: string[]): CliArgs {
  const rawArgs = argv.slice(2).filter((arg) => arg.trim().length > 0);
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    throw new Error(HELP_TEXT);
  }

  const command = args[0];

  if (command === "songs") {
    const idArg = args[1];
    if (!idArg) {
      return { command: "songs" };
    }

    const parsedId = Number(idArg);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      throw new Error(`Invalid song id "${idArg}".\n\n${HELP_TEXT}`);
    }

    return { command: "songs", id: parsedId };
  }

  const urlArg = args[1];
  if (!urlArg) {
    throw new Error(`Missing URL.\n\n${HELP_TEXT}`);
  }

  let parsed: URL;
  try {
    parsed = new URL(urlArg);
  } catch {
    throw new Error(`Invalid URL.\n\n${HELP_TEXT}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https URLs are supported.");
  }

  if (command === "extract-html" || command === "translate-song") {
    return { command, url: parsed.toString() };
  }

  throw new Error(`Unknown command "${command}".\n\n${HELP_TEXT}`);
}

async function main(): Promise<void> {
  try {
    const parsed = parseCliArgs(process.argv);

    switch (parsed.command) {
      case "extract-html":
        await runExtractHtml(parsed.url);
        return;
      case "translate-song":
        await runTranslateSong(parsed.url);
        return;
      case "songs":
        await runSongs(parsed.id);
        return;
      default: {
        const exhaustiveCheck: never = parsed;
        throw new Error(`Unknown command "${exhaustiveCheck}".\n\n${HELP_TEXT}`);
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    // Help text errors should exit as success so they feel like --help.
    if (message === HELP_TEXT) {
      process.stdout.write(`${message}\n`);
      process.exit(0);
    }

    console.error(`cli failed: ${message}`);
    process.exit(1);
  }
}

void main();
