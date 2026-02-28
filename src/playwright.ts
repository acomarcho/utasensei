#!/usr/bin/env node

import { chromium } from "playwright";

const USAGE = 'Usage: pnpm playwright -- "https://example.com"';
const CANDIDATE_SELECTORS = [
  "article",
  "main",
  "[role='main']",
  "#content",
  ".content",
  "#page"
];

function normalizeText(raw: string): string {
  const lines = raw
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);

  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] !== line) {
      deduped.push(line);
    }
  }

  return deduped.join("\n");
}

function parseUrlArg(argv: string[]): string {
  const args = argv.slice(2).filter((arg) => arg.trim().length > 0);
  const urlArg = (args[0] === "--" ? args[1] : args[0])?.trim();
  if (!urlArg) {
    throw new Error(USAGE);
  }

  try {
    const parsed = new URL(urlArg);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Only http/https URLs are supported.");
    }
    return parsed.toString();
  } catch {
    throw new Error(`Invalid URL.\n${USAGE}`);
  }
}

async function extractCleanSnapshot(url: string): Promise<string> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"]
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      locale: "en-US"
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1_000);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const title = await page.title();
      const bodySnippet = (await page.locator("body").innerText()).slice(0, 500);
      const onChallengePage =
        /just a moment/i.test(title) ||
        /make sure you'?re a human/i.test(bodySnippet) ||
        /verification successful/i.test(bodySnippet);

      if (!onChallengePage) {
        break;
      }

      await page.waitForTimeout(1_000);
    }

    const title = await page.title();
    const rawText = await page.evaluate((selectors) => {
      const geniusLyrics = Array.from(
        document.querySelectorAll("[data-lyrics-container='true']")
      ) as HTMLElement[];

      if (geniusLyrics.length > 0) {
        return geniusLyrics.map((container) => container.innerText).join("\n");
      }

      const root =
        selectors
          .map((selector) => document.querySelector(selector))
          .find((node) => node instanceof HTMLElement) ?? document.body;

      const clone = root.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll(
          "script,style,noscript,svg,canvas,iframe,nav,footer,header,form,button,input,textarea,select"
        )
        .forEach((node) => node.remove());

      return (clone.innerText || clone.textContent || "").trim();
    }, CANDIDATE_SELECTORS);

    const cleaned = normalizeText(rawText);
    return `Title: ${title}\nURL: ${url}\n\n${cleaned}`;
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  try {
    const url = parseUrlArg(process.argv);
    const snapshot = await extractCleanSnapshot(url);
    process.stdout.write(`${snapshot}\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}

void main();
