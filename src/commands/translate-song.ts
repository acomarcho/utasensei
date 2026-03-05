import { fireworks } from "@ai-sdk/fireworks";
import { stepCountIs, ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import {
	cleanHtmlTreeToYaml,
	collectOrderedTextSegments,
	extractCleanHtmlTree,
} from "../lib/clean-html";
import { db } from "../db/client";
import {
	lyricLines,
	songs,
	translationLines,
	translationRuns,
	vocabEntries,
} from "../db/schema";

// Keep CLI stdout clean JSON for piping/parsing.
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

function normalizeLine(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function compactSegments(segments: string[], limit: number): string[] {
	const out: string[] = [];

	for (const raw of segments) {
		const line = normalizeLine(raw);
		if (!line) {
			continue;
		}

		if (out[out.length - 1] === line) {
			continue;
		}

		out.push(line);
		if (out.length >= limit) {
			break;
		}
	}

	return out;
}

function truncateForPrompt(text: string, maxChars: number): string {
	if (text.length <= maxChars) {
		return text;
	}

	return `${text.slice(0, maxChars)}\n# [truncated due to size]`;
}

export async function runTranslateSong(url: string): Promise<void> {
	if (!process.env.FIREWORKS_API_KEY) {
		throw new Error(
			"Missing FIREWORKS_API_KEY. Add it to .env (see .env.example).",
		);
	}

	const cleanTree = await extractCleanHtmlTree(url, {
		maxDepth: 20,
		maxNodes: 3000,
	});
	const cleanYaml = truncateForPrompt(
		cleanHtmlTreeToYaml(cleanTree),
		CLEAN_YAML_PROMPT_CHAR_LIMIT,
	);
	const textSegments = compactSegments(
		collectOrderedTextSegments(cleanTree.nodes, TEXT_SEGMENT_LIMIT * 2),
		TEXT_SEGMENT_LIMIT,
	);

	const state: TeachState = {
		songMetadata: null,
		lyricsLines: [],
		translations: [],
		vocabularyExplanations: [],
	};

	const agent = new ToolLoopAgent({
		model: fireworks(MODEL_ID),
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

	const indexedSegments = textSegments
		.map((line, index) => `${index + 1}. ${line}`)
		.join("\n");

	await agent.generate({
		prompt: [
			"Task: generate Japanese-learning output from this webpage structure.",
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
			`Page URL: ${cleanTree.url}`,
			`Page title: ${cleanTree.title}`,
			"",
			"Clean text fragments (ordered):",
			indexedSegments,
			"",
			"Clean HTML YAML snapshot:",
			cleanYaml,
		].join("\n"),
	});

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

	const songMetadata = state.songMetadata;
	if (!songMetadata) {
		throw new Error("Song metadata missing after agent run.");
	}

	const saved = await db.transaction(async (tx) => {
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
				sourceUrl: cleanTree.url,
				modelId: MODEL_ID,
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

	state.dbSongId = saved.songId;
	state.dbRunId = saved.runId;

	process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
}
