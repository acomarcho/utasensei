import { fireworks } from "@ai-sdk/fireworks";
import { generateText } from "ai";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
	chatMessages,
	chatThreads,
	songs,
	translationRuns,
} from "../db/schema";

// Keep CLI stdout clean for plain-text replies.
(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

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

type ChatCommandArgs =
	| {
			command: "chat";
			action: "send";
			songId: number;
			message: string;
			threadId?: number;
	  }
	| { command: "chat"; action: "threads"; songId: number }
	| { command: "chat"; action: "delete"; threadId: number };

type StoredChatMessage = {
	id: number;
	role: "user" | "assistant";
	content: string;
	createdAt: number;
};

type ThreadLookup = {
	id: number;
	title: string;
	runId: number;
	songId: number;
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

async function getLatestRunForSong(songId: number) {
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
		throw new Error(`Song id ${songId} not found.`);
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
		throw new Error(`No translation runs found for song id ${songId}.`);
	}

	return { song, run };
}

async function getThreadById(threadId: number): Promise<ThreadLookup> {
	const [thread] = await db
		.select({
			id: chatThreads.id,
			title: chatThreads.title,
			runId: chatThreads.runId,
			songId: translationRuns.songId,
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

async function generateAssistantReply(options: {
	runId: number;
	history: StoredChatMessage[];
	userMessage: string;
}): Promise<string> {
	if (!process.env.FIREWORKS_API_KEY) {
		throw new Error(
			"Missing FIREWORKS_API_KEY. Add it to .env (see .env.example).",
		);
	}

	const contextMessage = await buildRunContext(options.runId);
	const result = await generateText({
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
	});

	const reply = normalizeMessageContent(result.text);
	if (!reply) {
		throw new Error("Chat model returned an empty response.");
	}

	return reply;
}

async function createThreadAndReply(
	songId: number,
	rawMessage: string,
): Promise<void> {
	const userMessage = normalizeMessageContent(rawMessage);
	const { run } = await getLatestRunForSong(songId);

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

	let assistantReply: string;
	try {
		assistantReply = await generateAssistantReply({
			runId: run.id,
			history: [],
			userMessage,
		});
	} catch (error) {
		await db.transaction(async (tx) => {
			await tx.delete(chatMessages).where(eq(chatMessages.threadId, thread.id));
			await tx.delete(chatThreads).where(eq(chatThreads.id, thread.id));
		});
		throw error;
	}

	await db.transaction(async (tx) => {
		await tx.insert(chatMessages).values({
			threadId: thread.id,
			role: "assistant",
			content: assistantReply,
		});
		await tx
			.update(chatThreads)
			.set({ updatedAt: currentUnixTime() })
			.where(eq(chatThreads.id, thread.id));
	});

	process.stdout.write(`${assistantReply}\n`);
}

async function continueThreadAndReply(
	songId: number,
	threadId: number,
	rawMessage: string,
): Promise<void> {
	const userMessage = normalizeMessageContent(rawMessage);
	const thread = await assertThreadBelongsToSong(threadId, songId);
	const history = await getThreadMessages(thread.id);

	const [userRow] = await db
		.insert(chatMessages)
		.values({
			threadId: thread.id,
			role: "user",
			content: userMessage,
		})
		.returning({ id: chatMessages.id });

	let assistantReply: string;
	try {
		assistantReply = await generateAssistantReply({
			runId: thread.runId,
			history,
			userMessage,
		});
	} catch (error) {
		if (userRow) {
			await db.delete(chatMessages).where(eq(chatMessages.id, userRow.id));
		}
		throw error;
	}

	await db.transaction(async (tx) => {
		await tx.insert(chatMessages).values({
			threadId: thread.id,
			role: "assistant",
			content: assistantReply,
		});
		await tx
			.update(chatThreads)
			.set({ updatedAt: currentUnixTime() })
			.where(eq(chatThreads.id, thread.id));
	});

	process.stdout.write(`${assistantReply}\n`);
}

async function listThreads(songId: number): Promise<void> {
	const { run } = await getLatestRunForSong(songId);

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
		.where(eq(chatThreads.runId, run.id))
		.groupBy(
			chatThreads.id,
			chatThreads.title,
			chatThreads.createdAt,
			chatThreads.updatedAt,
		)
		.orderBy(desc(chatThreads.updatedAt), desc(chatThreads.id));

	const payload = {
		songId,
		runId: run.id,
		count: rows.length,
		threads: rows.map((row) => ({
			id: row.id,
			title: row.title,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			messageCount: Number(row.messageCount),
		})),
	};

	process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function deleteThread(threadId: number): Promise<void> {
	await getThreadById(threadId);
	const messageRows = await db
		.select({ id: chatMessages.id })
		.from(chatMessages)
		.where(eq(chatMessages.threadId, threadId));

	await db.transaction(async (tx) => {
		await tx.delete(chatMessages).where(eq(chatMessages.threadId, threadId));
		await tx.delete(chatThreads).where(eq(chatThreads.id, threadId));
	});

	process.stdout.write(
		`${JSON.stringify(
			{
				threadId,
				deleted: {
					threads: 1,
					messages: messageRows.length,
				},
			},
			null,
			2,
		)}\n`,
	);
}

export async function runChat(args: ChatCommandArgs): Promise<void> {
	if (args.action === "threads") {
		await listThreads(args.songId);
		return;
	}

	if (args.action === "delete") {
		await deleteThread(args.threadId);
		return;
	}

	if (args.threadId === undefined) {
		await createThreadAndReply(args.songId, args.message);
		return;
	}

	await continueThreadAndReply(args.songId, args.threadId, args.message);
}
