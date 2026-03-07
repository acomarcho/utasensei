import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractMetadataAndLyricsFromSource } from "./commands/translate-song";
import { parseSongGenerationModelId } from "./lib/song-generation-models";

const DEFAULT_FIXTURE_PATH = path.resolve(
	process.cwd(),
	"src/fixtures/genius-sayuri-mikazuki-romanized.md",
);

const SOURCE_URL =
	"https://genius.com/Genius-romanizations-sayuri-mikazuki-romanized-lyrics";
const SOURCE_TITLE =
	"Genius Romanizations - さユり (Sayuri) - ミカヅキ (Mikazuki) (Romanized)";
const COLLAPSED_LINE_COUNT_THRESHOLD = 7;
const LONGEST_LINE_THRESHOLD = 140;

async function main() {
	if (!process.env.FIREWORKS_API_KEY) {
		throw new Error(
			"Missing FIREWORKS_API_KEY. Run this from apps/cli with .env configured.",
		);
	}

	const modelId = parseSongGenerationModelId("minimax-m2p5");
	if (!modelId) {
		throw new Error("Failed to resolve minimax-m2p5 model id.");
	}

	const fixturePath = process.argv[2]
		? path.resolve(process.cwd(), process.argv[2])
		: DEFAULT_FIXTURE_PATH;
	const sourceMarkdown = await readFile(fixturePath, "utf8");

	const result = await extractMetadataAndLyricsFromSource(
		{
			sourceUrl: SOURCE_URL,
			title: SOURCE_TITLE,
			sourceMarkdown,
		},
		modelId,
	);

	const longestLineLength = result.lyricsLines.reduce(
		(max, line) => Math.max(max, line.length),
		0,
	);

	console.log(
		JSON.stringify(
			{
				fixturePath,
				modelId,
				title: result.songMetadata.title,
				artist: result.songMetadata.artist,
				lyricsLineCount: result.lyricsLines.length,
				longestLineLength,
				lyricsLines: result.lyricsLines,
			},
			null,
			2,
		),
	);

	if (result.lyricsLines.length <= COLLAPSED_LINE_COUNT_THRESHOLD) {
		throw new Error(
			`Extraction still looks collapsed: expected more than ${COLLAPSED_LINE_COUNT_THRESHOLD} lyric lines, got ${result.lyricsLines.length}.`,
		);
	}

	if (longestLineLength > LONGEST_LINE_THRESHOLD) {
		throw new Error(
			`Extraction still has overly long lyric lines: longest line was ${longestLineLength} chars, expected <= ${LONGEST_LINE_THRESHOLD}.`,
		);
	}

	console.log("Prompt test passed.");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
