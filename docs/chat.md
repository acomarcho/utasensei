# Chat (Future)

Goal: chat with a translation run as context.

Scope decision:
- Threads are scoped to a translation run (not global to the song).

Suggested tables (when implemented):
- chat_threads: id, run_id, title, created_at
- chat_messages: id, thread_id, role (user|assistant|system), content, created_at
- chat_message_contexts: id, message_id, translation_line_id, vocab_entry_id

Notes:
- Context links allow grounding responses to specific lines or vocab chunks.
- Storing context separately keeps chat_messages lean.
