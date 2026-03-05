import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  flashcards,
  songs,
  translationRuns
} from "../db/schema";

type FlashcardRow = {
  id: number;
  runId: number;
  front: string;
  back: string;
  sourceTranslationLineId: number | null;
  sourceVocabEntryId: number | null;
  createdAt: number;
};

async function getLatestRun(songId: number) {
  const [run] = await db
    .select({
      id: translationRuns.id,
      songId: translationRuns.songId,
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

  return run;
}

async function buildFlashcards(songId: number): Promise<void> {
  const [song] = await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist
    })
    .from(songs)
    .where(eq(songs.id, songId))
    .limit(1);

  if (!song) {
    throw new Error(`Song id ${songId} not found.`);
  }

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

  const cardsToInsert = runWithLines.lyricLines.flatMap((line) => {
    const translation = line.translationLine;
    if (!translation) {
      return [];
    }

    return translation.vocabEntries.map((entry) => ({
      runId: run.id,
      front: `Line: ${line.originalText}\nTarget: ${entry.originalText}`,
      back: `Meaning: ${entry.explanation}\nLine translation: ${translation.translationText}`,
      sourceTranslationLineId: translation.id,
      sourceVocabEntryId: entry.id
    }));
  });

  const result = await db.transaction(async (tx) => {
    await tx.delete(flashcards).where(eq(flashcards.runId, run.id));

    if (cardsToInsert.length === 0) {
      return { inserted: 0 };
    }

    const inserted = await tx
      .insert(flashcards)
      .values(cardsToInsert)
      .returning({ id: flashcards.id });

    return { inserted: inserted.length };
  });

  const payload = {
    songId: song.id,
    runId: run.id,
    inserted: result.inserted
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function listFlashcards(songId: number): Promise<void> {
  const [song] = await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist
    })
    .from(songs)
    .where(eq(songs.id, songId))
    .limit(1);

  if (!song) {
    throw new Error(`Song id ${songId} not found.`);
  }

  const run = await getLatestRun(songId);

  const rows: FlashcardRow[] = await db
    .select({
      id: flashcards.id,
      runId: flashcards.runId,
      front: flashcards.front,
      back: flashcards.back,
      sourceTranslationLineId: flashcards.sourceTranslationLineId,
      sourceVocabEntryId: flashcards.sourceVocabEntryId,
      createdAt: flashcards.createdAt
    })
    .from(flashcards)
    .where(eq(flashcards.runId, run.id))
    .orderBy(flashcards.id);

  const payload = {
    songId: song.id,
    runId: run.id,
    count: rows.length,
    cards: rows
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

export async function runFlashcards(
  action: "build" | "list",
  songId: number
): Promise<void> {
  if (action === "build") {
    await buildFlashcards(songId);
    return;
  }

  await listFlashcards(songId);
}
