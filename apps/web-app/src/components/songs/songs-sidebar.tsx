import { Link } from "@tanstack/react-router";
import { Music, Play, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SongListItem } from "~/data/ai-studio";

const EMPTY_SCROLL_INDICATOR = {
	hasOverflow: false,
	thumbHeight: 0,
	thumbTop: 0,
};

function isSameScrollIndicator(
	left: typeof EMPTY_SCROLL_INDICATOR,
	right: typeof EMPTY_SCROLL_INDICATOR,
) {
	return (
		left.hasOverflow === right.hasOverflow &&
		left.thumbHeight === right.thumbHeight &&
		left.thumbTop === right.thumbTop
	);
}

export function SongsSidebar({
	onClose,
	selectedSongId,
	songsList,
}: {
	onClose: () => void;
	selectedSongId: number | null;
	songsList: SongListItem[];
}) {
	const scrollAreaRef = useRef<HTMLDivElement | null>(null);
	const [scrollIndicator, setScrollIndicator] = useState(
		EMPTY_SCROLL_INDICATOR,
	);
	const scrollContentSignature = `${selectedSongId ?? "none"}:${songsList
		.map((song) => `${song.id}:${song.title}:${song.artist}`)
		.join("|")}`;

	const updateScrollIndicator = useCallback(() => {
		const node = scrollAreaRef.current;
		if (!node) {
			return;
		}

		const { clientHeight, scrollHeight, scrollTop } = node;
		const hasOverflow = scrollHeight > clientHeight + 1;

		if (!hasOverflow) {
			setScrollIndicator((currentIndicator) =>
				currentIndicator.hasOverflow
					? EMPTY_SCROLL_INDICATOR
					: currentIndicator,
			);
			return;
		}

		const thumbHeight = Math.max(
			28,
			(clientHeight * clientHeight) / scrollHeight,
		);
		const maxThumbTop = clientHeight - thumbHeight;
		const maxScrollTop = scrollHeight - clientHeight;
		const thumbTop =
			maxScrollTop <= 0 ? 0 : (scrollTop / maxScrollTop) * maxThumbTop;

		const nextIndicator = {
			hasOverflow: true,
			thumbHeight,
			thumbTop,
		};

		setScrollIndicator((currentIndicator) =>
			isSameScrollIndicator(currentIndicator, nextIndicator)
				? currentIndicator
				: nextIndicator,
		);
	}, []);

	useEffect(() => {
		void scrollContentSignature;
		updateScrollIndicator();
	}, [scrollContentSignature, updateScrollIndicator]);

	useEffect(() => {
		const node = scrollAreaRef.current;
		if (!node) {
			return;
		}

		const handleResize = () => {
			updateScrollIndicator();
		};

		window.addEventListener("resize", handleResize);

		if (typeof ResizeObserver !== "undefined") {
			const resizeObserver = new ResizeObserver(() => {
				updateScrollIndicator();
			});
			resizeObserver.observe(node);

			return () => {
				window.removeEventListener("resize", handleResize);
				resizeObserver.disconnect();
			};
		}

		return () => {
			window.removeEventListener("resize", handleResize);
		};
	}, [updateScrollIndicator]);

	return (
		<>
			<div className="neo-border-b flex items-center justify-between p-6">
				<h1 className="flex items-center gap-2 text-2xl font-bold tracking-tighter uppercase">
					<Music className="h-6 w-6" />
					UtaSensei
				</h1>
				<button className="md:hidden" onClick={onClose} type="button">
					<X className="h-6 w-6" />
				</button>
			</div>

			<div className="relative min-h-0 flex-1">
				<div
					className="neo-scrollbar-hidden h-full min-h-0 overflow-y-auto p-4 pr-5"
					onScroll={updateScrollIndicator}
					ref={scrollAreaRef}
				>
					<h2 className="mb-4 text-sm font-bold tracking-widest uppercase neo-text-muted">
						Your Library
					</h2>
					<div className="space-y-3">
						{songsList.map((song) => (
							<Link
								className={`flex w-full items-center gap-3 p-3 text-left ${
									selectedSongId === song.id
										? "neo-card"
										: "neo-card-no-hover opacity-80 hover:opacity-100"
								}`}
								key={song.id}
								onClick={onClose}
								params={{ songId: String(song.id) }}
								to="/song/$songId"
							>
								<div className="neo-border flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--bg-accent)]">
									<Play className="ml-1 h-5 w-5 text-[var(--text-on-accent)]" />
								</div>
								<div className="overflow-hidden">
									<p className="truncate font-bold">{song.title}</p>
									<p className="truncate text-xs neo-text-muted">
										{song.artist}
									</p>
								</div>
							</Link>
						))}
					</div>
				</div>
				{scrollIndicator.hasOverflow ? (
					<div
						aria-hidden="true"
						className="neo-sidebar-scroll-rail absolute right-1.5 top-4 bottom-4 z-0 w-[3px]"
					>
						<div
							className="neo-sidebar-scroll-thumb w-full"
							style={{
								height: `${scrollIndicator.thumbHeight}px`,
								transform: `translateY(${scrollIndicator.thumbTop}px)`,
							}}
						/>
					</div>
				) : null}
			</div>

			<div className="neo-border-t relative z-10 bg-[var(--bg-sidebar)] p-4">
				<Link
					className="neo-button flex w-full items-center justify-center gap-2 py-3"
					onClick={onClose}
					to="/"
				>
					<Search className="h-5 w-5" />
					New Song
				</Link>
			</div>
		</>
	);
}
