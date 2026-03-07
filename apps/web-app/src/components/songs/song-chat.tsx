import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, Plus, Send, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import type {
	SongChatRole,
	SongChatThread,
	SongChatThreadSummary,
	SongPageData,
} from "~/data/songs";
import {
	deleteSongChatThreadFn,
	sendSongChatMessageFn,
} from "~/utils/songs.functions";
import {
	songPageDataQueryKey,
	songPageDataQueryOptions,
	updateSongPageData,
} from "~/utils/songs.query-options";

type LocalChatMessage = {
	id: number;
	role: SongChatRole;
	content: string;
	createdAt: number;
	isStreaming?: boolean;
};

type DraftChatThread = {
	id: "draft";
	title: string;
	messages: LocalChatMessage[];
};

type LocalResolvedThread = Omit<SongChatThread, "messages"> & {
	messages: LocalChatMessage[];
};

function formatMessageTime(timestamp: number) {
	const normalized =
		timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000;

	return new Date(normalized).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : "Chat request failed.";
}

function sortThreads(threads: SongChatThreadSummary[]) {
	return [...threads].sort((left, right) => {
		if (left.updatedAt === right.updatedAt) {
			return right.id - left.id;
		}

		return right.updatedAt - left.updatedAt;
	});
}

function toThreadSummary(
	thread: Pick<
		LocalResolvedThread,
		"id" | "title" | "createdAt" | "updatedAt" | "messageCount"
	>,
): SongChatThreadSummary {
	return {
		id: thread.id,
		title: thread.title,
		createdAt: thread.createdAt,
		updatedAt: thread.updatedAt,
		messageCount: thread.messageCount,
	};
}

function toThreadDetailsRecord(threads: SongChatThread[]) {
	return Object.fromEntries(
		threads.map((thread) => [thread.id, thread] as const),
	);
}

function appendOptimisticExchange(
	thread: LocalResolvedThread,
	userMessage: LocalChatMessage,
	assistantMessage: LocalChatMessage,
): LocalResolvedThread {
	return {
		...thread,
		messageCount: thread.messageCount + 2,
		updatedAt: assistantMessage.createdAt,
		messages: [...thread.messages, userMessage, assistantMessage],
	};
}

function appendAssistantDelta(
	thread: LocalResolvedThread,
	assistantMessageId: number,
	textDelta: string,
): LocalResolvedThread {
	return {
		...thread,
		messages: thread.messages.map((message) =>
			message.id === assistantMessageId
				? { ...message, content: `${message.content}${textDelta}` }
				: message,
		),
	};
}

function upsertResolvedThread(
	threads: SongChatThread[],
	thread: LocalResolvedThread,
) {
	return [
		...threads.filter((currentThread) => currentThread.id !== thread.id),
		thread,
	].sort((left, right) => {
		if (left.updatedAt === right.updatedAt) {
			return right.id - left.id;
		}

		return right.updatedAt - left.updatedAt;
	});
}

function removeResolvedThread(threads: SongChatThread[], threadId: number) {
	return threads.filter((thread) => thread.id !== threadId);
}

function buildDraftTitle(message: string) {
	const normalized = message.replace(/\s+/g, " ").trim();
	if (normalized.length <= 30) {
		return normalized || "New thread";
	}

	return `${normalized.slice(0, 27).trimEnd()}...`;
}

function ThreadDeleteModal({
	errorMessage,
	isDeleting,
	isOpen,
	onCancel,
	onConfirm,
	thread,
}: {
	errorMessage: string | null;
	isDeleting: boolean;
	isOpen: boolean;
	onCancel: () => void;
	onConfirm: () => void;
	thread: SongChatThreadSummary | null;
}) {
	return (
		<AnimatePresence>
			{isOpen && thread ? (
				<motion.div
					animate={{ opacity: 1 }}
					className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 px-4"
					exit={{ opacity: 0 }}
					initial={{ opacity: 0 }}
					onClick={() => {
						if (!isDeleting) {
							onCancel();
						}
					}}
				>
					<motion.div
						animate={{ opacity: 1, y: 0, scale: 1 }}
						className="neo-card-no-hover w-full max-w-md overflow-hidden bg-[var(--bg-app)]"
						exit={{ opacity: 0, y: 12, scale: 0.96 }}
						initial={{ opacity: 0, y: 12, scale: 0.96 }}
						onClick={(event) => event.stopPropagation()}
						transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
					>
						<div className="flex items-center justify-between bg-[var(--bg-danger)] px-5 py-4 text-[var(--text-on-danger)]">
							<div>
								<p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-80">
									Delete thread
								</p>
								<h3 className="mt-1 text-lg font-bold uppercase tracking-[0.08em]">
									Delete this chat?
								</h3>
							</div>
							<button
								className="neo-card-no-hover shrink-0 bg-[var(--bg-app)] p-2.5 text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]"
								disabled={isDeleting}
								onClick={onCancel}
								type="button"
							>
								<X className="h-5 w-5" />
							</button>
						</div>

						<div className="space-y-4 p-5">
							<p className="font-mono text-sm leading-relaxed neo-text-muted">
								This removes the thread titled{" "}
								<span className="font-bold text-[var(--text-main)]">
									{thread.title}
								</span>{" "}
								and all {thread.messageCount} saved messages.
							</p>
							<p className="neo-border bg-[var(--bg-card-hover)] px-3 py-3 text-[11px] font-bold uppercase tracking-[0.16em] neo-text-muted">
								This action cannot be undone.
							</p>
							{errorMessage ? (
								<p className="neo-border bg-red-50 px-3 py-3 text-sm font-mono text-red-700">
									{errorMessage}
								</p>
							) : null}
						</div>

						<div className="neo-border-t flex flex-col gap-3 p-5 md:flex-row md:justify-end">
							<button
								className="neo-card-no-hover px-5 py-3 font-bold uppercase tracking-[0.18em] hover:bg-[var(--bg-card-hover)] disabled:opacity-60"
								disabled={isDeleting}
								onClick={onCancel}
								type="button"
							>
								Cancel
							</button>
							<button
								className="neo-button-danger px-5 py-3 uppercase tracking-[0.18em] disabled:opacity-60"
								disabled={isDeleting}
								onClick={onConfirm}
								type="button"
							>
								{isDeleting ? "Deleting..." : "Delete thread"}
							</button>
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}

function MessageBubble({ message }: { message: LocalChatMessage }) {
	const isUser = message.role === "user";

	return (
		<div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[85%] px-3 py-2 text-sm neo-border ${
					isUser
						? "bg-[var(--bg-accent)] text-[var(--text-on-accent)]"
						: "bg-[var(--bg-card)]"
				}`}
			>
				{isUser ? (
					<p className="neo-wrap-anywhere whitespace-pre-wrap">
						{message.content}
					</p>
				) : message.content ? (
					<Streamdown
						animated
						className="neo-markdown"
						isAnimating={message.isStreaming}
						mode={message.isStreaming ? "streaming" : "static"}
					>
						{message.content}
					</Streamdown>
				) : (
					<div className="flex gap-1 py-1.5">
						<span
							className="inline-block h-2 w-2 animate-bounce rounded-full bg-[var(--text-muted)]"
							style={{ animationDelay: "0ms" }}
						/>
						<span
							className="inline-block h-2 w-2 animate-bounce rounded-full bg-[var(--text-muted)]"
							style={{ animationDelay: "150ms" }}
						/>
						<span
							className="inline-block h-2 w-2 animate-bounce rounded-full bg-[var(--text-muted)]"
							style={{ animationDelay: "300ms" }}
						/>
					</div>
				)}
				<p
					className={`mt-1 font-mono text-[10px] ${
						isUser
							? "text-[var(--text-on-accent)] opacity-60"
							: "neo-text-muted"
					}`}
				>
					{formatMessageTime(message.createdAt)}
				</p>
			</div>
		</div>
	);
}

function ThreadList({
	errorMessage,
	isBusy,
	isDeleting,
	onCreate,
	onDelete,
	onSelect,
	threads,
}: {
	errorMessage: string | null;
	isBusy: boolean;
	isDeleting: boolean;
	onCreate: () => void;
	onDelete: (thread: SongChatThreadSummary) => void;
	onSelect: (threadId: number) => void;
	threads: SongChatThreadSummary[];
}) {
	return (
		<div className="flex h-full flex-col">
			<div className="neo-border-b flex items-center justify-between px-4 py-3">
				<h3 className="text-sm font-bold uppercase tracking-widest">Threads</h3>
				<button
					className="neo-button px-2 py-1 text-xs uppercase tracking-wider disabled:opacity-60"
					disabled={isBusy || isDeleting}
					onClick={onCreate}
					type="button"
				>
					<Plus className="h-3.5 w-3.5" />
				</button>
			</div>
			{errorMessage ? (
				<p className="neo-border-b bg-red-50 px-4 py-3 text-sm font-mono text-red-700">
					{errorMessage}
				</p>
			) : null}
			<div className="flex-1 overflow-y-auto neo-scrollbar-hidden">
				{threads.length === 0 ? (
					<p className="p-4 text-center font-mono text-sm neo-text-muted">
						No threads yet
					</p>
				) : null}
				{threads.map((thread) => (
					<div
						className="neo-border-b flex items-center gap-2 transition-colors hover:bg-[var(--bg-card-hover)]"
						key={thread.id}
					>
						<button
							className="min-w-0 flex-1 px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
							disabled={isBusy || isDeleting}
							onClick={() => onSelect(thread.id)}
							type="button"
						>
							<p className="truncate text-sm font-bold">{thread.title}</p>
							<p className="font-mono text-xs neo-text-muted">
								{thread.messageCount} messages
							</p>
						</button>
						<button
							aria-label={`Delete thread: ${thread.title}`}
							className="mr-2 shrink-0 p-1.5 transition-colors hover:text-[var(--bg-danger)] disabled:cursor-not-allowed disabled:opacity-60"
							disabled={isBusy || isDeleting}
							onClick={() => onDelete(thread)}
							type="button"
						>
							<Trash2 className="h-3.5 w-3.5" />
						</button>
					</div>
				))}
			</div>
		</div>
	);
}

function Conversation({
	activeTitle,
	errorMessage,
	isBusy,
	onBack,
	onSend,
	thread,
}: {
	activeTitle: string;
	errorMessage: string | null;
	isBusy: boolean;
	onBack: () => void;
	onSend: (message: string) => Promise<void>;
	thread: DraftChatThread | LocalResolvedThread | null;
}) {
	const [input, setInput] = useState("");
	const endRef = useRef<HTMLDivElement | null>(null);
	const lastMessage = thread?.messages.at(-1) ?? null;
	const scrollSignature = `${thread?.id ?? "none"}:${thread?.messages.length ?? 0}:${lastMessage?.id ?? "none"}:${lastMessage?.content.length ?? 0}`;
	const previousScrollSignatureRef = useRef(scrollSignature);

	if (scrollSignature !== previousScrollSignatureRef.current) {
		previousScrollSignatureRef.current = scrollSignature;
		queueMicrotask(() => {
			endRef.current?.scrollIntoView({ behavior: "smooth" });
		});
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const nextMessage = input.trim();
		if (!nextMessage || isBusy) {
			return;
		}

		setInput("");
		await onSend(nextMessage);
	}

	return (
		<div className="flex h-full flex-col">
			<div className="neo-border-b flex items-center gap-2 px-3 py-3">
				<button
					aria-label="Back to threads"
					className="shrink-0 p-1 transition-colors hover:text-[var(--bg-accent)] disabled:cursor-not-allowed disabled:opacity-60"
					disabled={isBusy}
					onClick={onBack}
					type="button"
				>
					<ArrowLeft className="h-4 w-4" />
				</button>
				<h3 className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-widest">
					{activeTitle}
				</h3>
			</div>
			{errorMessage ? (
				<p className="neo-border-b bg-red-50 px-4 py-3 text-sm font-mono text-red-700">
					{errorMessage}
				</p>
			) : null}
			<div className="flex-1 space-y-3 overflow-y-auto p-3 neo-scrollbar-hidden">
				{thread && thread.messages.length === 0 ? (
					<p className="py-8 text-center font-mono text-sm neo-text-muted">
						Ask anything about this song
					</p>
				) : null}
				{thread
					? thread.messages.map((message) => (
							<MessageBubble key={message.id} message={message} />
						))
					: null}
				<div ref={endRef} />
			</div>

			<form className="neo-border-t flex gap-2 p-3" onSubmit={handleSubmit}>
				<input
					className="neo-input flex-1 text-sm disabled:opacity-60"
					disabled={isBusy}
					onChange={(event) => setInput(event.target.value)}
					placeholder="Ask about a lyric, grammar point, or nuance..."
					value={input}
				/>
				<button
					aria-label="Send message"
					className="neo-button px-3 py-2 disabled:opacity-60"
					disabled={!input.trim() || isBusy}
					type="submit"
				>
					<Send className="h-4 w-4" />
				</button>
			</form>
		</div>
	);
}

export function SongChat({ songId }: { songId: number }) {
	const queryClient = useQueryClient();
	const pageQueryKey = songPageDataQueryKey(songId);
	const { data } = useSuspenseQuery(songPageDataQueryOptions(songId));
	const initialThreads = data.chatThreads;
	const [isOpen, setIsOpen] = useState(false);
	const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
	const [draftThread, setDraftThread] = useState<DraftChatThread | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [threadDeleteError, setThreadDeleteError] = useState<string | null>(
		null,
	);
	const [threadToDelete, setThreadToDelete] =
		useState<SongChatThreadSummary | null>(null);
	const threadDetails = useMemo(
		() => toThreadDetailsRecord(initialThreads),
		[initialThreads],
	);
	const threads = useMemo(
		() => sortThreads(Object.values(threadDetails).map(toThreadSummary)),
		[threadDetails],
	);

	const deleteThreadMutation = useMutation<
		number,
		unknown,
		SongChatThreadSummary,
		{ previousActiveThreadId: number | null; previousPageData?: SongPageData }
	>({
		mutationFn: async (thread) => {
			await deleteSongChatThreadFn({ data: { threadId: thread.id } });
			return thread.id;
		},
		onMutate: async (thread) => {
			setThreadDeleteError(null);
			await queryClient.cancelQueries({ queryKey: pageQueryKey });

			const previousPageData =
				queryClient.getQueryData<SongPageData>(pageQueryKey);
			const previousActiveThreadId = activeThreadId;

			updateSongPageData(queryClient, songId, (currentPageData) => {
				if (!currentPageData) {
					return currentPageData;
				}

				return {
					...currentPageData,
					chatThreads: removeResolvedThread(
						currentPageData.chatThreads,
						thread.id,
					),
				};
			});

			if (previousActiveThreadId === thread.id) {
				setActiveThreadId(null);
			}

			return { previousActiveThreadId, previousPageData };
		},
		onError: (error, _thread, context) => {
			setThreadDeleteError(formatErrorMessage(error));
			if (context?.previousPageData) {
				queryClient.setQueryData(pageQueryKey, context.previousPageData);
			}
			if (context && context.previousActiveThreadId !== null) {
				setActiveThreadId(context.previousActiveThreadId);
			}
		},
		onSuccess: () => {
			setThreadToDelete(null);
		},
	});

	const sendMessageMutation = useMutation<
		SongChatThread,
		unknown,
		{
			assistantMessage: LocalChatMessage;
			assistantMessageId: number;
			isDraftMessage: boolean;
			message: string;
			previousActiveThread: LocalResolvedThread | null;
			previousActiveThreadId: number | null;
			previousDraftThread: DraftChatThread | null;
			userMessage: LocalChatMessage;
		},
		{
			previousPageData?: SongPageData;
			previousDraftThread: DraftChatThread | null;
		}
	>({
		mutationFn: async (variables) => {
			let resolvedThread: SongChatThread | null = null;
			const stream = await sendSongChatMessageFn({
				data: {
					songId,
					message: variables.message,
					threadId: variables.isDraftMessage
						? undefined
						: (variables.previousActiveThreadId ?? undefined),
				},
			});

			for await (const event of stream) {
				if (event.type === "text-delta") {
					if (variables.isDraftMessage) {
						setDraftThread((currentDraft) => {
							if (!currentDraft) {
								return currentDraft;
							}

							return {
								...currentDraft,
								messages: currentDraft.messages.map((currentMessage) =>
									currentMessage.id === variables.assistantMessageId
										? {
												...currentMessage,
												content: `${currentMessage.content}${event.textDelta}`,
											}
										: currentMessage,
								),
							};
						});
					} else if (
						variables.previousActiveThreadId !== null &&
						variables.previousActiveThread
					) {
						updateSongPageData(queryClient, songId, (currentPageData) => {
							if (!currentPageData) {
								return currentPageData;
							}

							const fallbackThread = variables.previousActiveThread;
							if (!fallbackThread) {
								return currentPageData;
							}

							const currentThread =
								currentPageData.chatThreads.find(
									(thread) => thread.id === variables.previousActiveThreadId,
								) ?? fallbackThread;

							return {
								...currentPageData,
								chatThreads: upsertResolvedThread(
									currentPageData.chatThreads,
									appendAssistantDelta(
										currentThread,
										variables.assistantMessageId,
										event.textDelta,
									),
								),
							};
						});
					}

					continue;
				}

				resolvedThread = event.thread;
			}

			if (!resolvedThread) {
				throw new Error("Failed to load the final chat thread state.");
			}

			return resolvedThread;
		},
		onMutate: async (variables) => {
			setErrorMessage(null);

			if (variables.isDraftMessage) {
				setDraftThread((currentDraft) => {
					if (!currentDraft) {
						return currentDraft;
					}

					return {
						...currentDraft,
						title:
							currentDraft.messages.length === 0
								? buildDraftTitle(variables.message)
								: currentDraft.title,
						messages: [
							...currentDraft.messages,
							variables.userMessage,
							variables.assistantMessage,
						],
					};
				});

				return { previousDraftThread: variables.previousDraftThread };
			}

			await queryClient.cancelQueries({ queryKey: pageQueryKey });
			const previousPageData =
				queryClient.getQueryData<SongPageData>(pageQueryKey);

			if (
				variables.previousActiveThreadId !== null &&
				variables.previousActiveThread
			) {
				updateSongPageData(queryClient, songId, (currentPageData) => {
					if (!currentPageData) {
						return currentPageData;
					}

					const fallbackThread = variables.previousActiveThread;
					if (!fallbackThread) {
						return currentPageData;
					}

					return {
						...currentPageData,
						chatThreads: upsertResolvedThread(
							currentPageData.chatThreads,
							appendOptimisticExchange(
								fallbackThread,
								variables.userMessage,
								variables.assistantMessage,
							),
						),
					};
				});
			}

			return {
				previousDraftThread: variables.previousDraftThread,
				previousPageData,
			};
		},
		onError: (error, variables, context) => {
			setErrorMessage(formatErrorMessage(error));

			if (variables.isDraftMessage) {
				setDraftThread(
					context?.previousDraftThread ?? variables.previousDraftThread,
				);
				return;
			}

			if (context?.previousPageData) {
				queryClient.setQueryData(pageQueryKey, context.previousPageData);
			}
		},
		onSuccess: (resolvedThread) => {
			updateSongPageData(queryClient, songId, (currentPageData) => {
				if (!currentPageData) {
					return currentPageData;
				}

				return {
					...currentPageData,
					chatThreads: upsertResolvedThread(
						currentPageData.chatThreads,
						resolvedThread,
					),
				};
			});

			setActiveThreadId(resolvedThread.id);
			setDraftThread(null);
		},
	});

	useEffect(() => {
		if (!isOpen && !threadToDelete) {
			return;
		}

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [isOpen, threadToDelete]);

	const activeThread = useMemo(() => {
		if (draftThread) {
			return draftThread;
		}

		if (activeThreadId === null) {
			return null;
		}

		return threadDetails[activeThreadId] ?? null;
	}, [activeThreadId, draftThread, threadDetails]);

	const activeTitle =
		draftThread?.title ??
		(activeThreadId !== null
			? (threadDetails[activeThreadId]?.title ?? "Thread")
			: "Song Assistant");

	const isDeletingThread = deleteThreadMutation.isPending;
	const isSubmitting = sendMessageMutation.isPending;
	const isBusy = isSubmitting;

	function openDraftThread() {
		setErrorMessage(null);
		setActiveThreadId(null);
		setDraftThread({
			id: "draft",
			title: "New thread",
			messages: [],
		});
		setIsOpen(true);
	}

	function clearActiveThread() {
		if (isSubmitting) {
			return;
		}

		setErrorMessage(null);
		setActiveThreadId(null);
		setDraftThread(null);
	}

	async function selectThread(threadId: number) {
		if (isBusy) {
			return;
		}

		setErrorMessage(null);
		setDraftThread(null);
		setActiveThreadId(threadId);
		setIsOpen(true);
	}

	async function handleDeleteThread() {
		if (!threadToDelete || isDeletingThread) {
			return;
		}

		try {
			await deleteThreadMutation.mutateAsync(threadToDelete);
		} catch (error) {
			setThreadDeleteError(formatErrorMessage(error));
		}
	}

	async function handleSend(message: string) {
		if (isSubmitting) {
			return;
		}

		const timestamp = Date.now();
		const userMessage: LocalChatMessage = {
			id: -timestamp,
			role: "user",
			content: message,
			createdAt: timestamp,
		};
		const assistantMessageId = -(timestamp + 1);
		const assistantMessage: LocalChatMessage = {
			id: assistantMessageId,
			role: "assistant",
			content: "",
			createdAt: timestamp,
			isStreaming: true,
		};

		const previousDraftThread = draftThread;
		const previousActiveThreadId = activeThreadId;
		const previousActiveThread =
			previousActiveThreadId !== null
				? (threadDetails[previousActiveThreadId] ?? null)
				: null;
		const isDraftMessage = previousDraftThread !== null;

		if (!isDraftMessage && !previousActiveThread) {
			setErrorMessage("The selected thread is no longer available.");
			setActiveThreadId(null);
			return;
		}

		try {
			await sendMessageMutation.mutateAsync({
				assistantMessage,
				assistantMessageId,
				isDraftMessage,
				message,
				previousActiveThread,
				previousActiveThreadId,
				previousDraftThread,
				userMessage,
			});
		} catch (error) {
			setErrorMessage(formatErrorMessage(error));
		}
	}

	return (
		<>
			<AnimatePresence>
				{!isOpen ? (
					<motion.button
						animate={{ scale: 1, opacity: 1 }}
						aria-label="Open chat"
						className="neo-button fixed right-4 bottom-4 z-50 flex h-14 w-14 items-center justify-center shadow-[4px_4px_0px_0px_var(--shadow-color)] md:right-6 md:bottom-6"
						exit={{ scale: 0.8, opacity: 0 }}
						initial={false}
						onClick={() => setIsOpen(true)}
						type="button"
					>
						<MessageCircle className="h-6 w-6" />
					</motion.button>
				) : null}
			</AnimatePresence>

			<AnimatePresence>
				{isOpen ? (
					<motion.div
						animate={{ opacity: 1 }}
						className="fixed inset-0 z-40 bg-black/20 md:hidden"
						exit={{ opacity: 0 }}
						initial={{ opacity: 0 }}
						onClick={() => {
							if (!isBusy) {
								setIsOpen(false);
							}
						}}
					/>
				) : null}
			</AnimatePresence>

			<AnimatePresence>
				{isOpen ? (
					<motion.div
						animate={{ opacity: 1, y: 0, scale: 1 }}
						className={[
							"fixed z-50 flex flex-col overflow-hidden neo-border bg-[var(--bg-app)]",
							"shadow-[var(--shadow-offset)_var(--shadow-offset)_0px_0px_var(--shadow-color)]",
							"inset-x-0 bottom-0 h-[85dvh] border-x-0 border-b-0",
							"md:inset-x-auto md:right-6 md:bottom-6 md:left-auto md:h-[560px] md:w-[420px] md:border-2",
						].join(" ")}
						exit={{ opacity: 0, y: 20, scale: 0.95 }}
						initial={{ opacity: 0, y: 20, scale: 0.95 }}
						transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
					>
						<div className="flex items-center justify-between bg-[var(--bg-accent)] px-4 py-2.5">
							<span className="text-sm font-bold uppercase tracking-widest text-[var(--text-on-accent)]">
								Song Assistant
							</span>
							<button
								aria-label="Close chat"
								className="p-1 text-[var(--text-on-accent)] transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
								disabled={isBusy}
								onClick={() => setIsOpen(false)}
								type="button"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						<div className="flex-1 overflow-hidden">
							{draftThread || activeThreadId !== null ? (
								<Conversation
									activeTitle={activeTitle}
									errorMessage={errorMessage}
									isBusy={isSubmitting}
									onBack={clearActiveThread}
									onSend={handleSend}
									thread={activeThread}
								/>
							) : (
								<ThreadList
									errorMessage={errorMessage}
									isBusy={isBusy}
									isDeleting={isDeletingThread}
									onCreate={openDraftThread}
									onDelete={(thread) => {
										setThreadDeleteError(null);
										setThreadToDelete(thread);
									}}
									onSelect={selectThread}
									threads={threads}
								/>
							)}
						</div>

						<div className="h-[env(safe-area-inset-bottom)] bg-[var(--bg-app)] md:hidden" />
					</motion.div>
				) : null}
			</AnimatePresence>

			<ThreadDeleteModal
				errorMessage={threadDeleteError}
				isDeleting={isDeletingThread}
				isOpen={threadToDelete !== null}
				onCancel={() => {
					if (!isDeletingThread) {
						setThreadToDelete(null);
					}
				}}
				onConfirm={() => void handleDeleteThread()}
				thread={threadToDelete}
			/>
		</>
	);
}
