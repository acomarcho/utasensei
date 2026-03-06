# CLI Chat Threads Implementation Plan

## Goal

Add an experimental chat capability to the CLI so a user can ask follow-up language-learning questions about a song translation run.

The CLI should support:

- creating a new chat thread by sending a message without specifying a thread
- continuing an existing thread
- listing threads for a song
- deleting a thread and all of its messages

This feature is scoped to the CLI only. Schema drift from the web app is acceptable during this experimental phase.

## Agreed Product Decisions

- Chat threads are scoped to a `translation_run`, not globally to a song.
- New chat threads always use the latest run for the given song.
- `--run` is not supported.
- Continuing a thread must always use the original run the thread was created with, even if a newer run exists later.
- Chat replies should be printed to stdout as plain text.
- `chat threads` is part of v1, even though the initial doc did not include it.
- Thread titles are generated locally from the first user message by truncating it. No extra model call is used for naming.
- The model for chat responses is `accounts/fireworks/models/minimax-m2p5`.
- The first user prompt after the system prompt contains the full song context assembled from the run.
- The assistant should reject non-language questions and stay grounded in the provided song context.

## Current State

Relevant files:

- `docs/chat.md`
- `apps/cli/src/index.ts`
- `apps/cli/src/db/schema.ts`
- `apps/cli/src/db/client.ts`
- `apps/cli/src/commands/songs.ts`
- `apps/cli/src/commands/translate-song.ts`
- `apps/cli/src/lib/song-generation-models.ts`

Current constraints and observations:

- The CLI uses manual argument parsing in `apps/cli/src/index.ts`.
- Database access uses Drizzle over SQLite.
- `translate-song` already persists `songs`, `translation_runs`, `lyric_lines`, `translation_lines`, and `vocab_entries`.
- Existing read behavior for song-derived features tends to use the latest run for a song.
- There is no existing chat implementation in the CLI.
- There are no checked-in CLI migrations yet; schema changes are managed through Drizzle config and push/generate scripts.

## Proposed CLI UX

### Create a new thread

```bash
pnpm cli chat <songId> "<message>"
```

Behavior:

- resolve the latest `translation_run` for `songId`
- create a new `chat_thread`
- store the user message
- generate the assistant reply using full run context plus prior thread history
- store the assistant reply
- print only the assistant reply text to stdout

### Continue an existing thread

```bash
pnpm cli chat <songId> --thread <threadId> "<message>"
```

Behavior:

- verify the thread exists
- verify the thread belongs to the given `songId`
- load the thread's original `runId`
- ignore newer runs for the song
- store the new user message
- generate and store the assistant reply
- print only the assistant reply text to stdout

### List threads for a song

```bash
pnpm cli chat threads <songId>
```

Behavior:

- resolve the latest run for `songId`
- list threads attached to that run
- return structured JSON, because this is a management command and not a chat reply

Suggested payload shape:

```json
{
  "songId": 1,
  "runId": 12,
  "count": 2,
  "threads": [
    {
      "id": 5,
      "title": "What does ...",
      "createdAt": 1741310000,
      "updatedAt": 1741310200,
      "messageCount": 4
    }
  ]
}
```

### Delete a thread

```bash
pnpm cli chat delete <threadId>
```

Behavior:

- delete the thread and all associated messages in one transaction
- return structured JSON describing what was deleted

Suggested payload shape:

```json
{
  "threadId": 5,
  "deleted": {
    "threads": 1,
    "messages": 4
  }
}
```

## Proposed Data Model

Add CLI-only tables in `apps/cli/src/db/schema.ts`.

### `chat_threads`

Fields:

- `id`: integer primary key
- `runId`: foreign key to `translation_runs.id`
- `title`: text, not null
- `createdAt`: unix timestamp, default `unixepoch()`
- `updatedAt`: unix timestamp, default `unixepoch()`

Notes:

- `updatedAt` is useful for sorting recent threads and should be updated whenever a new message is appended.
- Thread records do not need to store `songId` because that relationship can be derived through `runId`.

### `chat_messages`

Fields:

- `id`: integer primary key
- `threadId`: foreign key to `chat_threads.id`
- `role`: text, restricted in code to `user | assistant`
- `content`: text, not null
- `createdAt`: unix timestamp, default `unixepoch()`

Notes:

- Do not store the synthetic song context message in the database for v1.
- Do not store a `system` row for v1.
- Persist only the actual conversation turns from the human and assistant.

### Relations

Add Drizzle relations for:

- `translationRuns -> many(chatThreads)`
- `chatThreads -> one(translationRuns)`
- `chatThreads -> many(chatMessages)`
- `chatMessages -> one(chatThreads)`

## Prompting Strategy

### System prompt

The system prompt should be stricter and more useful than the rough initial wording. It should say, in substance:

- you are a language-learning assistant for song study
- you will be given one song, its line-by-line translation, explanations, and vocabulary notes
- only answer questions about the song's language, translation, vocabulary, grammar, phrasing, nuance, tone, or closely related language-learning topics
- reject unrelated requests such as coding help, general trivia, math, or open-ended non-language tasks
- ground answers in the provided song context and prior chat history
- prefer concise, clear explanations unless the user asks for more detail
- if the answer is uncertain or not grounded in the provided context, say so rather than inventing details

### Synthetic first user message

Before replaying the stored thread messages, synthesize a first user message that contains the full run context.

Suggested structure:

1. song metadata
2. source URL and run metadata
3. ordered lyric lines
4. translation for each line
5. long-form explanation for each line
6. vocab list for each line
7. a short instruction telling the assistant to use this as reference context for all future answers in the thread

This message is assembled at request time and is not stored in the database.

### Conversation assembly

For a generation request, construct messages in this order:

1. system prompt
2. synthetic context user message
3. stored thread messages in chronological order
4. the new user message

Then call `generateText`.

## Implementation Breakdown

### 1. Extend the CLI schema

Files:

- `apps/cli/src/db/schema.ts`

Tasks:

- add `chatThreads` and `chatMessages` tables
- add relations for the new tables
- keep naming and timestamp conventions aligned with the existing schema

Verification:

- run `pnpm db:generate` if needed
- run `pnpm db:push` to apply schema changes locally

### 2. Add chat command parsing

Files:

- `apps/cli/src/index.ts`

Tasks:

- extend `HELP_TEXT`
- extend `CliArgs` with chat variants
- add parsing for:
  - `chat <songId> "<message>"`
  - `chat <songId> --thread <threadId> "<message>"`
  - `chat threads <songId>`
  - `chat delete <threadId>`
- reject invalid combinations and preserve current error style

Notes:

- The parser should continue to support quoted messages passed by the shell as a single argument.
- Keep argument validation simple and explicit, consistent with the rest of the CLI.

### 3. Add a chat command module

Files:

- `apps/cli/src/commands/chat.ts` (new)

Responsibilities:

- resolve the latest run for a song when creating a thread or listing threads
- load an existing thread and confirm it belongs to the requested song when continuing
- load thread messages in chronological order
- create and delete chat records transactionally
- call the model and print the final assistant text

Suggested exported entrypoint:

```ts
export async function runChat(args: ...): Promise<void>
```

Suggested internal helpers:

- `getLatestRunForSong(songId)`
- `getThreadById(threadId)`
- `assertThreadBelongsToSong(threadId, songId)`
- `buildRunContext(runId)`
- `buildThreadTitle(firstMessage)`
- `createThreadAndReply(songId, message)`
- `continueThreadAndReply(songId, threadId, message)`
- `listThreads(songId)`
- `deleteThread(threadId)`

### 4. Build song context from the run

Files:

- likely `apps/cli/src/commands/chat.ts`
- optionally a new helper if the file gets too large

Tasks:

- query the run with `lyricLines -> translationLine -> vocabEntries`
- preserve line ordering by `lineIndex`
- preserve vocab ordering by `vocabIndex`
- produce a compact but readable context string

Important detail:

- The context should include enough structure for the model to locate a line and answer questions about wording or nuance, but it should not be needlessly verbose.

### 5. Wire AI generation with `generateText`

Files:

- `apps/cli/src/commands/chat.ts`

Tasks:

- import `generateText` from `ai`
- import `fireworks` from `@ai-sdk/fireworks`
- call `fireworks("accounts/fireworks/models/minimax-m2p5")`
- pass the assembled messages to `generateText`
- normalize the returned text before persisting and printing

Error handling:

- fail clearly if `FIREWORKS_API_KEY` is missing
- fail clearly if the song or latest run does not exist
- fail clearly if the thread does not exist or does not belong to the provided song
- avoid writing partial thread state if generation fails before the assistant reply is saved

Transaction strategy:

- create-thread flow can insert the thread and first user message before generation, then append assistant reply after success
- if generation fails, leave the created thread plus first user message intact only if that is acceptable operationally
- better v1 behavior is to wrap thread creation and first user message carefully so an empty or half-created thread is not left behind unnecessarily

Recommended approach:

- create the thread and user message first
- attempt generation
- on generation failure, delete the newly created thread in a compensating transaction
- for existing threads, insert the new user message first, attempt generation, and on failure delete only that just-inserted user message if practical

This avoids storing dead-end conversation turns caused by transport or provider failure.

### 6. Update timestamps and management views

Files:

- `apps/cli/src/commands/chat.ts`

Tasks:

- update `chat_threads.updatedAt` whenever a new user or assistant message is appended
- sort thread list by `updatedAt desc`, then `id desc`
- include `messageCount` in list output for basic usability

## Suggested Output Rules

### Chat send and continue

- Print only assistant text to stdout.
- Do not wrap the response in JSON.

### Threads list and delete

- Return JSON.
- This matches the CLI's existing machine-readable management command style.

## Validation Plan

After implementation:

1. Run `pnpm --filter @utasensei/cli typecheck`.
2. Apply DB changes with `pnpm db:push` against the local experiment database.
3. Manually test new-thread flow:
   - `pnpm cli chat <songId> "What does this line imply?"`
4. Manually test continue-thread flow:
   - capture a thread id from `chat threads <songId>`
   - `pnpm cli chat <songId> --thread <threadId> "Explain it more simply."`
5. Manually test list flow:
   - `pnpm cli chat threads <songId>`
6. Manually test delete flow:
   - `pnpm cli chat delete <threadId>`
7. Confirm that continuing an old thread still uses the original run even if a newer translation run is created afterward.
8. Confirm non-language questions are rejected in a visibly narrow way.

## Risks and Caveats

- The synthetic full-run context may become large for long songs. This is acceptable for the experiment, but prompt size should be watched.
- Because context is rebuilt each request instead of stored, future schema or formatting changes may alter how older threads are replayed. This is an acceptable tradeoff for v1.
- `chat threads <songId>` listing only the latest run's threads means older threads become less discoverable if the song gets a newer run. This matches the current latest-run-only UX, but it is a known limitation.
- Keeping CLI schema drift separate from the web app is intentional for now, but any later web-app adoption will require schema reconciliation.

## Out of Scope for V1

- per-line context citations or grounding tables
- run selection via `--run`
- streaming responses to the terminal
- automatic thread renaming after later turns
- web-app integration
- prompt compression or retrieval-based context selection
- model selection flags for chat

## Recommended Order of Work

1. Add schema and relations.
2. Add command parsing and help text.
3. Implement data helpers and context builder.
4. Implement create, continue, list, and delete flows.
5. Wire `generateText` and prompt assembly.
6. Typecheck and run local smoke tests.

