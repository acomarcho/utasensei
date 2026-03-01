#!/usr/bin/env node

import "dotenv/config";
import { fireworks } from "@ai-sdk/fireworks";
import { stepCountIs, ToolLoopAgent, tool } from "ai";
import { chromium } from "playwright";
import { z } from "zod";

// Keep CLI stdout clean JSON for piping/parsing.
(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const MODEL_ID = "accounts/fireworks/models/glm-5";
const USAGE = 'Usage: pnpm translate-teach -- "https://example.com/lyrics"';
const CANDIDATE_SELECTORS = [
  "article",
  "main",
  "[role='main']",
  "#content",
  ".content",
  "#page"
];

const translationLineSchema = z.object({
  original: z.string(),
  translation: z.string()
});

const vocabularySchema = z.object({
  original: z.string(),
  explanation: z.string()
});

const explanationSchema = z.object({
  translationId: z.number().int(),
  longFormExplanation: z.string(),
  vocabularies: z.array(vocabularySchema)
});

type TranslationLine = z.infer<typeof translationLineSchema> & { id: number };
type ExplanationLine = z.infer<typeof explanationSchema>;
type TeachState = {
  translations: TranslationLine[];
  vocabularyExplanations: ExplanationLine[];
};

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

  const state: TeachState = {
    translations: [],
    vocabularyExplanations: []
  };

  const agent = new ToolLoopAgent({
    model: fireworks(MODEL_ID),
    stopWhen: stepCountIs(8),
    instructions: [
      "You are a strict Japanese-learning content generator that MUST update state via tools.",
      "Use tool calls, not plain text, to produce the result.",
      "Hard requirements:",
      "- Call set_translation_state first, exactly once.",
      "- Call set_vocab_explanations_state second, exactly once.",
      "- Do not call set_vocab_explanations_state before set_translation_state.",
      "- Every input line must be translated in order; do not skip lines.",
      "- For explanations: every translation line gets exactly one explanation entry.",
      "- translationId is zero-based and must match the id in state.translations.",
      "- longFormExplanation should explain grammar/form at beginner level (particles, verb forms, chunks).",
      "- vocabularies can be single words or phrase chunks (preferred when it teaches form better).",
      "- Keep original text unchanged in translations and vocab entries."
    ].join("\n"),
    tools: {
      set_translation_state: tool({
        description:
          "Set translation state from lyric lines. This resets vocabularyExplanations to empty.",
        inputSchema: z.object({
          translations: z.array(translationLineSchema)
        }),
        execute: async ({ translations }) => {
          state.translations = translations.map((line, id) => ({ id, ...line }));
          state.vocabularyExplanations = [];
          return state;
        }
      }),
      set_vocab_explanations_state: tool({
        description:
          "Set vocabulary explanations for each translation line. Must only be called after translation state exists.",
        inputSchema: z.object({
          vocabularyExplanations: z.array(explanationSchema)
        }),
        execute: async ({ vocabularyExplanations }) => {
          if (state.translations.length === 0) {
            return "Please call the translation tool first before using this tool.";
          }

          if (vocabularyExplanations.length !== state.translations.length) {
            return `Please provide exactly ${state.translations.length} explanation entries (one per translation line).`;
          }

          const validIds = new Set(state.translations.map((line) => line.id));
          const seen = new Set<number>();

          for (const entry of vocabularyExplanations) {
            if (!validIds.has(entry.translationId)) {
              return `Invalid translationId ${entry.translationId}. Use ids from state.translations.`;
            }
            if (seen.has(entry.translationId)) {
              return `Duplicate translationId ${entry.translationId}. Provide exactly one explanation per translation line.`;
            }
            seen.add(entry.translationId);
          }

          const missingIds = state.translations
            .map((line) => line.id)
            .filter((id) => !seen.has(id));
          if (missingIds.length > 0) {
            return `Missing explanation entries for translationId: ${missingIds.join(", ")}`;
          }

          state.vocabularyExplanations = vocabularyExplanations;
          return state;
        }
      })
    }
  });

  await agent.generate({
    prompt: [
      "Task: create line-by-line Japanese learning output via tool calls.",
      "You must call tools in this order:",
      "1) set_translation_state",
      "2) set_vocab_explanations_state",
      "After both tools succeed, finish with a short confirmation text.",
      "",
      "Translation quality requirements:",
      "- Natural English translation, concise and faithful.",
      "- Keep original exactly as input.",
      "",
      "Explanation quality requirements:",
      "- Every line must have longFormExplanation + vocabularies.",
      "- Emphasize forms and grammar chunks (e.g., te-form, potential, particle function, set phrases).",
      "- Teach like to a beginner: clear and concrete, no jargon-only explanations.",
      "",
      "Few-shot examples:",
      "Example line 1:",
      "- Original: Kimi ga motte kita manga",
      "- Translation: The manga that you brought",
      "- Good longFormExplanation: \"Kimi means 'you'. Particle ga marks kimi as subject. motte kita is from motte kuru (to bring), where motte is te-form of motsu and kita is past of kuru, so together it means 'brought'. manga is 'comic/manga'.\"",
      "- Good vocabularies: [{\"original\":\"kimi\",\"explanation\":\"you\"},{\"original\":\"ga\",\"explanation\":\"subject marker\"},{\"original\":\"motte kita\",\"explanation\":\"past form chunk from motte kuru, meaning 'brought'\"},{\"original\":\"manga\",\"explanation\":\"comic/manga\"}]",
      "",
      "Example line 2:",
      "- Original: Nakanu you ni",
      "- Translation: So that I won't cry",
      "- Good longFormExplanation: \"Nakanu is a literary/soft negative form related to nakanai (not cry). you ni means 'so that' or 'in order to'. As a chunk, nakanu you ni expresses purpose/prevention: doing something so crying does not happen.\"",
      "- Good vocabularies: [{\"original\":\"nakanu\",\"explanation\":\"negative form meaning 'not cry'\"},{\"original\":\"you ni\",\"explanation\":\"so that / in order to\"}]",
      "",
      "Input lyric lines JSON:",
      JSON.stringify(lyricLines)
    ].join("\n")
  });

  if (state.translations.length !== lyricLines.length) {
    throw new Error(
      `Agent did not set full translations state. Expected ${lyricLines.length}, got ${state.translations.length}.`
    );
  }

  if (state.vocabularyExplanations.length !== lyricLines.length) {
    throw new Error(
      `Agent did not set full vocabulary explanations state. Expected ${lyricLines.length}, got ${state.vocabularyExplanations.length}.`
    );
  }

  process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Translate-teach failed: ${message}`);
  process.exit(1);
});
