import { relations, sql } from "drizzle-orm";
import {
  int,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";

export const songs = sqliteTable("songs", {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  artist: text().notNull(),
  createdAt: integer().notNull().default(sql`(unixepoch())`)
});

export const songsRelations = relations(songs, ({ many }) => ({
  translationRuns: many(translationRuns)
}));

export const translationRuns = sqliteTable("translation_runs", {
  id: int().primaryKey({ autoIncrement: true }),
  songId: int().notNull().references(() => songs.id),
  sourceUrl: text().notNull(),
  modelId: text().notNull(),
  createdAt: integer().notNull().default(sql`(unixepoch())`)
});

export const translationRunsRelations = relations(
  translationRuns,
  ({ one, many }) => ({
    song: one(songs, {
      fields: [translationRuns.songId],
      references: [songs.id]
    }),
    lyricLines: many(lyricLines)
  })
);

export const lyricLines = sqliteTable(
  "lyric_lines",
  {
    id: int().primaryKey({ autoIncrement: true }),
    runId: int().notNull().references(() => translationRuns.id),
    lineIndex: int().notNull(),
    originalText: text().notNull()
  },
  (table) => [
    uniqueIndex("lyric_lines_run_line_index").on(table.runId, table.lineIndex)
  ]
);

export const lyricLinesRelations = relations(lyricLines, ({ one }) => ({
  run: one(translationRuns, {
    fields: [lyricLines.runId],
    references: [translationRuns.id]
  }),
  translationLine: one(translationLines, {
    fields: [lyricLines.id],
    references: [translationLines.lyricLineId]
  })
}));

export const translationLines = sqliteTable(
  "translation_lines",
  {
    id: int().primaryKey({ autoIncrement: true }),
    lyricLineId: int().notNull().references(() => lyricLines.id),
    translationText: text().notNull(),
    longFormExplanation: text().notNull()
  },
  (table) => [
    uniqueIndex("translation_lines_lyric_line").on(table.lyricLineId)
  ]
);

export const translationLinesRelations = relations(
  translationLines,
  ({ one, many }) => ({
    lyricLine: one(lyricLines, {
      fields: [translationLines.lyricLineId],
      references: [lyricLines.id]
    }),
    vocabEntries: many(vocabEntries)
  })
);

export const vocabEntries = sqliteTable(
  "vocab_entries",
  {
    id: int().primaryKey({ autoIncrement: true }),
    translationLineId: int().notNull().references(() => translationLines.id),
    vocabIndex: int().notNull(),
    originalText: text().notNull(),
    explanation: text().notNull()
  },
  (table) => [
    uniqueIndex("vocab_entries_translation_vocab_index").on(
      table.translationLineId,
      table.vocabIndex
    )
  ]
);

export const vocabEntriesRelations = relations(vocabEntries, ({ one }) => ({
  translationLine: one(translationLines, {
    fields: [vocabEntries.translationLineId],
    references: [translationLines.id]
  })
}));

export const flashcards = sqliteTable("flashcards", {
  id: int().primaryKey({ autoIncrement: true }),
  runId: int().notNull().references(() => translationRuns.id),
  front: text().notNull(),
  back: text().notNull(),
  sourceTranslationLineId: int().references(() => translationLines.id),
  sourceVocabEntryId: int().references(() => vocabEntries.id),
  createdAt: integer().notNull().default(sql`(unixepoch())`)
});

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  run: one(translationRuns, {
    fields: [flashcards.runId],
    references: [translationRuns.id]
  }),
  translationLine: one(translationLines, {
    fields: [flashcards.sourceTranslationLineId],
    references: [translationLines.id]
  }),
  vocabEntry: one(vocabEntries, {
    fields: [flashcards.sourceVocabEntryId],
    references: [vocabEntries.id]
  })
}));
