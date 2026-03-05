import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
	ArrowRight,
	BookOpen,
	Check,
	ChevronDown,
	ChevronUp,
	Menu,
	Music,
	Play,
	RotateCcw,
	Search,
	Sparkles,
	X,
} from "lucide-react";
import { MOCK_DATA } from "./data";

const REVIEW_STACK_LIMIT = 5;
const REVIEW_SWIPE_MS = 280;

type ReviewAction = "forgotten" | "remembered";

type MockFlashcard = {
	id: number;
	runId: number;
	front: string;
	back: string;
	sourceTranslationLineId: number;
	sourceVocabEntryId: number;
	createdAt: number;
};

type ParsedCardFace = {
	Line?: string;
	Target?: string;
	Meaning?: string;
	"Line translation"?: string;
};

function buildMockFlashcardRun() {
	let cardId = 1;
	let sourceVocabEntryId = 1;

	const cards: MockFlashcard[] = MOCK_DATA.lines.flatMap((line) =>
		line.vocabularies.map((vocabulary) => ({
			id: cardId++,
			runId: MOCK_DATA.run.id,
			front: `Line: ${line.originalText}\nTarget: ${vocabulary.originalText}`,
			back: `Meaning: ${vocabulary.explanation}\nLine translation: ${line.translationText}`,
			sourceTranslationLineId: line.lineIndex + 1,
			sourceVocabEntryId: sourceVocabEntryId++,
			createdAt: MOCK_DATA.run.createdAt,
		})),
	);

	return {
		songId: MOCK_DATA.song.id,
		runId: MOCK_DATA.run.id,
		count: cards.length,
		cards,
	};
}

function parseCardFace(raw: string): ParsedCardFace {
	const parsedFace: ParsedCardFace = {};

	for (const line of raw.split("\n")) {
		const [label, ...valueParts] = line.split(": ");
		const value = valueParts.join(": ").trim();

		if (!label || !value) {
			continue;
		}

		parsedFace[label.trim() as keyof ParsedCardFace] = value;
	}

	return parsedFace;
}

const FLASHCARD_RUN = buildMockFlashcardRun();

function ReviewDecisionBar({
	disabled,
	isFlipped,
	onFlip,
	onForget,
	onRemember,
}: {
	disabled?: boolean;
	isFlipped: boolean;
	onFlip: () => void;
	onForget: () => void;
	onRemember: () => void;
}) {
	return (
		<div className="grid grid-cols-2 gap-2 p-3 neo-border-t bg-[var(--bg-app)]/70 sm:grid-cols-[1fr_auto_1fr] sm:gap-3 sm:p-4">
			<button
				className="neo-card-no-hover min-w-0 px-3 py-3 text-xs font-bold uppercase tracking-[0.16em] hover:bg-[var(--bg-card-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
				disabled={disabled}
				onClick={onForget}
				type="button"
			>
				<span className="flex items-center justify-center gap-2">
					<X className="h-4 w-4 shrink-0" /> Again
				</span>
			</button>
			<button
				className="neo-card-no-hover order-3 col-span-2 min-w-0 px-3 py-3 text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-[var(--bg-card-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:order-none sm:col-span-1 sm:px-4"
				disabled={disabled}
				onClick={onFlip}
				type="button"
			>
				<span className="flex items-center justify-center gap-2">
					<RotateCcw className="h-4 w-4 shrink-0" />{" "}
					{isFlipped ? "Front" : "Flip"}
				</span>
			</button>
			<button
				className="neo-button min-w-0 px-3 py-3 text-xs uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
				disabled={disabled}
				onClick={onRemember}
				type="button"
			>
				<span className="flex items-center justify-center gap-2">
					<Check className="h-4 w-4 shrink-0" /> Got it
				</span>
			</button>
		</div>
	);
}

function ReviewCardFace({
	card,
	disabled,
	isBack,
	isFlipped,
	onFlip,
	onForget,
	onRemember,
}: {
	card: MockFlashcard;
	disabled?: boolean;
	isBack: boolean;
	isFlipped: boolean;
	onFlip: () => void;
	onForget: () => void;
	onRemember: () => void;
}) {
	const parsedFace = parseCardFace(isBack ? card.back : card.front);
	const primaryLabel = isBack ? "Meaning" : "Target";
	const primaryValue = isBack
		? (parsedFace.Meaning ?? "")
		: (parsedFace.Target ?? "");
	const supportingLabel = isBack ? "Line translation" : "Line";
	const supportingValue = isBack
		? (parsedFace["Line translation"] ?? "")
		: (parsedFace.Line ?? "");
	const primaryValueClassName = isBack
		? "neo-wrap-anywhere mt-2 text-2xl font-bold leading-tight tracking-[-0.03em] sm:text-[2rem] md:text-[2.25rem]"
		: "neo-wrap-anywhere mt-2 text-[1.9rem] font-bold leading-[0.95] tracking-[-0.04em] uppercase sm:text-[2.35rem] md:text-[2.8rem]";

	return (
		<div className={`flashcard-face ${isBack ? "flashcard-face-back" : ""}`}>
			<div className="neo-card-no-hover flex h-full min-w-0 flex-col overflow-hidden bg-[var(--bg-card)]">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-4 p-4 sm:gap-5 sm:p-5 md:p-6">
					<div className="min-w-0 space-y-4">
						<div className="min-w-0">
							<p className="text-[10px] font-bold uppercase tracking-[0.22em] neo-text-muted sm:text-[11px]">
								{primaryLabel}
							</p>
							<h3 className={primaryValueClassName}>{primaryValue}</h3>
						</div>

						<div className="neo-border min-w-0 bg-[var(--bg-app)] px-3 py-3 sm:px-4 sm:py-4">
							<p className="text-[10px] font-bold uppercase tracking-[0.22em] neo-text-muted sm:text-[11px]">
								{supportingLabel}
							</p>
							<p className="neo-wrap-anywhere mt-2 font-mono text-sm leading-relaxed sm:text-[15px]">
								{supportingValue}
							</p>
						</div>
					</div>
				</div>

				<ReviewDecisionBar
					disabled={disabled}
					isFlipped={isFlipped}
					onFlip={onFlip}
					onForget={onForget}
					onRemember={onRemember}
				/>
			</div>
		</div>
	);
}

function ReviewTopCard({
	card,
	isFlipped,
	swipeDirection,
	onFlip,
	onForget,
	onRemember,
}: {
	card: MockFlashcard;
	isFlipped: boolean;
	swipeDirection: ReviewAction | null;
	onFlip: () => void;
	onForget: () => void;
	onRemember: () => void;
}) {
	return (
		<motion.div
			animate={
				swipeDirection === "remembered"
					? { opacity: 0.1, rotate: 14, x: 360, y: 28 }
					: swipeDirection === "forgotten"
						? { opacity: 0.1, rotate: -14, x: -360, y: 28 }
						: { opacity: 1, rotate: 0, x: 0, y: 0 }
			}
			className="absolute inset-0 z-30"
			initial={{ opacity: 0, scale: 0.95, y: -24 }}
			transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
		>
			<div className="flashcard-shell h-full w-full">
				<div
					className={`flashcard-inner h-full w-full ${isFlipped ? "is-flipped" : ""}`}
				>
					<ReviewCardFace
						card={card}
						isBack={false}
						isFlipped={isFlipped}
						onFlip={onFlip}
						onForget={onForget}
						onRemember={onRemember}
					/>
					<ReviewCardFace
						card={card}
						isBack
						isFlipped={isFlipped}
						onFlip={onFlip}
						onForget={onForget}
						onRemember={onRemember}
					/>
				</div>
			</div>
		</motion.div>
	);
}

function ReviewPreviewCard({
	card,
	depth,
}: {
	card: MockFlashcard;
	depth: number;
}) {
	const parsedFace = parseCardFace(card.front);
	const offsetY = depth * 14;
	const rotation = depth % 2 === 0 ? depth * -1.8 : depth * 1.5;
	const scale = 1 - depth * 0.05;
	const opacity = 1 - depth * 0.12;

	return (
		<motion.div
			animate={{ opacity, rotate: rotation, scale, x: 0, y: offsetY }}
			className="absolute inset-0"
			initial={false}
			style={{ zIndex: 20 - depth }}
			transition={{ bounce: 0.2, duration: 0.32, ease: "easeOut" }}
		>
			<div className="neo-card-no-hover flex h-full w-full min-w-0 flex-col justify-between overflow-hidden bg-[var(--bg-card)] px-4 py-4 sm:px-5 sm:py-5">
				<div className="flex items-center justify-between gap-3">
					<span className="text-[10px] font-bold uppercase tracking-[0.18em] neo-text-muted sm:text-[11px]">
						Leftd
					</span>
					<span className="text-[10px] font-bold uppercase tracking-[0.18em] neo-text-muted sm:text-[11px]">
						#{card.id}
					</span>
				</div>
				<div className="min-w-0 space-y-2 sm:space-y-3">
					<p className="text-[10px] font-bold uppercase tracking-[0.22em] neo-text-muted sm:text-[11px]">
						Target
					</p>
					<p className="neo-wrap-anywhere text-xl font-bold uppercase tracking-[-0.04em] sm:text-2xl">
						{parsedFace.Target}
					</p>
				</div>
				<p className="neo-wrap-anywhere hidden font-mono text-xs leading-relaxed neo-text-muted sm:block">
					{parsedFace.Line}
				</p>
			</div>
		</motion.div>
	);
}

function FlashcardReviewModal({
	forgottenCount,
	isFlipped,
	isOpen,
	onClose,
	onFlip,
	onForget,
	onRemember,
	onReset,
	rememberedCount,
	reviewLeft,
	swipeDirection,
}: {
	forgottenCount: number;
	isFlipped: boolean;
	isOpen: boolean;
	onClose: () => void;
	onFlip: () => void;
	onForget: () => void;
	onRemember: () => void;
	onReset: () => void;
	rememberedCount: number;
	reviewLeft: MockFlashcard[];
	swipeDirection: ReviewAction | null;
}) {
	const currentCard = reviewLeft[0];
	const visibleCards = reviewLeft.slice(0, REVIEW_STACK_LIMIT);
	const progress = FLASHCARD_RUN.count
		? (rememberedCount / FLASHCARD_RUN.count) * 100
		: 0;

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					animate={{ opacity: 1 }}
					className="neo-review-backdrop fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-3 sm:p-4 lg:items-center lg:p-8"
					exit={{ opacity: 0 }}
					initial={{ opacity: 0 }}
				>
					<button
						aria-label="Close flashcard review"
						className="absolute inset-0"
						onClick={onClose}
						type="button"
					/>
					<motion.div
						animate={{ opacity: 1, scale: 1, y: 0 }}
						className="neo-card-no-hover relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden bg-[var(--bg-app)] lg:grid lg:max-h-[880px] lg:grid-cols-[minmax(0,1fr)_300px]"
						exit={{ opacity: 0, scale: 0.96, y: 24 }}
						initial={{ opacity: 0, scale: 0.94, y: 30 }}
						transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
					>
						<div className="neo-noise absolute inset-0" />

						<div className="relative order-1 flex min-h-[430px] items-center justify-center overflow-hidden p-4 sm:min-h-[480px] sm:p-6 md:min-h-[560px] md:p-8">
							<div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,140,0,0.18),_transparent_48%)]" />
							<div className="absolute left-4 top-6 h-16 w-16 rotate-[-10deg] neo-border bg-[var(--bg-accent)]/30 sm:left-8 sm:top-10 sm:h-24 sm:w-24" />
							<div className="absolute bottom-8 right-4 h-12 w-12 rotate-[8deg] neo-border bg-[var(--bg-card-hover)] sm:bottom-14 sm:right-10 sm:h-16 sm:w-16" />

							{currentCard ? (
								<div className="relative z-10 flex w-full max-w-[460px] min-w-0 flex-col items-center justify-center">
									<div className="flashcard-scene relative h-[430px] w-full sm:h-[500px] md:h-[540px]">
										{visibleCards
											.slice()
											.reverse()
											.map((card, reverseIndex) => {
												const depth = visibleCards.length - reverseIndex - 1;

												if (depth === 0) {
													return (
														<ReviewTopCard
															card={card}
															isFlipped={isFlipped}
															key={card.id}
															onFlip={onFlip}
															onForget={onForget}
															onRemember={onRemember}
															swipeDirection={swipeDirection}
														/>
													);
												}

												return (
													<ReviewPreviewCard
														card={card}
														depth={depth}
														key={card.id}
													/>
												);
											})}
									</div>
								</div>
							) : (
								<div className="relative z-10 flex max-w-xl flex-col items-center text-center">
									<div className="neo-card-no-hover bg-[var(--bg-card)] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.24em] neo-text-muted">
										Session complete
									</div>
									<h4 className="mt-6 text-4xl font-bold uppercase tracking-[-0.06em] sm:text-5xl">
										Deck cleared.
									</h4>
									<p className="mt-4 max-w-md font-mono text-sm leading-relaxed neo-text-muted">
										You pushed every card through the stack. Restart if you want
										another lap, or close this and keep reading the song notes.
									</p>
									<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
										<button
											className="neo-button px-5 py-3"
											onClick={onReset}
											type="button"
										>
											Restart session
										</button>
										<button
											className="neo-card-no-hover px-5 py-3 font-bold uppercase tracking-[0.18em] hover:bg-[var(--bg-card-hover)]"
											onClick={onClose}
											type="button"
										>
											Close review
										</button>
									</div>
								</div>
							)}
						</div>

						<div className="relative order-2 overflow-y-auto border-t-2 border-black p-4 sm:p-5 lg:border-t-0 lg:border-l-2 lg:p-6">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="text-[10px] font-bold uppercase tracking-[0.22em] neo-text-muted sm:text-[11px]">
										Flashcard review
									</p>
									<h3 className="neo-wrap-anywhere mt-2 text-3xl font-bold uppercase tracking-[-0.05em] sm:text-4xl">
										One Voice
									</h3>
								</div>
								<button
									className="neo-card-no-hover shrink-0 p-3 hover:bg-[var(--bg-card-hover)]"
									onClick={onClose}
									type="button"
								>
									<X className="h-5 w-5" />
								</button>
							</div>

							<div className="mt-5 space-y-3 sm:space-y-4">
								<div className="neo-card-no-hover bg-[var(--bg-card-hover)] p-4">
									<p className="text-[10px] font-bold uppercase tracking-[0.22em] neo-text-muted sm:text-[11px]">
										Session progress
									</p>
									<div className="mt-3 h-3 overflow-hidden neo-border bg-[var(--bg-app)] sm:mt-4">
										<motion.div
											animate={{ width: `${progress}%` }}
											className="h-full bg-[var(--bg-accent)]"
											initial={false}
										/>
									</div>
									<div className="mt-3 grid grid-cols-3 gap-2 text-center sm:mt-4">
										<div className="neo-border neo-stat-chip bg-[var(--bg-app)] px-2 py-3">
											<p className="text-[10px] font-bold uppercase tracking-[0.14em] neo-text-muted">
												Known
											</p>
											<p className="mt-1 text-xl font-bold sm:text-2xl">
												{rememberedCount}
											</p>
										</div>
										<div className="neo-border neo-stat-chip bg-[var(--bg-app)] px-2 py-3">
											<p className="text-[10px] font-bold uppercase tracking-[0.14em] neo-text-muted">
												Again
											</p>
											<p className="mt-1 text-xl font-bold sm:text-2xl">
												{forgottenCount}
											</p>
										</div>
										<div className="neo-border neo-stat-chip bg-[var(--bg-app)] px-2 py-3">
											<p className="text-[10px] font-bold uppercase tracking-[0.14em] neo-text-muted">
												Left
											</p>
											<p className="mt-1 text-xl font-bold sm:text-2xl">
												{reviewLeft.length}
											</p>
										</div>
									</div>
								</div>

								<div className="neo-card-no-hover bg-[var(--bg-accent)] p-4 text-[var(--text-on-accent)]">
									<p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] sm:text-[11px]">
										<Sparkles className="h-4 w-4 shrink-0" /> Review tip
									</p>
									<p className="neo-wrap-anywhere mt-3 font-mono text-sm leading-relaxed">
										Try to recall the meaning before flipping the card.
									</p>
								</div>
							</div>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

export default function App() {
	const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const [urlInput, setUrlInput] = useState("");
	const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());
	const [isReviewOpen, setIsReviewOpen] = useState(false);
	const [reviewLeft, setReviewLeft] = useState<MockFlashcard[]>(
		() => FLASHCARD_RUN.cards,
	);
	const [rememberedCardIds, setRememberedCardIds] = useState<number[]>([]);
	const [forgottenCount, setForgottenCount] = useState(0);
	const [isCardFlipped, setIsCardFlipped] = useState(false);
	const [swipeDirection, setSwipeDirection] = useState<ReviewAction | null>(
		null,
	);
	const reviewTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (reviewTimeoutRef.current !== null) {
				window.clearTimeout(reviewTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!isReviewOpen) {
			return;
		}

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsReviewOpen(false);
			}
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isReviewOpen]);

	const toggleLine = (index: number) => {
		const newSet = new Set(expandedLines);
		if (newSet.has(index)) {
			newSet.delete(index);
		} else {
			newSet.add(index);
		}
		setExpandedLines(newSet);
	};

	const handleGenerate = () => {
		if (urlInput) {
			setSelectedSongId(1);
			setUrlInput("");
		}
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
		setReviewLeft(FLASHCARD_RUN.cards);
		setRememberedCardIds([]);
		setForgottenCount(0);
		setSwipeDirection(null);
		setIsCardFlipped(false);
	};

	const songsList = [
		{ id: 1, title: MOCK_DATA.song.title, artist: MOCK_DATA.song.artist },
		{ id: 2, title: "Yoru ni Kakeru", artist: "YOASOBI" },
		{ id: 3, title: "Pretender", artist: "Official HIGE DANdism" },
	];

	return (
		<>
			<div className="neo-app flex h-screen overflow-hidden font-sans">
				{isSidebarOpen && (
					<button
						aria-label="Close sidebar"
						className="fixed inset-0 z-40 bg-black/50 md:hidden"
						onClick={() => setIsSidebarOpen(false)}
						type="button"
					/>
				)}

				<aside
					className={`neo-sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col transition-transform duration-300 ease-in-out md:static ${
						isSidebarOpen
							? "translate-x-0"
							: "-translate-x-full md:translate-x-0"
					}`}
				>
					<div className="neo-border-b flex items-center justify-between p-6">
						<h1 className="flex items-center gap-2 text-2xl font-bold tracking-tighter uppercase">
							<Music className="h-6 w-6" />
							UtaSensei
						</h1>
						<button
							className="md:hidden"
							onClick={() => setIsSidebarOpen(false)}
							type="button"
						>
							<X className="h-6 w-6" />
						</button>
					</div>

					<div className="flex-1 overflow-y-auto p-4">
						<h2 className="mb-4 text-sm font-bold tracking-widest uppercase neo-text-muted">
							Your Library
						</h2>
						<div className="space-y-3">
							{songsList.map((song) => (
								<button
									className={`w-full p-3 text-left ${
										selectedSongId === song.id
											? "neo-card"
											: "neo-card-no-hover opacity-80 hover:opacity-100"
									} flex items-center gap-3`}
									key={song.id}
									onClick={() => {
										setSelectedSongId(song.id);
										setIsSidebarOpen(false);
									}}
									type="button"
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
								</button>
							))}
						</div>
					</div>

					<div className="neo-border-t p-4">
						<button
							className="neo-button flex w-full items-center justify-center gap-2 py-3"
							onClick={() => {
								setSelectedSongId(null);
								setIsSidebarOpen(false);
							}}
							type="button"
						>
							<Search className="h-5 w-5" />
							New Song
						</button>
					</div>
				</aside>

				<main className="relative flex h-full flex-1 flex-col overflow-hidden">
					<header className="neo-border-b z-30 flex items-center gap-4 bg-[var(--bg-app)] p-4 md:hidden">
						<button
							className="neo-card-no-hover p-2"
							onClick={() => setIsSidebarOpen(true)}
							type="button"
						>
							<Menu className="h-6 w-6" />
						</button>
						<h1 className="truncate text-xl font-bold uppercase">
							{selectedSongId ? MOCK_DATA.song.title : "New Song"}
						</h1>
					</header>

					<div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
						<div className="mx-auto max-w-4xl">
							{!selectedSongId ? (
								<div className="flex min-h-[70vh] flex-col items-center justify-center space-y-8 text-center">
									<div className="relative">
										<div className="neo-border absolute -inset-4 z-0 rotate-2 bg-[var(--bg-accent)]" />
										<div className="neo-card-no-hover relative z-10 bg-[var(--bg-card)] p-8 md:p-12">
											<h2 className="mb-4 text-4xl font-bold tracking-tighter uppercase md:text-6xl">
												Learn Japanese
												<br />
												From Lyrics
											</h2>
											<p className="mb-8 text-lg font-mono neo-text-muted md:text-xl">
												Paste a URL to generate a lesson.
											</p>

											<div className="flex flex-col gap-4 md:flex-row">
												<input
													className="neo-input flex-1 text-lg font-mono"
													onChange={(event) => setUrlInput(event.target.value)}
													placeholder="e.g. https://genius.com/..."
													type="text"
													value={urlInput}
												/>
												<button
													className="neo-button flex items-center justify-center gap-2 px-8 py-4 text-lg"
													onClick={handleGenerate}
													type="button"
												>
													Generate <ArrowRight className="h-5 w-5" />
												</button>
											</div>
										</div>
									</div>
								</div>
							) : (
								<div className="space-y-8 pb-24">
									<div className="neo-card-no-hover flex flex-col justify-between gap-5 p-6 md:flex-row md:items-end md:p-8">
										<div>
											<h2 className="mb-2 text-4xl font-bold tracking-tighter uppercase md:text-5xl">
												{MOCK_DATA.song.title}
											</h2>
											<p className="flex items-center gap-2 text-xl font-mono neo-text-muted">
												<Music className="h-5 w-5" /> {MOCK_DATA.song.artist}
											</p>
										</div>

										<div className="flex w-full max-w-[320px] flex-col gap-3 md:items-end">
											<div className="neo-card-no-hover w-full bg-[var(--bg-card-hover)] p-4 md:max-w-[300px]">
												<p className="text-[11px] font-bold uppercase tracking-[0.22em] neo-text-muted">
													Flashcard review
												</p>
												<div className="mt-3 flex items-end justify-between gap-4">
													<div>
														<p className="text-4xl font-bold tracking-[-0.05em]">
															{FLASHCARD_RUN.count}
														</p>
														<p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] neo-text-muted">
															111 flashcards
														</p>
													</div>
													<button
														className="neo-button px-4 py-3 text-xs uppercase tracking-[0.18em]"
														onClick={() => setIsReviewOpen(true)}
														type="button"
													>
														Review deck
													</button>
												</div>
											</div>
											<div className="neo-border inline-block self-start bg-[var(--bg-accent)] px-4 py-2 text-sm font-bold uppercase text-[var(--text-on-accent)] md:self-auto">
												Source: Genius
											</div>
										</div>
									</div>

									<div className="space-y-4">
										{MOCK_DATA.lines.map((line) => {
											const isExpanded = expandedLines.has(line.lineIndex);
											return (
												<div
													className="neo-card-no-hover overflow-hidden"
													key={line.lineIndex}
												>
													<button
														className="flex w-full items-start justify-between gap-4 p-4 text-left transition-colors hover:bg-[var(--bg-card-hover)] md:p-6"
														onClick={() => toggleLine(line.lineIndex)}
														type="button"
													>
														<div className="flex-1">
															<p className="mb-2 text-xl font-bold md:text-2xl">
																{line.originalText}
															</p>
															<p className="text-md font-mono neo-text-muted">
																{line.translationText}
															</p>
														</div>
														<div className="neo-border shrink-0 bg-[var(--bg-app)] p-2">
															{isExpanded ? (
																<ChevronUp className="h-5 w-5" />
															) : (
																<ChevronDown className="h-5 w-5" />
															)}
														</div>
													</button>

													{isExpanded && (
														<div className="neo-border-t bg-[var(--bg-app)]/30 p-4 md:p-6">
															<div className="mb-6">
																<h4 className="mb-2 flex items-center gap-2 text-sm font-bold tracking-widest uppercase">
																	<BookOpen className="h-4 w-4" /> Explanation
																</h4>
																<p className="font-mono text-sm leading-relaxed md:text-base">
																	{line.longFormExplanation}
																</p>
															</div>

															<div>
																<h4 className="mb-3 text-sm font-bold tracking-widest uppercase">
																	Vocabulary
																</h4>
																<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
																	{line.vocabularies.map((vocabulary) => (
																		<div
																			className="neo-border bg-[var(--bg-card)] p-3"
																			key={`${line.lineIndex}-${vocabulary.originalText}`}
																		>
																			<p className="mb-1 font-bold">
																				{vocabulary.originalText}
																			</p>
																			<p className="font-mono text-xs neo-text-muted">
																				{vocabulary.explanation}
																			</p>
																		</div>
																	))}
																</div>
															</div>
														</div>
													)}
												</div>
											);
										})}
									</div>
								</div>
							)}
						</div>
					</div>
				</main>
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
				swipeDirection={swipeDirection}
			/>
		</>
	);
}
