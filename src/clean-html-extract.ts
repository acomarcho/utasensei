#!/usr/bin/env node

import { cleanHtmlTreeToYaml, extractCleanHtmlTree } from "./lib/clean-html";

const USAGE = 'Usage: pnpm clean-html-extract -- "https://example.com/page"';

function parseUrlArg(argv: string[]): string {
  const args = argv.slice(2).filter((arg) => arg.trim().length > 0);
  const urlArg = (args[0] === "--" ? args[1] : args[0])?.trim();
  if (!urlArg) {
    throw new Error(USAGE);
  }

  let parsed: URL;
  try {
    parsed = new URL(urlArg);
  } catch {
    throw new Error(`Invalid URL.\n${USAGE}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https URLs are supported.");
  }

  return parsed.toString();
}

async function main(): Promise<void> {
  try {
    const url = parseUrlArg(process.argv);
    const extracted = await extractCleanHtmlTree(url);
    process.stdout.write(cleanHtmlTreeToYaml(extracted));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`clean-html-extract failed: ${message}`);
    process.exit(1);
  }
}

void main();
