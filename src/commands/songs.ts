import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import {
  lyricLines,
  songs,
  translationLines,
  translationRuns,
  vocabEntries
} from "../db/schema";

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

async function listSongs(): Promise<void> {
  const rows = await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      createdAt: songs.createdAt
    })
    .from(songs)
    .orderBy(songs.id);

  process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
}

async function getSongDetails(songId: number): Promise<void> {
  const [song] = await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      createdAt: songs.createdAt
    })
    .from(songs)
    .where(eq(songs.id, songId))
    .limit(1);

  if (!song) {
    throw new Error(`Song id ${songId} not found.`);
  }

  const [run] = await db
    .select({
      id: translationRuns.id,
      sourceUrl: translationRuns.sourceUrl,
      modelId: translationRuns.modelId,
      createdAt: translationRuns.createdAt
    })
    .from(translationRuns)
    .where(eq(translationRuns.songId, songId))
    .orderBy(desc(translationRuns.createdAt), desc(translationRuns.id))
    .limit(1);

  if (!run) {
    throw new Error(`No translation runs found for song id ${songId}.`);
  }

  const lyricRows = await db
    .select({
      id: lyricLines.id,
      lineIndex: lyricLines.lineIndex,
      originalText: lyricLines.originalText
    })
    .from(lyricLines)
    .where(eq(lyricLines.runId, run.id))
    .orderBy(lyricLines.lineIndex);

  const lyricIds = lyricRows.map((row) => row.id);
  const translationRows =
    lyricIds.length === 0
      ? []
      : await db
          .select({
            id: translationLines.id,
            lyricLineId: translationLines.lyricLineId,
            translationText: translationLines.translationText,
            longFormExplanation: translationLines.longFormExplanation
          })
          .from(translationLines)
          .where(inArray(translationLines.lyricLineId, lyricIds));

  const translationIds = translationRows.map((row) => row.id);
  const vocabRows =
    translationIds.length === 0
      ? []
      : await db
          .select({
            translationLineId: vocabEntries.translationLineId,
            vocabIndex: vocabEntries.vocabIndex,
            originalText: vocabEntries.originalText,
            explanation: vocabEntries.explanation
          })
          .from(vocabEntries)
          .where(inArray(vocabEntries.translationLineId, translationIds))
          .orderBy(vocabEntries.translationLineId, vocabEntries.vocabIndex);

  const translationByLyricId = new Map(
    translationRows.map((row) => [row.lyricLineId, row])
  );
  const vocabByTranslationId = new Map<number, Array<{ originalText: string; explanation: string }>>();

  for (const row of vocabRows) {
    const list = vocabByTranslationId.get(row.translationLineId) ?? [];
    list.push({ originalText: row.originalText, explanation: row.explanation });
    vocabByTranslationId.set(row.translationLineId, list);
  }

  const lines = lyricRows.map((line) => {
    const translation = translationByLyricId.get(line.id);
    if (!translation) {
      return {
        lineIndex: line.lineIndex,
        originalText: line.originalText,
        translationText: "",
        longFormExplanation: "",
        vocabularies: []
      };
    }

    return {
      lineIndex: line.lineIndex,
      originalText: line.originalText,
      translationText: translation.translationText,
      longFormExplanation: translation.longFormExplanation,
      vocabularies: vocabByTranslationId.get(translation.id) ?? []
    };
  });

  const payload: SongDetails = {
    song,
    run,
    lines
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

export async function runSongs(songId?: number): Promise<void> {
  if (songId === undefined) {
    await listSongs();
    return;
  }

  await getSongDetails(songId);
}
