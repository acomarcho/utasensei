import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  songs,
  translationRuns
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

  const runWithLines = await db.query.translationRuns.findFirst({
    where: eq(translationRuns.id, run.id),
    with: {
      lyricLines: {
        orderBy: (fields, operators) => operators.asc(fields.lineIndex),
        with: {
          translationLine: {
            with: {
              vocabEntries: {
                orderBy: (fields, operators) => operators.asc(fields.vocabIndex)
              }
            }
          }
        }
      }
    }
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
        explanation: entry.explanation
      })) ?? []
  }));

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
