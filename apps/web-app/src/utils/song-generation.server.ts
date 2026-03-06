import "dotenv/config";
import { fireworks } from "@ai-sdk/fireworks";
import { generateObject } from "ai";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { SongGenerationStreamEvent } from "~/data/ai-studio";
import {
	cleanHtmlTreeToYaml,
	collectOrderedTextSegments,
	extractCleanHtmlTree,
	type CleanHtmlTree,
} from "~/utils/clean-html.server";
import { db } from "~/utils/db/client.server";
import {
	flashcards,
	lyricLines,
	songs,
	translationLines,
	translationRuns,
	vocabEntries,
} from "~/utils/db/schema";

(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const MODEL_ID = "accounts/fireworks/models/glm-5";
const CLEAN_YAML_PROMPT_CHAR_LIMIT = 120_000;
const TEXT_SEGMENT_LIMIT = 1_200;

const songMetadataSchema = z.object({
	title: z.string(),
	artist: z.string(),
});

const translationLineSchema = z.object({
	original: z.string(),
	translation: z.string(),
});

const vocabularySchema = z.object({
	original: z.string(),
	explanation: z.string(),
});

const explanationSchema = z.object({
	translationId: z.number().int(),
	longFormExplanation: z.string(),
	vocabularies: z.array(vocabularySchema),
});

const extractionResultSchema = z.object({
	lyricsLines: z.array(z.string()),
	songMetadata: songMetadataSchema,
});

const translationResultSchema = z.object({
	translations: z.array(translationLineSchema),
});

const explanationResultSchema = z.object({
	vocabularyExplanations: z.array(explanationSchema),
});

type SongMetadata = z.infer<typeof songMetadataSchema>;
type TranslationLine = z.infer<typeof translationLineSchema> & { id: number };
type ExplanationLine = z.infer<typeof explanationSchema>;

type TeachState = {
	lyricsLines: string[];
	songMetadata: SongMetadata | null;
	translations: TranslationLine[];
	vocabularyExplanations: ExplanationLine[];
};

type SavedSongResult = {
	runId: number;
	songId: number;
};

function normalizeLine(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function compactSegments(segments: string[], limit: number): string[] {
	const output: string[] = [];

	for (const raw of segments) {
		const line = normalizeLine(raw);
		if (!line) {
			continue;
		}

		if (output[output.length - 1] === line) {
			continue;
		}

		output.push(line);
		if (output.length >= limit) {
			break;
		}
	}

	return output;
}

function truncateForPrompt(text: string, maxChars: number): string {
	if (text.length <= maxChars) {
		return text;
	}

	return `${text.slice(0, maxChars)}\n# [truncated due to size]`;
}

function createStatusEvent(
	step:
		| "fetching_song_lyrics"
		| "generating_translation"
		| "generating_explanations"
		| "generating_flashcards",
	message: string,
): SongGenerationStreamEvent {
	return {
		message,
		step,
		timestamp: Date.now(),
		type: "status",
	};
}

export function isChallengePage(cleanTree: CleanHtmlTree): boolean {
	const lowerTitle = cleanTree.title.toLowerCase();
	const sampleText = cleanTree.nodes
		.flatMap((node) => [
			node.text ?? "",
			...(node.children?.map((child) => child.text ?? "") ?? []),
		])
		.join(" ")
		.toLowerCase();

	return (
		lowerTitle.includes("just a moment") ||
		sampleText.includes("make sure you're a human") ||
		sampleText.includes("verify you are human") ||
		sampleText.includes("checking if the site connection is secure") ||
		sampleText.includes("cloudflare")
	);
}

function buildSourceMaterials(cleanTree: CleanHtmlTree) {
	const cleanYaml = truncateForPrompt(
		cleanHtmlTreeToYaml(cleanTree),
		CLEAN_YAML_PROMPT_CHAR_LIMIT,
	);
	const textSegments = compactSegments(
		collectOrderedTextSegments(cleanTree.nodes, TEXT_SEGMENT_LIMIT * 2),
		TEXT_SEGMENT_LIMIT,
	);
	const indexedSegments = textSegments
		.map((line, index) => `${index + 1}. ${line}`)
		.join("\n");

	return { cleanYaml, indexedSegments };
}

export async function extractMetadataAndLyrics(
	cleanTree: CleanHtmlTree,
): Promise<{ lyricsLines: string[]; songMetadata: SongMetadata }> {
	const { cleanYaml, indexedSegments } = buildSourceMaterials(cleanTree);
	const result = await generateObject({
		model: fireworks(MODEL_ID),
		prompt: [
			"Extract song metadata and lyric lines from this webpage.",
			"Return JSON only.",
			"",
			"Metadata rules:",
			"- title must be only the song title.",
			"- artist must be only the artist name.",
			"- remove site branding and words like Lyrics.",
			"",
			"Lyrics rules:",
			"- extract only lyric lines in singing order.",
			"- remove numbering, menus, ads, navigation, comments, and page chrome.",
			"- remove section headers like [Verse], [Chorus], [Bridge], [Outro].",
			"- keep repeated lyric lines if they appear in the song.",
			"- keep each lyric line as one cleaned string.",
			"- keep romanized Japanese exactly as shown except whitespace cleanup.",
			"",
			"Few-shot example:",
			"Input page title: Sayuri - Tower of Flower Lyrics (Romanized) | Hana no Tou [花の塔] - Lyrical Nonsense",
			"Input fragments:",
			"1. Alternate Title: Hana no Tou",
			"2. Artist: Sayuri",
			"3. 1. Kimi ga motte kita manga",
			"4. 2. Kureta shiranai namae no ohana",
			"5. Share",
			"Expected output:",
			'{"songMetadata":{"title":"Tower of Flower","artist":"Sayuri"},"lyricsLines":["Kimi ga motte kita manga","Kureta shiranai namae no ohana"]}',
			"",
			`Page URL: ${cleanTree.url}`,
			`Page title: ${cleanTree.title}`,
			"",
			"Clean text fragments (ordered):",
			indexedSegments,
			"",
			"Clean HTML YAML snapshot:",
			cleanYaml,
		].join("\n"),
		schema: extractionResultSchema,
		schemaName: "song_extraction",
	});

	const title = normalizeLine(result.object.songMetadata.title);
	const artist = normalizeLine(result.object.songMetadata.artist);
	const lyricsLines = result.object.lyricsLines
		.map(normalizeLine)
		.filter((line) => line.length > 0);

	if (!title || !artist) {
		throw new Error("The model did not return usable song metadata.");
	}
	if (lyricsLines.length === 0) {
		throw new Error("The model did not return any lyric lines.");
	}

	return {
		lyricsLines,
		songMetadata: { artist, title },
	};
}

export async function generateTranslations(
	lyricsLines: string[],
): Promise<TranslationLine[]> {
	const numberedLyrics = lyricsLines
		.map((line, index) => `${index}. ${line}`)
		.join("\n");

	const result = await generateObject({
		model: fireworks(MODEL_ID),
		prompt: [
			"Translate these Japanese lyric lines into beginner-friendly English.",
			"Return JSON only.",
			"",
			"Rules:",
			"- return exactly one translation item per lyric line.",
			"- keep the original field exactly equal to the input lyric line.",
			"- preserve ordering.",
			"- translation should be natural, clear English.",
			"- do not skip lines.",
			"",
			"Example:",
			'{"translations":[{"original":"Kimi ga motte kita manga","translation":"The manga that you brought"}]}',
			"",
			"Lyric lines:",
			numberedLyrics,
		].join("\n"),
		schema: translationResultSchema,
		schemaName: "song_translations",
	});

	if (result.object.translations.length !== lyricsLines.length) {
		throw new Error(
			`Expected ${lyricsLines.length} translations, got ${result.object.translations.length}.`,
		);
	}

	return result.object.translations.map((entry, index) => {
		const original = normalizeLine(entry.original);
		const expectedOriginal = lyricsLines[index];

		if (original !== expectedOriginal) {
			throw new Error(
				`Translation line ${index} did not preserve the original lyric text.`,
			);
		}

		return {
			id: index,
			original,
			translation: normalizeLine(entry.translation),
		};
	});
}

export async function generateExplanations(
	translations: TranslationLine[],
): Promise<ExplanationLine[]> {
	const numberedTranslations = translations
		.map(
			(line) =>
				`${line.id}. Original: ${line.original}\nTranslation: ${line.translation}`,
		)
		.join("\n\n");

	const result = await generateObject({
		model: fireworks(MODEL_ID),
		prompt: [
			"Create beginner-friendly explanations and vocabulary notes for these lyric lines.",
			"Return JSON only.",
			"",
			"Rules:",
			"- return exactly one explanation entry per translation id.",
			"- translationId must match the numbered input ids.",
			"- explain grammar/forms in simple English.",
			"- vocabulary may be single words or useful phrase chunks.",
			"- prefer chunks when they teach form better.",
			"",
			"Example A:",
			"Original: Kimi ga motte kita manga",
			"Translation: The manga that you brought",
			"Good longFormExplanation: Kimi means 'you'. Particle ga marks kimi as subject. motte kita is from motte kuru (to bring), where motte is te-form of motsu and kita is past of kuru, so together it means 'brought'. manga is 'comic/manga'.",
			'Good vocabularies: [{"original":"kimi","explanation":"you"},{"original":"ga","explanation":"subject marker"},{"original":"motte kita","explanation":"past form chunk from motte kuru, meaning brought"},{"original":"manga","explanation":"comic/manga"}]',
			"",
			"Example B:",
			"Original: Nakanu you ni",
			"Translation: So that I won't cry",
			"Good longFormExplanation: Nakanu is a literary or soft negative form related to nakanai (not cry). you ni means 'so that' or 'in order to'. Together, nakanu you ni expresses purpose or prevention.",
			'Good vocabularies: [{"original":"nakanu","explanation":"negative form meaning not cry"},{"original":"you ni","explanation":"so that / in order to"}]',
			"",
			"Lines:",
			numberedTranslations,
		].join("\n"),
		schema: explanationResultSchema,
		schemaName: "song_explanations",
	});

	if (result.object.vocabularyExplanations.length !== translations.length) {
		throw new Error(
			`Expected ${translations.length} explanation entries, got ${result.object.vocabularyExplanations.length}.`,
		);
	}

	const expectedIds = new Set(translations.map((line) => line.id));
	const seenIds = new Set<number>();

	for (const entry of result.object.vocabularyExplanations) {
		if (!expectedIds.has(entry.translationId)) {
			throw new Error(`Unexpected translationId ${entry.translationId}.`);
		}
		if (seenIds.has(entry.translationId)) {
			throw new Error(`Duplicate translationId ${entry.translationId}.`);
		}
		seenIds.add(entry.translationId);
	}

	return result.object.vocabularyExplanations.map((entry) => ({
		longFormExplanation: normalizeLine(entry.longFormExplanation),
		translationId: entry.translationId,
		vocabularies: entry.vocabularies
			.map((vocabulary) => ({
				explanation: normalizeLine(vocabulary.explanation),
				original: normalizeLine(vocabulary.original),
			}))
			.filter((vocabulary) => vocabulary.original && vocabulary.explanation),
	}));
}

export async function saveGeneratedSong(
	state: TeachState,
	sourceUrl: string,
): Promise<SavedSongResult> {
	const songMetadata = state.songMetadata;
	if (!songMetadata) {
		throw new Error("Song metadata missing after generation.");
	}

	return db.transaction(async (tx) => {
		const [song] = await tx
			.insert(songs)
			.values({
				artist: songMetadata.artist,
				title: songMetadata.title,
			})
			.returning({ id: songs.id });

		if (!song) {
			throw new Error("Failed to insert song row.");
		}

		const [run] = await tx
			.insert(translationRuns)
			.values({
				modelId: MODEL_ID,
				songId: song.id,
				sourceUrl,
			})
			.returning({ id: translationRuns.id });

		if (!run) {
			throw new Error("Failed to insert translation run row.");
		}

		const lineRows = state.lyricsLines.map((line, index) => ({
			lineIndex: index,
			originalText: line,
			runId: run.id,
		}));

		const insertedLines = await tx
			.insert(lyricLines)
			.values(lineRows)
			.returning({ id: lyricLines.id, lineIndex: lyricLines.lineIndex });

		if (insertedLines.length !== state.lyricsLines.length) {
			throw new Error("Failed to insert all lyric lines.");
		}

		const lyricLineIdByIndex = new Map(
			insertedLines.map((row) => [row.lineIndex, row.id]),
		);

		const translationRows = state.translations.map((line) => {
			const lyricLineId = lyricLineIdByIndex.get(line.id);
			if (!lyricLineId) {
				throw new Error(`Missing lyric line row for index ${line.id}.`);
			}

			return {
				longFormExplanation:
					state.vocabularyExplanations[line.id]?.longFormExplanation ?? "",
				lyricLineId,
				translationText: line.translation,
			};
		});

		const insertedTranslations = await tx
			.insert(translationLines)
			.values(translationRows)
			.returning({
				id: translationLines.id,
				lyricLineId: translationLines.lyricLineId,
			});

		if (insertedTranslations.length !== state.translations.length) {
			throw new Error("Failed to insert all translation lines.");
		}

		const translationIdByLyricLineId = new Map(
			insertedTranslations.map((row) => [row.lyricLineId, row.id]),
		);

		const vocabRows = state.vocabularyExplanations.flatMap((entry) => {
			const lyricLineId = lyricLineIdByIndex.get(entry.translationId);
			if (!lyricLineId) {
				throw new Error(
					`Missing lyric line row for index ${entry.translationId}.`,
				);
			}

			const translationLineId = translationIdByLyricLineId.get(lyricLineId);
			if (!translationLineId) {
				throw new Error(
					`Missing translation line row for lyric line ${entry.translationId}.`,
				);
			}

			return entry.vocabularies.map((vocabulary, vocabIndex) => ({
				explanation: vocabulary.explanation,
				originalText: vocabulary.original,
				translationLineId,
				vocabIndex,
			}));
		});

		if (vocabRows.length > 0) {
			const insertedVocab = await tx
				.insert(vocabEntries)
				.values(vocabRows)
				.returning({ id: vocabEntries.id });

			if (insertedVocab.length !== vocabRows.length) {
				throw new Error("Failed to insert all vocabulary entries.");
			}
		}

		return { runId: run.id, songId: song.id };
	});
}

async function getLatestRun(songId: number) {
	const [run] = await db
		.select({
			createdAt: translationRuns.createdAt,
			id: translationRuns.id,
			modelId: translationRuns.modelId,
			songId: translationRuns.songId,
			sourceUrl: translationRuns.sourceUrl,
		})
		.from(translationRuns)
		.where(eq(translationRuns.songId, songId))
		.orderBy(desc(translationRuns.createdAt), desc(translationRuns.id))
		.limit(1);

	if (!run) {
		throw new Error(`No translation runs found for song id ${songId}.`);
	}

	return run;
}

export async function buildFlashcardsForSong(songId: number): Promise<number> {
	const run = await getLatestRun(songId);
	const runWithLines = await db.query.translationRuns.findFirst({
		where: eq(translationRuns.id, run.id),
		with: {
			lyricLines: {
				orderBy: (fields, operators) => operators.asc(fields.lineIndex),
				with: {
					translationLine: {
						with: {
							vocabEntries: {
								orderBy: (fields, operators) =>
									operators.asc(fields.vocabIndex),
							},
						},
					},
				},
			},
		},
	});

	if (!runWithLines) {
		throw new Error(`Failed to load translation run ${run.id}.`);
	}

	const cardsToInsert = runWithLines.lyricLines.flatMap((line) => {
		const translation = line.translationLine;
		if (!translation) {
			return [];
		}

		return translation.vocabEntries.map((entry) => ({
			back: `Meaning: ${entry.explanation}\nLine translation: ${translation.translationText}`,
			front: `Line: ${line.originalText}\nTarget: ${entry.originalText}`,
			runId: run.id,
			sourceTranslationLineId: translation.id,
			sourceVocabEntryId: entry.id,
		}));
	});

	return db.transaction(async (tx) => {
		await tx.delete(flashcards).where(eq(flashcards.runId, run.id));

		if (cardsToInsert.length === 0) {
			return 0;
		}

		const inserted = await tx
			.insert(flashcards)
			.values(cardsToInsert)
			.returning({ id: flashcards.id });

		return inserted.length;
	});
}

export async function* generateSongFromUrl(
	rawUrl: string,
): AsyncGenerator<SongGenerationStreamEvent> {
	const url = rawUrl.trim();
	if (!url) {
		throw new Error("A song URL is required.");
	}

	try {
		new URL(url);
	} catch {
		throw new Error("Please enter a valid URL.");
	}

	if (!process.env.FIREWORKS_API_KEY) {
		throw new Error(
			"Missing FIREWORKS_API_KEY. Add it to your environment before generating songs.",
		);
	}

	yield createStatusEvent("fetching_song_lyrics", "Fetching song lyrics...");
	const cleanTree = await extractCleanHtmlTree(url, {
		maxDepth: 20,
		maxNodes: 3000,
	});

	if (isChallengePage(cleanTree)) {
		throw new Error(
			"Genius blocked automated access for this request. Try again later or use another lyrics source.",
		);
	}

	const extraction = await extractMetadataAndLyrics(cleanTree);
	const state: TeachState = {
		lyricsLines: extraction.lyricsLines,
		songMetadata: extraction.songMetadata,
		translations: [],
		vocabularyExplanations: [],
	};

	yield createStatusEvent(
		"generating_translation",
		"Generating translation...",
	);
	state.translations = await generateTranslations(state.lyricsLines);

	yield createStatusEvent(
		"generating_explanations",
		"Generating explanations and vocabularies...",
	);
	state.vocabularyExplanations = await generateExplanations(state.translations);

	yield createStatusEvent("generating_flashcards", "Generating flashcards...");
	const saved = await saveGeneratedSong(state, cleanTree.url);
	const flashcardCount = await buildFlashcardsForSong(saved.songId);

	yield {
		flashcardCount,
		runId: saved.runId,
		songId: saved.songId,
		timestamp: Date.now(),
		type: "done",
	};
}
