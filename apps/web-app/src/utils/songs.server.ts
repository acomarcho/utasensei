import { asc, desc, eq, inArray } from "drizzle-orm";
import type {
	FlashcardRun,
	SongLesson,
	SongListItem,
	SongPageData,
} from "~/data/ai-studio";
import { db } from "~/utils/db/client.server";
import {
	flashcards,
	lyricLines,
	songs,
	translationLines,
	translationRuns,
	vocabEntries,
} from "~/utils/db/schema";

async function getLatestRun(songId: number) {
	const [run] = await db
		.select({
			id: translationRuns.id,
			songId: translationRuns.songId,
			sourceUrl: translationRuns.sourceUrl,
			modelId: translationRuns.modelId,
			createdAt: translationRuns.createdAt,
		})
		.from(translationRuns)
		.where(eq(translationRuns.songId, songId))
		.orderBy(desc(translationRuns.createdAt), desc(translationRuns.id))
		.limit(1);

	return run ?? null;
}

export async function listSongsForLibrary(): Promise<SongListItem[]> {
	const rows = await db
		.select({
			id: songs.id,
			title: songs.title,
			artist: songs.artist,
		})
		.from(songs)
		.orderBy(desc(songs.createdAt), desc(songs.id));

	return rows;
}

export async function getSongLessonById(
	songId: number,
): Promise<SongLesson | null> {
	const [song] = await db
		.select({
			id: songs.id,
			title: songs.title,
			artist: songs.artist,
			createdAt: songs.createdAt,
		})
		.from(songs)
		.where(eq(songs.id, songId))
		.limit(1);

	if (!song) {
		return null;
	}

	const run = await getLatestRun(songId);
	if (!run) {
		return null;
	}

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
		return null;
	}

	return {
		song,
		run,
		lines: runWithLines.lyricLines.map((line) => ({
			lineIndex: line.lineIndex,
			originalText: line.originalText,
			translationText: line.translationLine?.translationText ?? "",
			longFormExplanation: line.translationLine?.longFormExplanation ?? "",
			vocabularies:
				line.translationLine?.vocabEntries.map((entry) => ({
					originalText: entry.originalText,
					explanation: entry.explanation,
				})) ?? [],
		})),
	};
}

export async function getFlashcardRunBySongId(
	songId: number,
): Promise<FlashcardRun | null> {
	const run = await getLatestRun(songId);
	if (!run) {
		return null;
	}

	const rows = await db
		.select({
			id: flashcards.id,
			runId: flashcards.runId,
			front: flashcards.front,
			back: flashcards.back,
			sourceTranslationLineId: flashcards.sourceTranslationLineId,
			sourceVocabEntryId: flashcards.sourceVocabEntryId,
			createdAt: flashcards.createdAt,
		})
		.from(flashcards)
		.where(eq(flashcards.runId, run.id))
		.orderBy(asc(flashcards.id));

	return {
		songId,
		runId: run.id,
		count: rows.length,
		cards: rows,
	};
}

export async function getSongPageData(songId: number): Promise<SongPageData> {
	const [songLesson, flashcardRun] = await Promise.all([
		getSongLessonById(songId),
		getFlashcardRunBySongId(songId),
	]);

	return {
		songLesson,
		flashcardRun,
	};
}

export async function deleteSongById(
	songId: number,
): Promise<{ songId: number }> {
	const [song] = await db
		.select({ id: songs.id })
		.from(songs)
		.where(eq(songs.id, songId))
		.limit(1);

	if (!song) {
		throw new Error(`Song id ${songId} not found.`);
	}

	const runRows = await db
		.select({ id: translationRuns.id })
		.from(translationRuns)
		.where(eq(translationRuns.songId, songId));
	const runIds = runRows.map((row) => row.id);

	const lyricLineRows =
		runIds.length > 0
			? await db
					.select({ id: lyricLines.id })
					.from(lyricLines)
					.where(inArray(lyricLines.runId, runIds))
			: [];
	const lyricLineIds = lyricLineRows.map((row) => row.id);

	const translationLineRows =
		lyricLineIds.length > 0
			? await db
					.select({ id: translationLines.id })
					.from(translationLines)
					.where(inArray(translationLines.lyricLineId, lyricLineIds))
			: [];
	const translationLineIds = translationLineRows.map((row) => row.id);

	await db.transaction(async (tx) => {
		if (runIds.length > 0) {
			await tx.delete(flashcards).where(inArray(flashcards.runId, runIds));
		}
		if (translationLineIds.length > 0) {
			await tx
				.delete(vocabEntries)
				.where(inArray(vocabEntries.translationLineId, translationLineIds));
		}
		if (lyricLineIds.length > 0) {
			await tx
				.delete(translationLines)
				.where(inArray(translationLines.lyricLineId, lyricLineIds));
		}
		if (runIds.length > 0) {
			await tx.delete(lyricLines).where(inArray(lyricLines.runId, runIds));
			await tx
				.delete(translationRuns)
				.where(eq(translationRuns.songId, songId));
		}
		await tx.delete(songs).where(eq(songs.id, songId));
	});

	return { songId };
}
