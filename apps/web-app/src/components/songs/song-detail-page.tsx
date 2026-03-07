import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Music, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NotFound } from "~/components/NotFound";
import { DeleteSongModal } from "~/components/songs/delete-song-modal";
import { FlashcardReviewModal } from "~/components/songs/review/flashcard-review-modal";
import { SongChat } from "~/components/songs/song-chat";
import { SongLessonLines } from "~/components/songs/song-lesson-lines";
import type { Flashcard, FlashcardRun, SongLesson } from "~/data/songs";
import { deleteSongFn } from "~/utils/songs.functions";
import {
	songPageDataQueryKey,
	songsListQueryKey,
} from "~/utils/songs.query-options";

const REVIEW_SWIPE_MS = 280;

type ReviewAction = "forgotten" | "remembered";

function formatSourceLabel(sourceUrl: string): string {
	if (!sourceUrl) {
		return "Source";
	}

	try {
		return new URL(sourceUrl).hostname.replace(/^www\./, "");
	} catch {
		return "Source";
	}
}

export function SongDetailPage({
	flashcardRun,
	showChatWidget = true,
	songLesson,
}: {
	flashcardRun: FlashcardRun | null;
	showChatWidget?: boolean;
	songLesson: SongLesson | null;
}) {
	const safeFlashcardRun = useMemo(
		() => flashcardRun ?? { cards: [], count: 0, runId: 0, songId: 0 },
		[flashcardRun],
	);
	const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());
	const [isReviewOpen, setIsReviewOpen] = useState(false);
	const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
	const [isDeletingSong, setIsDeletingSong] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [reviewLeft, setReviewLeft] = useState<Flashcard[]>(
		() => safeFlashcardRun.cards,
	);
	const [rememberedCardIds, setRememberedCardIds] = useState<number[]>([]);
	const [forgottenCount, setForgottenCount] = useState(0);
	const [isCardFlipped, setIsCardFlipped] = useState(false);
	const [swipeDirection, setSwipeDirection] = useState<ReviewAction | null>(
		null,
	);
	const reviewTimeoutRef = useRef<number | null>(null);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const sourceLabel = useMemo(
		() => formatSourceLabel(songLesson?.run.sourceUrl ?? ""),
		[songLesson?.run.sourceUrl],
	);

	useEffect(() => {
		setExpandedLines(new Set());
		setIsReviewOpen(false);
		setIsDeleteConfirmOpen(false);
		setIsDeletingSong(false);
		setDeleteError(null);
		setReviewLeft(safeFlashcardRun.cards);
		setRememberedCardIds([]);
		setForgottenCount(0);
		setIsCardFlipped(false);
		setSwipeDirection(null);
	}, [safeFlashcardRun]);

	useEffect(() => {
		return () => {
			if (reviewTimeoutRef.current !== null) {
				window.clearTimeout(reviewTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!isReviewOpen && !isDeleteConfirmOpen) {
			return;
		}

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") {
				return;
			}

			if (isDeleteConfirmOpen) {
				if (!isDeletingSong) {
					setIsDeleteConfirmOpen(false);
				}
				return;
			}

			setIsReviewOpen(false);
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isDeleteConfirmOpen, isDeletingSong, isReviewOpen]);

	if (!songLesson) {
		return (
			<div className="p-4 md:p-8 lg:p-12">
				<div className="mx-auto max-w-4xl">
					<div className="neo-card-no-hover p-6 md:p-8">
						<NotFound>Song not found.</NotFound>
					</div>
				</div>
			</div>
		);
	}

	const toggleLine = (index: number) => {
		setExpandedLines((currentValue) => {
			const nextValue = new Set(currentValue);
			if (nextValue.has(index)) {
				nextValue.delete(index);
			} else {
				nextValue.add(index);
			}
			return nextValue;
		});
	};

	const handleReviewAction = (action: ReviewAction) => {
		if (swipeDirection || reviewLeft.length === 0) {
			return;
		}

		const currentCard = reviewLeft[0];
		setSwipeDirection(action);

		reviewTimeoutRef.current = window.setTimeout(() => {
			setReviewLeft((currentLeft) => {
				const [, ...rest] = currentLeft;
				if (action === "remembered") {
					return rest;
				}
				return [...rest, currentCard];
			});

			if (action === "remembered") {
				setRememberedCardIds((currentIds) => [...currentIds, currentCard.id]);
			} else {
				setForgottenCount((currentCount) => currentCount + 1);
			}

			setIsCardFlipped(false);
			setSwipeDirection(null);
			reviewTimeoutRef.current = null;
		}, REVIEW_SWIPE_MS);
	};

	const resetReviewSession = () => {
		setReviewLeft(safeFlashcardRun.cards);
		setRememberedCardIds([]);
		setForgottenCount(0);
		setSwipeDirection(null);
		setIsCardFlipped(false);
	};

	async function handleDeleteSong() {
		if (!songLesson || isDeletingSong) {
			return;
		}

		setDeleteError(null);
		setIsDeletingSong(true);

		try {
			await deleteSongFn({ data: { songId: songLesson.song.id } });
			queryClient.removeQueries({
				queryKey: songPageDataQueryKey(songLesson.song.id),
			});
			await queryClient.invalidateQueries({ queryKey: songsListQueryKey });
			await navigate({ to: "/" });
		} catch (error) {
			setDeleteError(
				error instanceof Error
					? error.message
					: "Song deletion failed. Please try again.",
			);
			setIsDeletingSong(false);
		}
	}

	return (
		<>
			<div className="p-4 md:p-8 lg:p-12">
				<div className="mx-auto max-w-4xl">
					<div className="space-y-8 pb-24">
						<div className="neo-card-no-hover flex flex-col justify-between gap-5 p-6 md:flex-row md:items-end md:p-8">
							<div>
								<h2 className="mb-2 text-4xl font-bold tracking-tighter uppercase md:text-5xl">
									{songLesson.song.title}
								</h2>
								<p className="flex items-center gap-2 text-xl font-mono neo-text-muted">
									<Music className="h-5 w-5" /> {songLesson.song.artist}
								</p>
							</div>

							<div className="flex w-full max-w-[360px] flex-col gap-3 md:items-end">
								<button
									className="neo-button px-4 py-2 text-left text-sm uppercase tracking-[0.16em] md:text-center"
									onClick={() => setIsReviewOpen(true)}
									type="button"
								>
									Review {safeFlashcardRun.count} flashcards
								</button>
								<div className="flex w-full items-stretch gap-3 md:w-auto md:self-end">
									<div className="neo-card-no-hover flex min-w-0 items-center self-start px-4 py-2 text-sm font-bold uppercase neo-text-muted md:flex-none">
										<span className="truncate">Source: {sourceLabel}</span>
									</div>
									<button
										aria-label="Delete song"
										className="neo-button-danger flex shrink-0 items-center justify-center px-3"
										onClick={() => {
											setDeleteError(null);
											setIsDeleteConfirmOpen(true);
										}}
										type="button"
									>
										<Trash2 className="h-5 w-5" />
									</button>
								</div>
							</div>
						</div>

						<SongLessonLines
							expandedLines={expandedLines}
							lines={songLesson.lines}
							onToggle={toggleLine}
						/>
					</div>
				</div>
			</div>

			<FlashcardReviewModal
				forgottenCount={forgottenCount}
				isFlipped={isCardFlipped}
				isOpen={isReviewOpen}
				onClose={() => setIsReviewOpen(false)}
				onFlip={() => setIsCardFlipped((currentValue) => !currentValue)}
				onForget={() => handleReviewAction("forgotten")}
				onRemember={() => handleReviewAction("remembered")}
				onReset={resetReviewSession}
				rememberedCount={rememberedCardIds.length}
				reviewLeft={reviewLeft}
				songTitle={songLesson.song.title}
				swipeDirection={swipeDirection}
				totalCards={safeFlashcardRun.count}
			/>
			<DeleteSongModal
				errorMessage={deleteError}
				isDeleting={isDeletingSong}
				isOpen={isDeleteConfirmOpen}
				onCancel={() => {
					if (isDeletingSong) {
						return;
					}
					setIsDeleteConfirmOpen(false);
				}}
				onConfirm={() => void handleDeleteSong()}
				songTitle={songLesson.song.title}
			/>
			{showChatWidget ? (
				<SongChat key={songLesson.song.id} songId={songLesson.song.id} />
			) : null}
		</>
	);
}
