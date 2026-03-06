import { useCallback, useState } from "react";
import {
	type ChatMessage,
	type ChatThread,
	MOCK_THREADS,
	createNewThread,
	getMockBotResponse,
} from "~/data/chat-mock";

export function useMockChat() {
	const [threads, setThreads] = useState<ChatThread[]>(() => [...MOCK_THREADS]);
	const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
	const [isTyping, setIsTyping] = useState(false);

	const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

	const createThread = useCallback(() => {
		const thread = createNewThread();
		setThreads((prev) => [thread, ...prev]);
		setActiveThreadId(thread.id);
		return thread;
	}, []);

	const deleteThread = useCallback(
		(threadId: string) => {
			setThreads((prev) => prev.filter((t) => t.id !== threadId));
			if (activeThreadId === threadId) {
				setActiveThreadId(null);
			}
		},
		[activeThreadId],
	);

	const selectThread = useCallback((threadId: string) => {
		setActiveThreadId(threadId);
	}, []);

	const sendMessage = useCallback(
		(content: string) => {
			if (!activeThreadId || !content.trim()) return;

			const userMessage: ChatMessage = {
				id: `msg-${Date.now()}`,
				role: "user",
				content: content.trim(),
				timestamp: Date.now(),
			};

			setThreads((prev) =>
				prev.map((t) => {
					if (t.id !== activeThreadId) return t;
					const updated = {
						...t,
						messages: [...t.messages, userMessage],
					};
					if (t.messages.length === 0) {
						updated.title =
							content.trim().length > 30
								? `${content.trim().slice(0, 30)}...`
								: content.trim();
					}
					return updated;
				}),
			);

			setIsTyping(true);

			setTimeout(() => {
				const botMessage: ChatMessage = {
					id: `msg-${Date.now()}-bot`,
					role: "assistant",
					content: getMockBotResponse(),
					timestamp: Date.now(),
				};

				setThreads((prev) =>
					prev.map((t) =>
						t.id === activeThreadId
							? { ...t, messages: [...t.messages, botMessage] }
							: t,
					),
				);
				setIsTyping(false);
			}, 1200);
		},
		[activeThreadId],
	);

	const clearActiveThread = useCallback(() => {
		setActiveThreadId(null);
	}, []);

	return {
		threads,
		activeThread,
		activeThreadId,
		isTyping,
		createThread,
		deleteThread,
		selectThread,
		sendMessage,
		clearActiveThread,
	};
}
