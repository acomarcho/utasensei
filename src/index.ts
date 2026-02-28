#!/usr/bin/env node

import "dotenv/config";
import { fireworks } from "@ai-sdk/fireworks";
import { generateText } from "ai";

const MODEL_ID = "accounts/fireworks/models/glm-5";

async function main(): Promise<void> {
  const prompt = process.argv.slice(2).join(" ").trim();

  if (!prompt) {
    console.error('Usage: pnpm dev -- "your prompt here"');
    process.exit(1);
  }

  if (!process.env.FIREWORKS_API_KEY) {
    console.error("Missing FIREWORKS_API_KEY. Add it to .env (see .env.example).");
    process.exit(1);
  }

  const { text } = await generateText({
    model: fireworks(MODEL_ID),
    prompt
  });

  process.stdout.write(`${text}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`LLM call failed: ${message}`);
  process.exit(1);
});
