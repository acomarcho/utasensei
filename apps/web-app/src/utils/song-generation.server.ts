import "dotenv/config";
import { fireworks } from "@ai-sdk/fireworks";
import { stepCountIs, ToolLoopAgent, tool } from "ai";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { SongGenerationStreamEvent } from "~/data/ai-studio";
import { db } from "~/utils/db/client.server";
import {
	flashcards,
	lyricLines,
	songs,
	translationLines,
	translationRuns,
	vocabEntries,
} from "~/utils/db/schema";
import { fetchMarkdownSource } from "~/utils/markdown-source.server";
import {
	DEFAULT_SONG_GENERATION_MODEL_ID,
	type SongGenerationModelId,
} from "~/utils/song-generation-models";

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

const vocabularySchema = z.object({
	original: z.string(),
	explanation: z.string(),
});

const explanationSchema = z.object({
	translationId: z.number().int(),
	longFormExplanation: z.string(),
	vocabularies: z.array(vocabularySchema),
});

type SongMetadata = z.infer<typeof songMetadataSchema>;
type TranslationLine = z.infer<typeof translationLineSchema> & { id: number };
type ExplanationLine = z.infer<typeof explanationSchema>;

type TeachState = {
	songMetadata: SongMetadata | null;
	lyricsLines: string[];
	translations: TranslationLine[];
	vocabularyExplanations: ExplanationLine[];
	dbRunId?: number;
	dbSongId?: number;
};

type SavedSongResult = {
	runId: number;
	songId: number;
};

type SongGenerationProgressCallback = (
	event: SongGenerationStreamEvent,
) => void | Promise<void>;

function logGenerationDebug(step: string, data: Record<string, unknown> = {}) {
	console.log(`[song-generation:${step}]`, data);
}

function formatGenerationError(error: unknown) {
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

function createStatusEvent(
	step:
		| "fetching_song_lyrics"
		| "extracting_lyrics"
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

async function reportStatus(
	onProgress: SongGenerationProgressCallback | undefined,
	step:
		| "fetching_song_lyrics"
		| "extracting_lyrics"
		| "generating_translation"
		| "generating_explanations"
		| "generating_flashcards",
	message: string,
) {
	if (!onProgress) {
		return;
	}

	await onProgress(createStatusEvent(step, message));
}

async function saveGeneratedSong(
	state: TeachState,
	sourceUrl: string,
	modelId: SongGenerationModelId,
): Promise<SavedSongResult> {
	const songMetadata = state.songMetadata;
	if (!songMetadata) {
		throw new Error("Song metadata missing after agent run.");
	}

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

export async function generateSongFromUrl(
	rawUrl: string,
	options: {
		modelId?: SongGenerationModelId;
		onProgress?: SongGenerationProgressCallback;
	} = {},
): Promise<{ flashcardCount: number; runId: number; songId: number }> {
	const { modelId = DEFAULT_SONG_GENERATION_MODEL_ID, onProgress } = options;
	const url = rawUrl.trim();
	if (!url) {
		throw new Error("A song URL is required.");
	}

	if (!process.env.FIREWORKS_API_KEY) {
		throw new Error(
			"Missing FIREWORKS_API_KEY. Add it to your environment before generating songs.",
		);
	}

	await reportStatus(
		onProgress,
		"fetching_song_lyrics",
		"Fetching markdown from markdown.new...",
	);

	const source = await fetchMarkdownSource(url);
	const sourceMarkdown = truncateForPrompt(
		source.markdown,
		SOURCE_MARKDOWN_PROMPT_CHAR_LIMIT,
	);

	await reportStatus(onProgress, "extracting_lyrics", "Extracting lyrics...");

	logGenerationDebug("markdown_fetched", {
		pageTitle: source.title,
		pageUrl: source.sourceUrl,
		markdownCharCount: source.markdown.length,
		method: source.method,
		tokens: source.tokens,
	});

	const state: TeachState = {
		songMetadata: null,
		lyricsLines: [],
		translations: [],
		vocabularyExplanations: [],
	};

	let hasReportedTranslation = false;
	let hasReportedExplanations = false;

	const agent = new ToolLoopAgent({
		model: fireworks(modelId),
		stopWhen: stepCountIs(12),
		instructions: [
			"You are a strict Japanese-learning content generator that MUST update state via tools.",
			"Use tool calls, not plain text, to produce the result.",
			"Hard requirements:",
			"- Call set_song_metadata_state first, exactly once.",
			"- Call set_lyrics_lines_state second, exactly once.",
			"- Call set_translation_state third, exactly once.",
			"- Call set_vocab_explanations_state fourth, exactly once.",
			"- Do not skip lyric lines.",
			"- translationId is zero-based and must match the id in state.translations.",
			"- Keep original text unchanged for lyrics and translations.",
			"- Explanations must teach beginner-friendly grammar/form chunks.",
		].join("\n"),
		tools: {
			set_song_metadata_state: tool({
				description: "Set song metadata (title and artist) from page content.",
				inputSchema: z.object({ songMetadata: songMetadataSchema }),
				execute: async ({ songMetadata }) => {
					logGenerationDebug("tool_call", {
						tool: "set_song_metadata_state",
						songMetadata,
					});
					const title = normalizeLine(songMetadata.title);
					const artist = normalizeLine(songMetadata.artist);
					if (!title || !artist) {
						return "title and artist are required and cannot be empty.";
					}

					state.songMetadata = { title, artist };
					return state;
				},
			}),
			set_lyrics_lines_state: tool({
				description:
					"Set cleaned lyric lines extracted from the page. Keep order, remove navigation/noise/metadata.",
				inputSchema: z.object({ lyricsLines: z.array(z.string()) }),
				execute: async ({ lyricsLines }) => {
					logGenerationDebug("tool_call", {
						tool: "set_lyrics_lines_state",
						lyricsLineCount: lyricsLines.length,
					});
					if (!state.songMetadata) {
						return "Please call set_song_metadata_state first before using this tool.";
					}

					const normalized = lyricsLines
						.map(normalizeLine)
						.filter((line) => line.length > 0);

					if (normalized.length === 0) {
						return "No lyric lines provided. Provide at least one lyric line.";
					}

					state.lyricsLines = normalized;
					state.translations = [];
					state.vocabularyExplanations = [];

					if (!hasReportedTranslation) {
						hasReportedTranslation = true;
						await reportStatus(
							onProgress,
							"generating_translation",
							"Generating translations...",
						);
					}

					return state;
				},
			}),
			set_translation_state: tool({
				description:
					"Set translation state from lyric lines. Must include exactly one translation per lyric line in order.",
				inputSchema: z.object({
					translations: z.array(translationLineSchema),
				}),
				execute: async ({ translations }) => {
					logGenerationDebug("tool_call", {
						tool: "set_translation_state",
						translationCount: translations.length,
					});
					if (!state.songMetadata) {
						return "Please call set_song_metadata_state first before using this tool.";
					}
					if (state.lyricsLines.length === 0) {
						return "Please call set_lyrics_lines_state first before using this tool.";
					}
					if (translations.length !== state.lyricsLines.length) {
						return `Please provide exactly ${state.lyricsLines.length} translation entries (one per lyric line).`;
					}

					for (let i = 0; i < translations.length; i += 1) {
						const expectedOriginal = state.lyricsLines[i];
						const original = normalizeLine(translations[i].original);
						if (original !== expectedOriginal) {
							return `translations[${i}].original must exactly match lyricsLines[${i}].`;
						}
					}

					state.translations = translations.map((line, id) => ({
						id,
						original: normalizeLine(line.original),
						translation: normalizeLine(line.translation),
					}));
					state.vocabularyExplanations = [];

					if (!hasReportedExplanations) {
						hasReportedExplanations = true;
						await reportStatus(
							onProgress,
							"generating_explanations",
							"Generating explanations and vocabulary notes...",
						);
					}

					return state;
				},
			}),
			set_vocab_explanations_state: tool({
				description:
					"Set vocabulary explanations for each translation line. Must include exactly one entry per translation id.",
				inputSchema: z.object({
					vocabularyExplanations: z.array(explanationSchema),
				}),
				execute: async ({ vocabularyExplanations }) => {
					logGenerationDebug("tool_call", {
						tool: "set_vocab_explanations_state",
						explanationCount: vocabularyExplanations.length,
					});
					if (state.translations.length === 0) {
						return "Please call set_translation_state first before using this tool.";
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

					state.vocabularyExplanations = vocabularyExplanations.map(
						(entry) => ({
							translationId: entry.translationId,
							longFormExplanation: normalizeLine(entry.longFormExplanation),
							vocabularies: entry.vocabularies
								.map((vocab) => ({
									original: normalizeLine(vocab.original),
									explanation: normalizeLine(vocab.explanation),
								}))
								.filter((vocab) => vocab.original && vocab.explanation),
						}),
					);

					return state;
				},
			}),
		},
	});

	const prompt = [
		"Task: generate Japanese-learning output from this page markdown.",
		"You must call tools in this order:",
		"1) set_song_metadata_state",
		"2) set_lyrics_lines_state",
		"3) set_translation_state",
		"4) set_vocab_explanations_state",
		"",
		"Important sequencing constraints:",
		"- Do not skip any tool.",
		"- Do not call tools out of order.",
		"- Do not finalize early.",
		"",
		"Metadata extraction guidance:",
		"- songMetadata.title should be the song title only.",
		"- songMetadata.artist should be the artist only.",
		"- Remove site suffixes like '| Genius Lyrics', 'Lyrics', or branding text.",
		"",
		"Rules for lyrics extraction:",
		"- Extract only lyric lines in singing order.",
		"- Remove numbering, metadata labels, menu text, ads, and unrelated page text.",
		"- Remove section headers like [Verse], [Chorus], [Bridge], [Outro].",
		"- Remove UI strings like Share, Embed, Contributors, About, Translations tabs.",
		"- Keep repeated chorus lines if they appear in lyrics.",
		"- Keep each lyric line as a single cleaned string.",
		"- Keep romanized Japanese lines exactly as they appear (except trimming whitespace and numbering).",
		"",
		"Rules for translation and teaching:",
		"- One translation per lyric line, preserve exact original line text.",
		"- One explanation entry per translation line.",
		"- Explain grammar/forms in beginner-friendly plain English.",
		"- Vocabulary can be words or phrase chunks.",
		"- Prefer phrase chunks when they teach form better (e.g., motte kita, you ni).",
		"- longFormExplanation should explain what each important chunk does in the sentence.",
		"",
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
		"",
		"Few-shot example B (teaching style you MUST follow):",
		"Original: Kimi ga motte kita manga",
		"Translation: The manga that you brought",
		"Good longFormExplanation: \"Kimi means 'you'. Particle ga marks kimi as subject. motte kita is from motte kuru (to bring), where motte is te-form of motsu and kita is past of kuru, so together it means 'brought'. manga is 'comic/manga'.\"",
		'Good vocabularies: [{"original":"kimi","explanation":"you"},{"original":"ga","explanation":"subject marker"},{"original":"motte kita","explanation":"past form chunk from motte kuru, meaning \'brought\'"},{"original":"manga","explanation":"comic/manga"}]',
		"",
		"Few-shot example C (teaching style you MUST follow):",
		"Original: Nakanu you ni",
		"Translation: So that I won't cry",
		"Good longFormExplanation: \"Nakanu is a literary/soft negative form related to nakanai (not cry). you ni means 'so that' or 'in order to'. As a chunk, nakanu you ni expresses purpose/prevention: doing something so crying does not happen.\"",
		'Good vocabularies: [{"original":"nakanu","explanation":"negative form meaning \'not cry\'"},{"original":"you ni","explanation":"so that / in order to"}]',
		"",
		`Page URL: ${source.sourceUrl}`,
		`Page title: ${source.title}`,
		"",
		"Source markdown:",
		sourceMarkdown,
	].join("\n");

	logGenerationDebug("agent_generate_start", {
		modelId,
		promptLength: prompt.length,
		promptPreview: prompt.slice(0, 600),
	});

	try {
		await agent.generate({ prompt });
		logGenerationDebug("agent_generate_success", {
			hasSongMetadata: Boolean(state.songMetadata),
			lyricsLineCount: state.lyricsLines.length,
			translationCount: state.translations.length,
			explanationCount: state.vocabularyExplanations.length,
		});
	} catch (error) {
		console.error("[song-generation:agent_generate_failure]", {
			error: formatGenerationError(error),
			modelId,
			promptLength: prompt.length,
			promptPreview: prompt.slice(0, 600),
			stateSnapshot: {
				hasSongMetadata: Boolean(state.songMetadata),
				lyricsLineCount: state.lyricsLines.length,
				translationCount: state.translations.length,
				explanationCount: state.vocabularyExplanations.length,
			},
		});
		throw error;
	}

	if (!state.songMetadata) {
		throw new Error("Agent did not set songMetadata state.");
	}
	if (state.lyricsLines.length === 0) {
		throw new Error("Agent did not set lyricsLines state.");
	}
	if (state.translations.length !== state.lyricsLines.length) {
		throw new Error(
			`Agent did not set full translations state. Expected ${state.lyricsLines.length}, got ${state.translations.length}.`,
		);
	}
	if (state.vocabularyExplanations.length !== state.lyricsLines.length) {
		throw new Error(
			`Agent did not set full vocabulary explanations state. Expected ${state.lyricsLines.length}, got ${state.vocabularyExplanations.length}.`,
		);
	}

	const saved = await saveGeneratedSong(state, source.sourceUrl, modelId);
	state.dbSongId = saved.songId;
	state.dbRunId = saved.runId;

	await reportStatus(
		onProgress,
		"generating_flashcards",
		"Generating flashcards...",
	);
	const flashcardCount = await buildFlashcardsForSong(saved.songId);

	return {
		flashcardCount,
		runId: saved.runId,
		songId: saved.songId,
	};
}
