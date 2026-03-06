import { fireworks } from "@ai-sdk/fireworks";
import { streamText } from "ai";
import { desc, eq, sql } from "drizzle-orm";
import type { SongChatMessage, SongChatThread } from "~/data/ai-studio";
import { db } from "~/utils/db/client.server";
import {
	chatMessages,
	chatThreads,
	songs,
	translationRuns,
} from "~/utils/db/schema";

const CHAT_MODEL_ID = "accounts/fireworks/models/minimax-m2p5";
const THREAD_TITLE_MAX_LENGTH = 80;

const CHAT_SYSTEM_PROMPT = [
	"You are a helpful language-learning assistant specializing in song study.",
	"You will be given a song, its line-by-line translation, explanation notes, and vocabulary notes.",
	"Only answer questions about the song's language, translation, vocabulary, grammar, phrasing, nuance, tone, or closely related language-learning topics.",
	"Reject unrelated requests such as coding help, math, general trivia, or open-ended non-language tasks.",
	"Ground every answer in the provided song context and the conversation history.",
	"Prefer concise, clear, beginner-friendly explanations unless the user asks for more detail.",
	"If the provided context is not sufficient to answer confidently, say so instead of inventing details.",
].join(" ");

type StoredChatMessage = SongChatMessage;

type SongRunLookup = {
	run: {
		id: number;
		songId: number;
		sourceUrl: string;
		modelId: string;
		createdAt: number;
	};
	song: {
		id: number;
		title: string;
		artist: string;
	};
};

type ThreadLookup = {
	id: number;
	title: string;
	runId: number;
	songId: number;
	createdAt: number;
	updatedAt: number;
};

export type SongChatStreamEvent =
	| {
			type: "text-delta";
			textDelta: string;
			threadId: number;
	  }
	| {
			type: "done";
			thread: SongChatThread;
	  };

function normalizeMessageContent(text: string): string {
	return text.replace(/\r\n/g, "\n").trim();
}

function normalizeTitleText(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function currentUnixTime(): number {
	return Math.floor(Date.now() / 1000);
}

function buildThreadTitle(firstMessage: string): string {
	const normalized = normalizeTitleText(firstMessage);
	if (normalized.length <= THREAD_TITLE_MAX_LENGTH) {
		return normalized;
	}

	return `${normalized.slice(0, THREAD_TITLE_MAX_LENGTH - 3).trimEnd()}...`;
}

async function getLatestRunForSong(
	songId: number,
): Promise<SongRunLookup | null> {
	const [song] = await db
		.select({
			id: songs.id,
			title: songs.title,
			artist: songs.artist,
		})
		.from(songs)
		.where(eq(songs.id, songId))
		.limit(1);

	if (!song) {
		return null;
	}

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

	if (!run) {
		return null;
	}

	return { song, run };
}

async function requireLatestRunForSong(songId: number): Promise<SongRunLookup> {
	const lookup = await getLatestRunForSong(songId);
	if (!lookup) {
		const [song] = await db
			.select({ id: songs.id })
			.from(songs)
			.where(eq(songs.id, songId))
			.limit(1);

		if (!song) {
			throw new Error(`Song id ${songId} not found.`);
		}

		throw new Error(`No translation runs found for song id ${songId}.`);
	}

	return lookup;
}

async function getThreadById(threadId: number): Promise<ThreadLookup> {
	const [thread] = await db
		.select({
			id: chatThreads.id,
			title: chatThreads.title,
			runId: chatThreads.runId,
			songId: translationRuns.songId,
			createdAt: chatThreads.createdAt,
			updatedAt: chatThreads.updatedAt,
		})
		.from(chatThreads)
		.innerJoin(translationRuns, eq(chatThreads.runId, translationRuns.id))
		.where(eq(chatThreads.id, threadId))
		.limit(1);

	if (!thread) {
		throw new Error(`Thread id ${threadId} not found.`);
	}

	return thread;
}

async function assertThreadBelongsToSong(
	threadId: number,
	songId: number,
): Promise<ThreadLookup> {
	const thread = await getThreadById(threadId);
	if (thread.songId !== songId) {
		throw new Error(
			`Thread id ${threadId} does not belong to song id ${songId}.`,
		);
	}

	return thread;
}

async function getThreadMessages(
	threadId: number,
): Promise<StoredChatMessage[]> {
	const rows = await db
		.select({
			id: chatMessages.id,
			role: chatMessages.role,
			content: chatMessages.content,
			createdAt: chatMessages.createdAt,
		})
		.from(chatMessages)
		.where(eq(chatMessages.threadId, threadId))
		.orderBy(chatMessages.id);

	return rows.map((row) => {
		if (row.role !== "user" && row.role !== "assistant") {
			throw new Error(
				`Unsupported chat message role "${row.role}" in thread ${threadId}.`,
			);
		}

		return {
			id: row.id,
			role: row.role,
			content: row.content,
			createdAt: row.createdAt,
		};
	});
}

async function getThreadDetail(threadId: number): Promise<SongChatThread> {
	const thread = await getThreadById(threadId);
	const messages = await getThreadMessages(threadId);

	return {
		id: thread.id,
		title: thread.title,
		runId: thread.runId,
		songId: thread.songId,
		createdAt: thread.createdAt,
		updatedAt: thread.updatedAt,
		messageCount: messages.length,
		messages,
	};
}

async function buildRunContext(runId: number): Promise<string> {
	const run = await db.query.translationRuns.findFirst({
		where: eq(translationRuns.id, runId),
		with: {
			song: true,
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

	if (!run || !run.song) {
		throw new Error(`Failed to load translation run ${runId}.`);
	}

	const sections = [
		"You are being given reference material for one song. Use this material as the grounding context for the conversation.",
		"",
		"# Song Metadata",
		`Title: ${run.song.title}`,
		`Artist: ${run.song.artist}`,
		`Run ID: ${run.id}`,
		`Source URL: ${run.sourceUrl}`,
		`Translation Model: ${run.modelId}`,
		"",
		"# Line-by-Line Reference",
	];

	for (const line of run.lyricLines) {
		const translationLine = line.translationLine;
		sections.push(`## Line ${line.lineIndex + 1}`);
		sections.push(`Original: ${line.originalText}`);
		sections.push(
			`Translation: ${translationLine?.translationText ?? "[missing translation]"}`,
		);
		sections.push(
			`Explanation: ${translationLine?.longFormExplanation ?? "[missing explanation]"}`,
		);

		if (!translationLine || translationLine.vocabEntries.length === 0) {
			sections.push("Vocabulary: [none]");
			sections.push("");
			continue;
		}

		sections.push("Vocabulary:");
		for (const vocabEntry of translationLine.vocabEntries) {
			sections.push(`- ${vocabEntry.originalText}: ${vocabEntry.explanation}`);
		}
		sections.push("");
	}

	return sections.join("\n").trim();
}

function getStreamErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return "Chat generation failed.";
}

async function streamAssistantReply(options: {
	runId: number;
	history: StoredChatMessage[];
	userMessage: string;
	threadId: number;
}): Promise<AsyncGenerator<SongChatStreamEvent>> {
	if (!process.env.FIREWORKS_API_KEY) {
		throw new Error(
			"Missing FIREWORKS_API_KEY. Add it to .env (see .env.example).",
		);
	}

	const contextMessage = await buildRunContext(options.runId);
	let assistantReply = "";
	let streamError: unknown = null;

	const result = streamText({
		model: fireworks(CHAT_MODEL_ID),
		system: CHAT_SYSTEM_PROMPT,
		messages: [
			{ role: "user", content: contextMessage },
			...options.history.map((message) => ({
				role: message.role,
				content: message.content,
			})),
			{ role: "user", content: options.userMessage },
		],
		maxRetries: 1,
		onError({ error }) {
			streamError = error;
		},
	});

	return (async function* () {
		for await (const textDelta of result.textStream) {
			if (!textDelta) {
				continue;
			}

			assistantReply += textDelta;
			yield {
				type: "text-delta",
				textDelta,
				threadId: options.threadId,
			};
		}

		if (streamError) {
			throw new Error(getStreamErrorMessage(streamError));
		}

		const normalizedReply = normalizeMessageContent(assistantReply);
		if (!normalizedReply) {
			throw new Error("Chat model returned an empty response.");
		}

		await db.transaction(async (tx) => {
			await tx.insert(chatMessages).values({
				threadId: options.threadId,
				role: "assistant",
				content: normalizedReply,
			});
			await tx
				.update(chatThreads)
				.set({ updatedAt: currentUnixTime() })
				.where(eq(chatThreads.id, options.threadId));
		});

		yield {
			type: "done",
			thread: await getThreadDetail(options.threadId),
		};
	})();
}

export async function listSongChatThreads(
	songId: number,
): Promise<SongChatThread[]> {
	const lookup = await getLatestRunForSong(songId);
	if (!lookup) {
		return [];
	}

	const rows = await db
		.select({
			id: chatThreads.id,
			title: chatThreads.title,
			createdAt: chatThreads.createdAt,
			updatedAt: chatThreads.updatedAt,
			messageCount: sql<number>`count(${chatMessages.id})`,
		})
		.from(chatThreads)
		.leftJoin(chatMessages, eq(chatMessages.threadId, chatThreads.id))
		.where(eq(chatThreads.runId, lookup.run.id))
		.groupBy(
			chatThreads.id,
			chatThreads.title,
			chatThreads.createdAt,
			chatThreads.updatedAt,
		)
		.orderBy(desc(chatThreads.updatedAt), desc(chatThreads.id));

	return Promise.all(rows.map((row) => getThreadDetail(row.id)));
}

export async function getSongChatThread(
	songId: number,
	threadId: number,
): Promise<SongChatThread> {
	await assertThreadBelongsToSong(threadId, songId);
	return getThreadDetail(threadId);
}

export async function* sendSongChatMessage(options: {
	songId: number;
	message: string;
	threadId?: number;
}): AsyncGenerator<SongChatStreamEvent> {
	const userMessage = normalizeMessageContent(options.message);
	if (!userMessage) {
		throw new Error("Message cannot be empty.");
	}

	if (options.threadId === undefined) {
		const { run } = await requireLatestRunForSong(options.songId);

		const [thread] = await db
			.insert(chatThreads)
			.values({
				runId: run.id,
				title: buildThreadTitle(userMessage),
			})
			.returning({ id: chatThreads.id });

		if (!thread) {
			throw new Error("Failed to create chat thread.");
		}

		await db.insert(chatMessages).values({
			threadId: thread.id,
			role: "user",
			content: userMessage,
		});

		try {
			yield* await streamAssistantReply({
				runId: run.id,
				history: [],
				userMessage,
				threadId: thread.id,
			});
		} catch (error) {
			await db.transaction(async (tx) => {
				await tx
					.delete(chatMessages)
					.where(eq(chatMessages.threadId, thread.id));
				await tx.delete(chatThreads).where(eq(chatThreads.id, thread.id));
			});
			throw error;
		}

		return;
	}

	const thread = await assertThreadBelongsToSong(
		options.threadId,
		options.songId,
	);
	const history = await getThreadMessages(thread.id);
	const [userRow] = await db
		.insert(chatMessages)
		.values({
			threadId: thread.id,
			role: "user",
			content: userMessage,
		})
		.returning({ id: chatMessages.id });

	try {
		yield* await streamAssistantReply({
			runId: thread.runId,
			history,
			userMessage,
			threadId: thread.id,
		});
	} catch (error) {
		if (userRow) {
			await db.delete(chatMessages).where(eq(chatMessages.id, userRow.id));
		}
		throw error;
	}
}

export async function deleteSongChatThread(threadId: number): Promise<{
	threadId: number;
	deleted: {
		threads: number;
		messages: number;
	};
}> {
	await getThreadById(threadId);
	const messageRows = await db
		.select({ id: chatMessages.id })
		.from(chatMessages)
		.where(eq(chatMessages.threadId, threadId));

	await db.transaction(async (tx) => {
		await tx.delete(chatMessages).where(eq(chatMessages.threadId, threadId));
		await tx.delete(chatThreads).where(eq(chatThreads.id, threadId));
	});

	return {
		threadId,
		deleted: {
			threads: 1,
			messages: messageRows.length,
		},
	};
}
