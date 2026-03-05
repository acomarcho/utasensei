# Flashcards (Future)

Goal: generate study cards from translated songs without changing the core translation schema.

Potential sources:
- translation_lines (full sentence cards)
- vocab_entries (word/phrase cards)

Suggested fields (when implemented):
- id
- run_id (scoped to a translation run)
- type ("line" | "vocab" | "custom")
- front
- back
- source_translation_line_id (nullable)
- source_vocab_entry_id (nullable)
- created_at

Notes:
- Keep cards immutable once generated to preserve spaced-repetition history.
- Use source ids for traceability back to the song content.
