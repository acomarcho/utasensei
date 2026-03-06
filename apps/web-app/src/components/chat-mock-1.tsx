/**
 * Mock 1: Floating Chat Bubble
 *
 * A circular FAB button in the bottom-right corner. Clicking it opens
 * a compact chat window that floats above the page. The window has a
 * thread list / conversation toggle. Feels like an embedded support widget.
 */
import { ArrowLeft, MessageCircle, Plus, Send, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { ChatThread } from "~/data/chat-mock";
import { useMockChat } from "~/hooks/use-mock-chat";

function formatTime(ts: number) {
	return new Date(ts).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function ThreadList({
	threads,
	onSelect,
	onDelete,
	onCreate,
}: {
	threads: ChatThread[];
	onSelect: (id: string) => void;
	onDelete: (id: string) => void;
	onCreate: () => void;
}) {
	return (
		<div className="flex h-full flex-col">
			<div className="neo-border-b flex items-center justify-between px-4 py-3">
				<h3 className="text-sm font-bold uppercase tracking-widest">Threads</h3>
				<button
					className="neo-button px-2 py-1 text-xs uppercase tracking-wider"
					onClick={onCreate}
					type="button"
				>
					<Plus className="h-3.5 w-3.5" />
				</button>
			</div>
			<div className="flex-1 overflow-y-auto neo-scrollbar-hidden">
				{threads.length === 0 && (
					<p className="p-4 text-center font-mono text-sm neo-text-muted">
						No threads yet
					</p>
				)}
				{threads.map((thread) => (
					<div
						className="neo-border-b flex items-center gap-2 transition-colors hover:bg-[var(--bg-card-hover)]"
						key={thread.id}
					>
						<button
							className="flex-1 px-4 py-3 text-left"
							onClick={() => onSelect(thread.id)}
							type="button"
						>
							<p className="truncate text-sm font-bold">{thread.title}</p>
							<p className="font-mono text-xs neo-text-muted">
								{thread.messages.length} messages
							</p>
						</button>
						<button
							className="mr-2 p-1.5 transition-colors hover:text-[var(--bg-danger)]"
							onClick={() => onDelete(thread.id)}
							type="button"
							aria-label={`Delete thread: ${thread.title}`}
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
	thread,
	isTyping,
	onSend,
	onBack,
}: {
	thread: ChatThread;
	isTyping: boolean;
	onSend: (msg: string) => void;
	onBack: () => void;
}) {
	const [input, setInput] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll when messages change or typing state changes
	useEffect(() => {
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [thread.messages.length, isTyping]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim()) return;
		onSend(input);
		setInput("");
	};

	return (
		<div className="flex h-full flex-col">
			<div className="neo-border-b flex items-center gap-2 px-3 py-3">
				<button
					className="p-1 transition-colors hover:text-[var(--bg-accent)]"
					onClick={onBack}
					type="button"
					aria-label="Back to threads"
				>
					<ArrowLeft className="h-4 w-4" />
				</button>
				<h3 className="flex-1 truncate text-sm font-bold uppercase tracking-widest">
					{thread.title}
				</h3>
			</div>

			<div
				className="flex-1 overflow-y-auto neo-scrollbar-hidden p-3 space-y-3"
				ref={scrollRef}
			>
				{thread.messages.length === 0 && (
					<p className="py-8 text-center font-mono text-sm neo-text-muted">
						Ask anything about this song
					</p>
				)}
				{thread.messages.map((msg) => (
					<div
						className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
						key={msg.id}
					>
						<div
							className={`max-w-[85%] px-3 py-2 text-sm neo-border ${
								msg.role === "user"
									? "bg-[var(--bg-accent)] text-[var(--text-on-accent)]"
									: "bg-[var(--bg-card)]"
							}`}
						>
							<p className="neo-wrap-anywhere">{msg.content}</p>
							<p
								className={`mt-1 font-mono text-[10px] ${
									msg.role === "user"
										? "text-[var(--text-on-accent)] opacity-60"
										: "neo-text-muted"
								}`}
							>
								{formatTime(msg.timestamp)}
							</p>
						</div>
					</div>
				))}
				{isTyping && (
					<div className="flex justify-start">
						<div className="neo-border bg-[var(--bg-card)] px-3 py-2">
							<div className="flex gap-1">
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
						</div>
					</div>
				)}
			</div>

			<form className="neo-border-t flex gap-2 p-3" onSubmit={handleSubmit}>
				<input
					className="neo-input flex-1 text-sm"
					placeholder="Type a message..."
					value={input}
					onChange={(e) => setInput(e.target.value)}
				/>
				<button
					className="neo-button px-3 py-2"
					type="submit"
					disabled={!input.trim()}
					aria-label="Send message"
				>
					<Send className="h-4 w-4" />
				</button>
			</form>
		</div>
	);
}

export function ChatMock1() {
	const [isOpen, setIsOpen] = useState(false);
	const chat = useMockChat();

	useEffect(() => {
		if (!isOpen) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [isOpen]);

	return (
		<>
			{/* FAB Button */}
			<AnimatePresence>
				{!isOpen && (
					<motion.button
						animate={{ scale: 1, opacity: 1 }}
						className="neo-button fixed right-4 bottom-4 z-50 flex h-14 w-14 items-center justify-center shadow-[4px_4px_0px_0px_var(--shadow-color)] md:right-6 md:bottom-6"
						exit={{ scale: 0.8, opacity: 0 }}
						initial={false}
						onClick={() => setIsOpen(true)}
						type="button"
						aria-label="Open chat"
					>
						<MessageCircle className="h-6 w-6" />
					</motion.button>
				)}
			</AnimatePresence>

			{/* Mobile: full-screen backdrop */}
			<AnimatePresence>
				{isOpen && (
					<motion.div
						animate={{ opacity: 1 }}
						className="fixed inset-0 z-40 bg-black/20 md:hidden"
						exit={{ opacity: 0 }}
						initial={{ opacity: 0 }}
						onClick={() => setIsOpen(false)}
					/>
				)}
			</AnimatePresence>

			{/* Chat Window */}
			<AnimatePresence>
				{isOpen && (
					<motion.div
						animate={{ opacity: 1, y: 0, scale: 1 }}
						className={[
							"fixed z-50 flex flex-col overflow-hidden neo-border bg-[var(--bg-app)]",
							"shadow-[var(--shadow-offset)_var(--shadow-offset)_0px_0px_var(--shadow-color)]",
							// Mobile: full-width sheet pinned to bottom, with safe-area padding
							"inset-x-0 bottom-0 h-[85dvh] border-x-0 border-b-0",
							// Desktop: floating window
							"md:inset-x-auto md:right-6 md:bottom-6 md:left-auto md:h-[480px] md:w-[360px] md:border-2",
						].join(" ")}
						exit={{ opacity: 0, y: 20, scale: 0.95 }}
						initial={{ opacity: 0, y: 20, scale: 0.95 }}
						transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
					>
						{/* Header Bar */}
						<div className="flex items-center justify-between bg-[var(--bg-accent)] px-4 py-2.5">
							<span className="text-sm font-bold uppercase tracking-widest text-[var(--text-on-accent)]">
								Song Assistant
							</span>
							<button
								className="p-1 text-[var(--text-on-accent)] transition-opacity hover:opacity-70"
								onClick={() => setIsOpen(false)}
								type="button"
								aria-label="Close chat"
							>
								<X className="h-4 w-4" />
							</button>
						</div>

						{/* Body */}
						<div className="flex-1 overflow-hidden">
							{chat.activeThread ? (
								<Conversation
									isTyping={chat.isTyping}
									onBack={chat.clearActiveThread}
									onSend={chat.sendMessage}
									thread={chat.activeThread}
								/>
							) : (
								<ThreadList
									onCreate={chat.createThread}
									onDelete={chat.deleteThread}
									onSelect={chat.selectThread}
									threads={chat.threads}
								/>
							)}
						</div>

						{/* Safe area spacer for iOS home indicator */}
						<div className="h-[env(safe-area-inset-bottom)] bg-[var(--bg-app)] md:hidden" />
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
