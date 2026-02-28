#!/usr/bin/env node

import "dotenv/config";
import { fireworks } from "@ai-sdk/fireworks";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { chromium } from "playwright";
import { z } from "zod";

// Keep CLI stdout clean JSON for piping/parsing.
(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const MODEL_ID = "accounts/fireworks/models/glm-5";
const USAGE = 'Usage: pnpm translate -- "https://example.com/lyrics"';
const CANDIDATE_SELECTORS = [
  "article",
  "main",
  "[role='main']",
  "#content",
  ".content",
  "#page"
];

const translationLineSchema = z.object({
  original: z.string().min(1),
  translation: z.string().min(1)
});
const translationOutputSchema = z.object({
  translations: z.array(translationLineSchema)
});

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

function cleanupLyricsText(raw: string): string {
  const lines = normalizeText(raw).split("\n");

  const cleaned = lines.filter((line) => {
    if (/^\d+\s+contributors?$/i.test(line)) return false;
    if (/^translations?$/i.test(line)) return false;
    if (/lyrics$/i.test(line)) return false;
    if (/^genius romanizations$/i.test(line)) return false;
    if (/^you might also like$/i.test(line)) return false;
    if (/^about$/i.test(line)) return false;
    if (/^credits$/i.test(line)) return false;
    if (/^tags$/i.test(line)) return false;
    if (/^comments$/i.test(line)) return false;
    if (/^q&a$/i.test(line)) return false;
    if (/^released on$/i.test(line)) return false;
    return true;
  });

  return cleaned.join("\n");
}

function toLyricLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^\[.*\]$/.test(line))
    .filter((line) => !/^".*"$/.test(line))
    .filter((line) => !/\(romanized\)\s*lyrics$/i.test(line))
    .filter((line) => !/^ロクデナシ.*lyrics$/i.test(line));
}

async function extractLyricsText(url: string): Promise<string> {
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

    return cleanupLyricsText(rawText);
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const url = parseUrlArg(process.argv);

  if (!process.env.FIREWORKS_API_KEY) {
    console.error("Missing FIREWORKS_API_KEY. Add it to .env (see .env.example).");
    process.exit(1);
  }

  const lyricsText = await extractLyricsText(url);
  if (!lyricsText) {
    throw new Error("No lyric text found on the page.");
  }
  const lyricLines = toLyricLines(lyricsText);
  if (lyricLines.length === 0) {
    throw new Error("No lyric lines found after cleanup.");
  }

  try {
    const { output } = await generateText({
      model: fireworks(MODEL_ID),
      output: Output.object({
        schema: translationOutputSchema,
        name: "LyricTranslations",
        description:
          "Line-by-line English translations of song lyrics with original lines preserved."
      }),
      prompt: [
        "Translate each input line from Japanese (or romanized Japanese) into natural English.",
        "Return ONLY a JSON object with this exact shape: {\"translations\":[{\"original\":\"...\",\"translation\":\"...\"}]}",
        `You MUST return exactly ${lyricLines.length} items in translations.`,
        "Each item must have exactly keys: original, translation.",
        "Copy original exactly from the input line and keep order unchanged.",
        "Do not skip lines and do not add commentary.",
        "",
        "Input lines JSON array:",
        JSON.stringify(lyricLines)
      ].join("\n")
    });

    process.stdout.write(`${JSON.stringify(output.translations, null, 2)}\n`);
  } catch (error: unknown) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const cause =
        error.cause instanceof Error ? error.cause.message : String(error.cause);
      throw new Error(`Model returned invalid structured output. Cause: ${cause}`);
    }
    throw error;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Translation failed: ${message}`);
  process.exit(1);
});
