import { fireworks } from "@ai-sdk/fireworks";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { Output, generateText } from "ai";
import { z } from "zod";
import { db } from "../db/client";
import {
	lyricLines,
	songs,
	translationLines,
	translationRuns,
	vocabEntries,
} from "../db/schema";
import { fetchMarkdownSource } from "../lib/markdown-source";
import {
	SONG_GENERATION_MODEL_IDS,
	type SongGenerationModelId,
} from "../lib/song-generation-models";

// Keep CLI stdout clean JSON for piping/parsing.
(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const SOURCE_MARKDOWN_PROMPT_CHAR_LIMIT = 140_000;

const songMetadataSchema = z.object({
	title: z.string(),
	artist: z.string(),
});

const translationLineSchema = z.object({
	original: z.string(),
	translation: z.string(),
});

const translationLineWithIdSchema = translationLineSchema.extend({
	id: z.number().int(),
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

const generatedTeachStateSchema = z.object({
	songMetadata: songMetadataSchema,
	lyricsLines: z.array(z.string()),
	translations: z.array(translationLineWithIdSchema),
	vocabularyExplanations: z.array(explanationSchema),
});

const persistedTeachStateSchema = generatedTeachStateSchema.extend({
	dbRunId: z.number().int().optional(),
	dbSongId: z.number().int().optional(),
});

const translateSongWorkflowInputSchema = z.object({
	url: z.string().url(),
	modelId: z.enum(SONG_GENERATION_MODEL_IDS),
});

const fetchSourceOutputSchema = z.object({
	sourceUrl: z.string().url(),
	title: z.string(),
	sourceMarkdown: z.string(),
	method: z.string().nullable(),
	tokens: z.number().nullable(),
});

const metadataAndLyricsOutputSchema = fetchSourceOutputSchema.extend({
	songMetadata: songMetadataSchema,
	lyricsLines: z.array(z.string()),
});

const translationsOutputSchema = metadataAndLyricsOutputSchema.extend({
	translations: z.array(translationLineWithIdSchema),
});

const explanationsOutputSchema = translationsOutputSchema.extend({
	vocabularyExplanations: z.array(explanationSchema),
});

type SongMetadata = z.infer<typeof songMetadataSchema>;
type TranslationLine = z.infer<typeof translationLineWithIdSchema>;
type ExplanationLine = z.infer<typeof explanationSchema>;
type GeneratedTeachState = z.infer<typeof generatedTeachStateSchema>;
type TranslateSongWorkflowInput = z.infer<
	typeof translateSongWorkflowInputSchema
>;
type FetchSourceOutput = z.infer<typeof fetchSourceOutputSchema>;
type MetadataAndLyricsOutput = z.infer<typeof metadataAndLyricsOutputSchema>;
type TranslationsOutput = z.infer<typeof translationsOutputSchema>;

const GENERATION_SYSTEM_PROMPT = [
	"You are a strict Japanese-learning content generator.",
	"Return structured output only.",
	"Do not omit required keys.",
].join("\n");

const METADATA_EXTRACTION_GUIDANCE = [
	"Metadata extraction guidance:",
	"- songMetadata.title should be the song title only.",
	"- songMetadata.artist should be the artist only.",
	"- Remove site suffixes like '| Genius Lyrics', 'Lyrics', or branding text.",
] as const;

const LYRICS_EXTRACTION_RULES = [
	"Rules for lyrics extraction:",
	"- Extract only lyric lines in singing order.",
	"- Remove numbering, metadata labels, menu text, ads, and unrelated page text.",
	"- Remove section headers like [Verse], [Chorus], [Bridge], [Outro].",
	"- Remove UI strings like Share, Embed, Contributors, About, Translations tabs.",
	"- Keep repeated chorus lines if they appear in lyrics.",
	"- Keep each output item to one logical sung lyric line.",
	"- If source markdown merges multiple lyric lines into one paragraph, bracket block, or link text, split them into separate lyric lines in singing order.",
	"- Avoid paragraph-length lyric entries; split long merged text at natural lyric boundaries when the split still reads like actual sung lines.",
	"- Keep romanized Japanese lines exactly as they appear (except trimming whitespace and numbering).",
] as const;

const TRANSLATION_AND_TEACHING_RULES = [
	"Rules for translation and teaching:",
	"- One translation per lyric line, preserve exact original line text.",
	"- One explanation entry per translation line.",
	"- Explain grammar/forms in beginner-friendly plain English.",
	"- Vocabulary can be words or phrase chunks.",
	"- Prefer phrase chunks when they teach form better (e.g., motte kita, you ni).",
	"- longFormExplanation should explain what each important chunk does in the sentence.",
] as const;

const CORE_REQUIREMENTS = [
	"Core requirements:",
	"- Do not skip lyric lines.",
	"- translationId is zero-based and must match the id in translations.",
	"- Keep original text unchanged for lyrics and translations.",
	"- Explanations must teach beginner-friendly grammar/form chunks.",
] as const;

const FEW_SHOT_EXAMPLE_A = [
	"Few-shot example A (metadata + lyrics extraction):",
	"Input page title: Sayuri - Tower of Flower Lyrics (Romanized) | Hana no Tou [花の塔] - Lyrical Nonsense",
	"Input fragments:",
	"1. Alternate Title: Hana no Tou",
	"2. Artist: Sayuri",
	"3. 1. Kimi ga motte kita manga",
	"4. 2. Kureta shiranai namae no ohana",
	"5. Share",
	"Expected tool payloads:",
	'set_song_metadata_state -> {"songMetadata":{"title":"Tower of Flower","artist":"Sayuri"}}',
	'set_lyrics_lines_state -> {"lyricsLines":["Kimi ga motte kita manga","Kureta shiranai namae no ohana"]}',
] as const;

const FEW_SHOT_EXAMPLE_D = [
	"Few-shot example D (split merged lyric blocks into natural lines):",
	"Input fragments:",
	String.raw`1. \[Verse 1\]`,
	String.raw`2. [Koyoi mo zujou de wa kireina mangetsu ga kirakira Shiawase sou ni sekai wo terashiteiru Touno watashi wa dekisokonai de dou shiyou mo nakute Yoake yumemite wa jibeta haizurimawatteru](/example-link)`,
	"Expected tool payload:",
	'set_lyrics_lines_state -> {"lyricsLines":["Koyoi mo zujou de wa kireina mangetsu ga kirakira","Shiawase sou ni sekai wo terashiteiru","Touno watashi wa dekisokonai de dou shiyou mo nakute","Yoake yumemite wa jibeta haizurimawatteru"]}',
] as const;

const FEW_SHOT_EXAMPLE_B = [
	"Few-shot example B (teaching style you MUST follow):",
	"Original: Kimi ga motte kita manga",
	"Translation: The manga that you brought",
	"Good longFormExplanation: \"Kimi means 'you'. Particle ga marks kimi as subject. motte kita is from motte kuru (to bring), where motte is te-form of motsu and kita is past of kuru, so together it means 'brought'. manga is 'comic/manga'.\"",
	'Good vocabularies: [{"original":"kimi","explanation":"you"},{"original":"ga","explanation":"subject marker"},{"original":"motte kita","explanation":"past form chunk from motte kuru, meaning \'brought\'"},{"original":"manga","explanation":"comic/manga"}]',
] as const;

const FEW_SHOT_EXAMPLE_C = [
	"Few-shot example C (teaching style you MUST follow):",
	"Original: Nakanu you ni",
	"Translation: So that I won't cry",
	"Good longFormExplanation: \"Nakanu is a literary/soft negative form related to nakanai (not cry). you ni means 'so that' or 'in order to'. As a chunk, nakanu you ni expresses purpose/prevention: doing something so crying does not happen.\"",
	'Good vocabularies: [{"original":"nakanu","explanation":"negative form meaning \'not cry\'"},{"original":"you ni","explanation":"so that / in order to"}]',
] as const;

function logCliDebug(step: string, data: Record<string, unknown> = {}) {
	console.log(`[translate-song:${step}]`, data);
}

function formatCliError(error: unknown) {
	if (error instanceof Error) {
		const errorWithCause = error as Error & { cause?: unknown };
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
			cause: errorWithCause.cause,
		};
	}

	return { error };
}

function normalizeLine(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function truncateForPrompt(text: string, maxChars: number): string {
	if (text.length <= maxChars) {
		return text;
	}

	return `${text.slice(0, maxChars)}\n# [truncated due to size]`;
}

function normalizeSongMetadata(songMetadata: SongMetadata): SongMetadata {
	const title = normalizeLine(songMetadata.title);
	const artist = normalizeLine(songMetadata.artist);

	if (!title || !artist) {
		throw new Error("title and artist are required and cannot be empty.");
	}

	return { title, artist };
}

function normalizeLyricsLines(lyricsLines: string[]): string[] {
	const normalized = lyricsLines
		.map(normalizeLine)
		.filter((line) => line.length > 0);

	if (normalized.length === 0) {
		throw new Error(
			"No lyric lines provided. Provide at least one lyric line.",
		);
	}

	return normalized;
}

function normalizeTranslations(
	translations: z.infer<typeof translationLineSchema>[],
	lyrics: string[],
): TranslationLine[] {
	if (translations.length !== lyrics.length) {
		throw new Error(
			`Please provide exactly ${lyrics.length} translation entries (one per lyric line).`,
		);
	}

	for (let i = 0; i < translations.length; i += 1) {
		const expectedOriginal = lyrics[i];
		const original = normalizeLine(translations[i].original);
		if (original !== expectedOriginal) {
			throw new Error(
				`translations[${i}].original must exactly match lyricsLines[${i}].`,
			);
		}
	}

	return translations.map((line, id) => ({
		id,
		original: normalizeLine(line.original),
		translation: normalizeLine(line.translation),
	}));
}

function normalizeVocabularyExplanations(
	vocabularyExplanations: ExplanationLine[],
	translations: TranslationLine[],
): ExplanationLine[] {
	if (vocabularyExplanations.length !== translations.length) {
		throw new Error(
			`Please provide exactly ${translations.length} explanation entries (one per translation line).`,
		);
	}

	const validIds = new Set(translations.map((line) => line.id));
	const seen = new Set<number>();

	for (const entry of vocabularyExplanations) {
		if (!validIds.has(entry.translationId)) {
			throw new Error(
				`Invalid translationId ${entry.translationId}. Use ids from translations.`,
			);
		}

		if (seen.has(entry.translationId)) {
			throw new Error(
				`Duplicate translationId ${entry.translationId}. Provide exactly one explanation per translation line.`,
			);
		}

		seen.add(entry.translationId);
	}

	const missingIds = translations
		.map((line) => line.id)
		.filter((id) => !seen.has(id));
	if (missingIds.length > 0) {
		throw new Error(
			`Missing explanation entries for translationId: ${missingIds.join(", ")}`,
		);
	}

	return vocabularyExplanations.map((entry) => ({
		translationId: entry.translationId,
		longFormExplanation: normalizeLine(entry.longFormExplanation),
		vocabularies: entry.vocabularies
			.map((vocab) => ({
				original: normalizeLine(vocab.original),
				explanation: normalizeLine(vocab.explanation),
			}))
			.filter((vocab) => vocab.original && vocab.explanation),
	}));
}

function formatNumberedLines(lines: string[]): string[] {
	return lines.map((line, index) => `${index + 1}. ${line}`);
}

function toError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof error.message === "string"
	) {
		const wrappedError = new Error(error.message);
		if ("name" in error && typeof error.name === "string") {
			wrappedError.name = error.name;
		}

		return wrappedError;
	}

	return new Error(String(error));
}

function buildMetadataAndLyricsPrompt(input: FetchSourceOutput): string {
	return [
		"Task: generate Japanese-learning output from this page markdown.",
		"Return only the song metadata and cleaned lyric lines for this step.",
		"Required output shape for this step:",
		'{"songMetadata":{"title":"string","artist":"string"},"lyricsLines":["string"]}',
		"Both top-level keys are required.",
		"Do not omit lyricsLines.",
		"",
		...METADATA_EXTRACTION_GUIDANCE,
		"",
		...LYRICS_EXTRACTION_RULES,
		"",
		...FEW_SHOT_EXAMPLE_A,
		"",
		...FEW_SHOT_EXAMPLE_D,
		"",
		`Page URL: ${input.sourceUrl}`,
		`Page title: ${input.title}`,
		"",
		"Source markdown:",
		input.sourceMarkdown,
	].join("\n");
}

type MetadataAndLyricsSourceInput = {
	sourceUrl: string;
	title: string;
	sourceMarkdown: string;
	method?: string | null;
	tokens?: number | null;
};

export async function extractMetadataAndLyricsFromSource(
	input: MetadataAndLyricsSourceInput,
	modelId: SongGenerationModelId,
): Promise<MetadataAndLyricsOutput> {
	const prompt = buildMetadataAndLyricsPrompt({
		method: input.method ?? null,
		sourceMarkdown: input.sourceMarkdown,
		sourceUrl: input.sourceUrl,
		title: input.title,
		tokens: input.tokens ?? null,
	});

	logCliDebug("workflow_step_start", {
		step: "extract_metadata_and_lyrics",
		promptLength: prompt.length,
		promptPreview: prompt.slice(0, 600),
	});

	const result = await generateText({
		model: fireworks(modelId),
		system: GENERATION_SYSTEM_PROMPT,
		output: Output.object({
			schema: z.object({
				songMetadata: songMetadataSchema,
				lyricsLines: z.array(z.string()),
			}),
			name: "metadata_and_lyrics",
			description:
				"Song metadata plus all cleaned lyric lines from the source page.",
		}),
		prompt,
	});

	const songMetadata = normalizeSongMetadata(result.output.songMetadata);
	const lyricsLines = normalizeLyricsLines(result.output.lyricsLines);

	logCliDebug("workflow_step_success", {
		step: "extract_metadata_and_lyrics",
		hasSongMetadata: true,
		lyricsLineCount: lyricsLines.length,
	});

	return {
		method: input.method ?? null,
		songMetadata,
		sourceMarkdown: input.sourceMarkdown,
		sourceUrl: input.sourceUrl,
		title: input.title,
		tokens: input.tokens ?? null,
		lyricsLines,
	};
}

function buildTranslationsPrompt(input: MetadataAndLyricsOutput): string {
	return [
		"Task: generate Japanese-learning output from this page markdown.",
		"Return only translations for every lyric line in order for this step.",
		"Required output shape for this step:",
		'{"translations":[{"original":"string","translation":"string"}]}',
		"The translations key is required.",
		"Return exactly one translation object per lyric line.",
		"",
		...CORE_REQUIREMENTS.filter((line) => line !== "Core requirements:"),
		"",
		...TRANSLATION_AND_TEACHING_RULES,
		"",
		...FEW_SHOT_EXAMPLE_B,
		"",
		...FEW_SHOT_EXAMPLE_C,
		"",
		`Song title: ${input.songMetadata.title}`,
		`Artist: ${input.songMetadata.artist}`,
		"",
		"Lyric lines:",
		...formatNumberedLines(input.lyricsLines),
	].join("\n");
}

function buildExplanationsPrompt(input: TranslationsOutput): string {
	const translationLinesForPrompt = input.translations.flatMap((line) => [
		`${line.id}. Original: ${line.original}`,
		`   Translation: ${line.translation}`,
	]);

	return [
		"Task: generate Japanese-learning output from this page markdown.",
		"Return only the explanation entries for this step.",
		"Required output shape for this step:",
		'{"vocabularyExplanations":[{"translationId":0,"longFormExplanation":"string","vocabularies":[{"original":"string","explanation":"string"}]}]}',
		"The vocabularyExplanations key is required.",
		"Return exactly one explanation entry per translation line.",
		"",
		...CORE_REQUIREMENTS,
		"",
		...TRANSLATION_AND_TEACHING_RULES,
		"",
		...FEW_SHOT_EXAMPLE_B,
		"",
		...FEW_SHOT_EXAMPLE_C,
		"",
		`Song title: ${input.songMetadata.title}`,
		`Artist: ${input.songMetadata.artist}`,
		"",
		"Translations to explain:",
		...translationLinesForPrompt,
	].join("\n");
}

async function saveGeneratedSong(
	state: GeneratedTeachState,
	sourceUrl: string,
	modelId: SongGenerationModelId,
): Promise<{ runId: number; songId: number }> {
	const songMetadata = state.songMetadata;

	return db.transaction(async (tx) => {
		const [song] = await tx
			.insert(songs)
			.values({
				title: songMetadata.title,
				artist: songMetadata.artist,
			})
			.returning({ id: songs.id });

		if (!song) {
			throw new Error("Failed to insert song row.");
		}

		const [run] = await tx
			.insert(translationRuns)
			.values({
				songId: song.id,
				sourceUrl,
				modelId,
			})
			.returning({ id: translationRuns.id });

		if (!run) {
			throw new Error("Failed to insert translation run row.");
		}

		const lineRows = state.lyricsLines.map((line, index) => ({
			runId: run.id,
			lineIndex: index,
			originalText: line,
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
				lyricLineId,
				translationText: line.translation,
				longFormExplanation:
					state.vocabularyExplanations[line.id]?.longFormExplanation ?? "",
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

			return entry.vocabularies.map((vocab, vocabIndex) => ({
				translationLineId,
				vocabIndex,
				originalText: vocab.original,
				explanation: vocab.explanation,
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

		return { songId: song.id, runId: run.id };
	});
}

const fetchSourceStep = createStep({
	id: "fetch-source",
	inputSchema: translateSongWorkflowInputSchema,
	outputSchema: fetchSourceOutputSchema,
	execute: async ({ inputData }) => {
		const source = await fetchMarkdownSource(inputData.url);
		const sourceMarkdown = truncateForPrompt(
			source.markdown,
			SOURCE_MARKDOWN_PROMPT_CHAR_LIMIT,
		);

		logCliDebug("markdown_fetched", {
			pageTitle: source.title,
			pageUrl: source.sourceUrl,
			markdownCharCount: source.markdown.length,
			method: source.method,
			tokens: source.tokens,
		});

		return {
			sourceMarkdown,
			sourceUrl: source.sourceUrl,
			title: source.title,
			method: source.method,
			tokens: source.tokens,
		};
	},
});

const extractMetadataAndLyricsStep = createStep({
	id: "extract-metadata-and-lyrics",
	inputSchema: fetchSourceOutputSchema,
	outputSchema: metadataAndLyricsOutputSchema,
	execute: async ({ getInitData, inputData }) => {
		const { modelId } = getInitData<TranslateSongWorkflowInput>();
		return extractMetadataAndLyricsFromSource(inputData, modelId);
	},
});

const generateTranslationsStep = createStep({
	id: "generate-translations",
	inputSchema: metadataAndLyricsOutputSchema,
	outputSchema: translationsOutputSchema,
	execute: async ({ getInitData, inputData }) => {
		const { modelId } = getInitData<TranslateSongWorkflowInput>();
		const prompt = buildTranslationsPrompt(inputData);

		logCliDebug("workflow_step_start", {
			step: "generate_translations",
			promptLength: prompt.length,
			promptPreview: prompt.slice(0, 600),
		});

		const result = await generateText({
			model: fireworks(modelId),
			system: GENERATION_SYSTEM_PROMPT,
			output: Output.object({
				schema: z.object({
					translations: z.array(translationLineSchema),
				}),
				name: "translations",
				description: "One translation per lyric line in the same order.",
			}),
			prompt,
		});

		const translations = normalizeTranslations(
			result.output.translations,
			inputData.lyricsLines,
		);

		logCliDebug("workflow_step_success", {
			step: "generate_translations",
			translationCount: translations.length,
		});

		return {
			...inputData,
			translations,
		};
	},
});

const generateExplanationsStep = createStep({
	id: "generate-explanations",
	inputSchema: translationsOutputSchema,
	outputSchema: explanationsOutputSchema,
	execute: async ({ getInitData, inputData }) => {
		const { modelId } = getInitData<TranslateSongWorkflowInput>();
		const prompt = buildExplanationsPrompt(inputData);

		logCliDebug("workflow_step_start", {
			step: "generate_explanations",
			promptLength: prompt.length,
			promptPreview: prompt.slice(0, 600),
		});

		const result = await generateText({
			model: fireworks(modelId),
			system: GENERATION_SYSTEM_PROMPT,
			output: Output.object({
				schema: z.object({
					vocabularyExplanations: z.array(explanationSchema),
				}),
				name: "vocabulary_explanations",
				description:
					"Beginner-friendly explanations for each translated lyric line.",
			}),
			prompt,
		});

		const vocabularyExplanations = normalizeVocabularyExplanations(
			result.output.vocabularyExplanations,
			inputData.translations,
		);

		logCliDebug("workflow_step_success", {
			step: "generate_explanations",
			explanationCount: vocabularyExplanations.length,
		});

		return {
			...inputData,
			vocabularyExplanations,
		};
	},
});

const persistSongStep = createStep({
	id: "persist-song",
	inputSchema: explanationsOutputSchema,
	outputSchema: persistedTeachStateSchema,
	execute: async ({ getInitData, inputData }) => {
		const { modelId } = getInitData<TranslateSongWorkflowInput>();
		const state: GeneratedTeachState = {
			songMetadata: inputData.songMetadata,
			lyricsLines: inputData.lyricsLines,
			translations: inputData.translations,
			vocabularyExplanations: inputData.vocabularyExplanations,
		};

		const saved = await saveGeneratedSong(state, inputData.sourceUrl, modelId);

		return {
			...state,
			dbRunId: saved.runId,
			dbSongId: saved.songId,
		};
	},
});

const translateSongWorkflow = createWorkflow({
	id: "translate-song",
	inputSchema: translateSongWorkflowInputSchema,
	outputSchema: persistedTeachStateSchema,
})
	.then(fetchSourceStep)
	.then(extractMetadataAndLyricsStep)
	.then(generateTranslationsStep)
	.then(generateExplanationsStep)
	.then(persistSongStep)
	.commit();

export async function runTranslateSong(
	url: string,
	modelId: SongGenerationModelId,
): Promise<void> {
	logCliDebug("run_start", { modelId, url });
	if (!process.env.FIREWORKS_API_KEY) {
		throw new Error(
			"Missing FIREWORKS_API_KEY. Add it to .env (see .env.example).",
		);
	}

	const workflowRun = await translateSongWorkflow.createRun();
	const workflowResult = await workflowRun.start({
		inputData: { modelId, url },
	});

	if (workflowResult.status !== "success") {
		logCliDebug("workflow_failure", {
			error:
				workflowResult.status === "failed"
					? formatCliError(workflowResult.error)
					: undefined,
			status: workflowResult.status,
			stepExecutionPath: workflowResult.stepExecutionPath,
		});

		if (workflowResult.status === "failed") {
			throw toError(workflowResult.error);
		}

		throw new Error(
			`Translate-song workflow ended with status "${workflowResult.status}".`,
		);
	}

	logCliDebug("workflow_success", {
		hasSongMetadata: Boolean(workflowResult.result.songMetadata),
		lyricsLineCount: workflowResult.result.lyricsLines.length,
		translationCount: workflowResult.result.translations.length,
		explanationCount: workflowResult.result.vocabularyExplanations.length,
		dbRunId: workflowResult.result.dbRunId,
		dbSongId: workflowResult.result.dbSongId,
	});

	process.stdout.write(`${JSON.stringify(workflowResult.result, null, 2)}\n`);
}
