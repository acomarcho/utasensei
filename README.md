# UtaSensei CLI

A simple CLI for:

- extracting webpage content into a cleaner, LLM-friendly YAML-like structure
- generating Japanese song learning data (metadata, lyric lines, translations, and grammar/vocabulary explanations)

---

## What You Can Do

- `extract-html`  
  Turn a webpage into a simplified tree (no heavy HTML attributes, cleaner text structure).

- `translate-song`  
  Generate structured learning output from a song page:
  - song title + artist
  - cleaned lyric lines
  - line-by-line translations
  - beginner-friendly grammar/vocabulary explanations

---

## Requirements

- Node.js `>= 22`
- `pnpm`
- A Fireworks API key for `translate-song`

---

## Quick Start

```bash
pnpm install
cp .env.example .env
```

Then open `.env` and set:

```bash
FIREWORKS_API_KEY=your_key_here
```

Check commands:

```bash
pnpm cli --help
```

---

## Commands

### 1) Extract Clean HTML

```bash
pnpm cli extract-html <url>
```

Examples:

```bash
pnpm cli extract-html https://genius.com/Genius-romanizations-rokudenashi-one-voice-romanized-lyrics
pnpm cli extract-html https://www.lyrical-nonsense.com/global/lyrics/sayuri/hana-no-tou/
```

Output is YAML-like text:

```yaml
title: "..."
url: "..."
tree:
  - div:
    - h2: "..."
    - p: "..."
```

---

### 2) Translate Song

```bash
pnpm cli translate-song <url>
```

Example:

```bash
pnpm cli translate-song https://www.lyrical-nonsense.com/global/lyrics/sayuri/hana-no-tou/
```

Output is JSON:

```json
{
  "songMetadata": {
    "title": "Tower of Flower",
    "artist": "Sayuri"
  },
  "lyricsLines": [
    "Kimi ga motte kita manga"
  ],
  "translations": [
    {
      "id": 0,
      "original": "Kimi ga motte kita manga",
      "translation": "The manga that you brought"
    }
  ],
  "vocabularyExplanations": [
    {
      "translationId": 0,
      "longFormExplanation": "Beginner-friendly grammar explanation...",
      "vocabularies": [
        {
          "original": "motte kita",
          "explanation": "Past-form chunk from motte kuru, meaning brought"
        }
      ]
    }
  ]
}
```

---

## How It Works (Plain English)

### `extract-html`

1. Opens the page with Playwright (headless browser).
2. Waits for the page to load (including some anti-bot interstitial waits).
3. Walks the DOM tree and keeps only useful structure:
   - tag names
   - direct text
   - nested children
4. Removes noisy content like scripts/styles/hidden elements.
5. Prints a cleaner YAML-like tree.

### `translate-song`

1. Uses the cleaned HTML tree + text segments from the page.
2. Runs a tool-loop agent with ordered state updates:
   1. set song metadata
   2. set lyric lines
   3. set translations
   4. set explanation/vocabulary entries
3. Validates that each step is complete and consistent.
4. Prints the final structured JSON.

---

## Known Limitations

- Best quality is on pages where lyrics are clearly present.
- Some websites are noisier than others, so extraction quality can vary.
- Very large pages can take longer and use more tokens in `translate-song`.
- Anti-bot pages can still block content on some sites.

---

## Troubleshooting

- `Missing FIREWORKS_API_KEY`  
  Add your key to `.env`.

- `Invalid URL` or command errors  
  Check usage with `pnpm cli --help`.

- Slow response  
  Some pages are heavy, or model calls may take time.

- Output seems noisy  
  Try another URL on the same site, or run `extract-html` first to inspect page structure.

---

## Development

Build:

```bash
pnpm build
```

Main entrypoint:

- `src/index.ts`

Core modules:

- `src/lib/clean-html.ts`
- `src/commands/extract-html.ts`
- `src/commands/translate-song.ts`
