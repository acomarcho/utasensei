import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import {
	flashcards,
	lyricLines,
	songs,
	translationLines,
	translationRuns,
	vocabEntries,
} from "../db/schema";

type SongAction = "list" | "delete";

type SongSummary = {
	id: number;
	title: string;
	artist: string;
	createdAt: number;
};

type SongDetails = {
	song: SongSummary;
	run: {
		id: number;
		sourceUrl: string;
		modelId: string;
		createdAt: number;
	};
	lines: Array<{
		lineIndex: number;
		originalText: string;
		translationText: string;
		longFormExplanation: string;
		vocabularies: Array<{ originalText: string; explanation: string }>;
	}>;
};

type DeleteSongResult = {
	song: SongSummary;
	deleted: {
		songs: number;
		translationRuns: number;
		lyricLines: number;
		translationLines: number;
		vocabEntries: number;
		flashcards: number;
	};
};

async function getSongSummary(songId: number): Promise<SongSummary> {
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
		throw new Error(`Song id ${songId} not found.`);
	}

	return song;
}

async function listSongs(): Promise<void> {
	const rows = await db
		.select({
			id: songs.id,
			title: songs.title,
			artist: songs.artist,
			createdAt: songs.createdAt,
		})
		.from(songs)
		.orderBy(songs.id);

	process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
}

async function getSongDetails(songId: number): Promise<void> {
	const song = await getSongSummary(songId);

	const [run] = await db
		.select({
			id: translationRuns.id,
			sourceUrl: translationRuns.sourceUrl,
			modelId: translationRuns.modelId,
			createdAt: translationRuns.createdAt,
		})
		.from(translationRuns)
		.where(eq(translationRuns.songId, songId))
		.orderBy(desc(translationRuns.createdAt), desc(translationRuns.id))
		.limit(1);

	if (!run) {
		throw new Error(`No translation runs found for song id ${songId}.`);
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
		throw new Error(`Failed to load translation run ${run.id}.`);
	}

	const lines = runWithLines.lyricLines.map((line) => ({
		lineIndex: line.lineIndex,
		originalText: line.originalText,
		translationText: line.translationLine?.translationText ?? "",
		longFormExplanation: line.translationLine?.longFormExplanation ?? "",
		vocabularies:
			line.translationLine?.vocabEntries.map((entry) => ({
				originalText: entry.originalText,
				explanation: entry.explanation,
			})) ?? [],
	}));

	const payload: SongDetails = {
		song,
		run,
		lines,
	};

	process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function deleteSong(songId: number): Promise<void> {
	const song = await getSongSummary(songId);

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

	const vocabEntryRows =
		translationLineIds.length > 0
			? await db
					.select({ id: vocabEntries.id })
					.from(vocabEntries)
					.where(inArray(vocabEntries.translationLineId, translationLineIds))
			: [];

	const flashcardRows =
		runIds.length > 0
			? await db
					.select({ id: flashcards.id })
					.from(flashcards)
					.where(inArray(flashcards.runId, runIds))
			: [];

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

	const payload: DeleteSongResult = {
		song,
		deleted: {
			songs: 1,
			translationRuns: runIds.length,
			lyricLines: lyricLineIds.length,
			translationLines: translationLineIds.length,
			vocabEntries: vocabEntryRows.length,
			flashcards: flashcardRows.length,
		},
	};

	process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

export async function runSongs(
	action: SongAction = "list",
	songId?: number,
): Promise<void> {
	if (action === "delete") {
		if (songId === undefined) {
			throw new Error("Song id is required for delete.");
		}

		await deleteSong(songId);
		return;
	}

	if (songId === undefined) {
		await listSongs();
		return;
	}

	await getSongDetails(songId);
}
