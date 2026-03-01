#!/usr/bin/env node

import "dotenv/config";
import { runExtractHtml } from "./commands/extract-html";
import { runTranslateSong } from "./commands/translate-song";

const HELP_TEXT = [
  "Usage:",
  "  pnpm cli extract-html <url>",
  "  pnpm cli translate-song <url>",
  "",
  "Examples:",
  "  pnpm cli extract-html https://genius.com/Genius-romanizations-rokudenashi-one-voice-romanized-lyrics",
  "  pnpm cli translate-song https://www.lyrical-nonsense.com/global/lyrics/sayuri/hana-no-tou/"
].join("\n");

function parseCliArgs(argv: string[]): { command: string; url: string } {
  const rawArgs = argv.slice(2).filter((arg) => arg.trim().length > 0);
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    throw new Error(HELP_TEXT);
  }

  const command = args[0];
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

  return { command, url: parsed.toString() };
}

async function main(): Promise<void> {
  try {
    const { command, url } = parseCliArgs(process.argv);

    switch (command) {
      case "extract-html":
        await runExtractHtml(url);
        return;
      case "translate-song":
        await runTranslateSong(url);
        return;
      default:
        throw new Error(`Unknown command "${command}".\n\n${HELP_TEXT}`);
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
