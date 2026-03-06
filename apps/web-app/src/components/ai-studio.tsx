import {
	Link,
	Outlet,
	useLocation,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import {
	ArrowRight,
	BookOpen,
	Check,
	ChevronDown,
	Menu,
	Music,
	Play,
	RotateCcw,
	Search,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import {
	AnimatePresence,
	motion,
	useMotionValue,
	useTransform,
} from "motion/react";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { NotFound } from "~/components/NotFound";
import { SongChat } from "~/components/song-chat";
import type {
	Flashcard,
	FlashcardRun,
	SongChatThread,
	SongLesson,
	SongListItem,
} from "~/data/ai-studio";
import {
	DEFAULT_SONG_GENERATION_MODEL_ID,
	SONG_GENERATION_MODEL_OPTIONS,
	type SongGenerationModelId,
} from "~/utils/song-generation-models";
import { deleteSongFn } from "~/utils/songs.functions";

const REVIEW_STACK_LIMIT = 5;
const REVIEW_SWIPE_MS = 280;
const REVIEW_DRAG_THRESHOLD = 110;
const EMPTY_SCROLL_INDICATOR = {
	hasOverflow: false,
	thumbHeight: 0,
	thumbTop: 0,
};

type ReviewAction = "forgotten" | "remembered";

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

type ParsedCardFace = {
	Line?: string;
	Target?: string;
	Meaning?: string;
	"Line translation"?: string;
};

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

function SongModelPicker({
	disabled,
	onChange,
	value,
}: {
	disabled: boolean;
	onChange: (nextValue: SongGenerationModelId) => void;
	value: SongGenerationModelId;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(() =>
		Math.max(
			SONG_GENERATION_MODEL_OPTIONS.findIndex((option) => option.id === value),
			0,
		),
	);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const listboxId = useId();
	const selectedOption =
		SONG_GENERATION_MODEL_OPTIONS.find((option) => option.id === value) ??
		SONG_GENERATION_MODEL_OPTIONS[0];

	useEffect(() => {
		setActiveIndex(
			Math.max(
				SONG_GENERATION_MODEL_OPTIONS.findIndex(
					(option) => option.id === value,
				),
				0,
			),
		);
	}, [value]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handlePointerDown = (event: PointerEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") {
				return;
			}

			setIsOpen(false);
			triggerRef.current?.focus();
		};

		document.addEventListener("pointerdown", handlePointerDown);
		document.addEventListener("keydown", handleEscape);

		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		optionRefs.current[activeIndex]?.focus();
	}, [activeIndex, isOpen]);

	const moveActiveIndex = useCallback((direction: 1 | -1) => {
		setActiveIndex((currentValue) => {
			const total = SONG_GENERATION_MODEL_OPTIONS.length;
			return (currentValue + direction + total) % total;
		});
	}, []);

	const commitSelection = useCallback(
		(nextIndex: number) => {
			const nextOption = SONG_GENERATION_MODEL_OPTIONS[nextIndex];
			if (!nextOption) {
				return;
			}

			onChange(nextOption.id);
			setActiveIndex(nextIndex);
			setIsOpen(false);
			triggerRef.current?.focus();
		},
		[onChange],
	);

	return (
		<div className="relative w-full lg:w-64 lg:shrink-0" ref={containerRef}>
			<p className="mb-2 text-left text-[11px] font-bold uppercase tracking-[0.2em] neo-text-muted">
				Model
			</p>
			<button
				aria-controls={listboxId}
				aria-expanded={isOpen}
				aria-haspopup="listbox"
				className="neo-card-no-hover flex w-full items-center justify-between gap-3 px-4 py-4 text-left disabled:cursor-not-allowed disabled:opacity-60"
				disabled={disabled}
				onClick={() => {
					setActiveIndex(
						Math.max(
							SONG_GENERATION_MODEL_OPTIONS.findIndex(
								(option) => option.id === value,
							),
							0,
						),
					);
					setIsOpen((currentValue) => !currentValue);
				}}
				onKeyDown={(event) => {
					if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
						return;
					}

					event.preventDefault();
					setIsOpen(true);
					if (event.key === "ArrowDown") {
						moveActiveIndex(1);
					}
					if (event.key === "ArrowUp") {
						moveActiveIndex(-1);
					}
				}}
				ref={triggerRef}
				type="button"
			>
				<div className="min-w-0">
					<p className="truncate text-lg font-bold uppercase tracking-[-0.04em]">
						{selectedOption.label}
					</p>
				</div>
				<motion.div
					animate={{ rotate: isOpen ? 180 : 0 }}
					className="neo-border flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--bg-app)]"
					initial={false}
					transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
				>
					<ChevronDown className="h-5 w-5" />
				</motion.div>
			</button>

			<AnimatePresence initial={false}>
				{isOpen && (
					<motion.div
						animate={{ opacity: 1, scale: 1, y: 0 }}
						className="neo-card-no-hover absolute inset-x-0 top-[calc(100%+0.6rem)] z-30 overflow-hidden bg-[var(--bg-card)]"
						exit={{ opacity: 0, scale: 0.98, y: -6 }}
						initial={{ opacity: 0, scale: 0.98, y: -6 }}
						transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
					>
						<div
							aria-label="Song generation model"
							className="p-2"
							id={listboxId}
							role="listbox"
						>
							{SONG_GENERATION_MODEL_OPTIONS.map((option, index) => {
								const isActive = index === activeIndex;
								const isSelected = option.id === value;

								return (
									<button
										aria-selected={isSelected}
										className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-all ${
											isActive
												? "bg-[var(--bg-card-hover)] -translate-x-[2px] -translate-y-[2px]"
												: "bg-[var(--bg-card)]"
										}`}
										key={option.id}
										onClick={() => commitSelection(index)}
										onKeyDown={(event) => {
											if (event.key === "ArrowDown") {
												event.preventDefault();
												moveActiveIndex(1);
											}

											if (event.key === "ArrowUp") {
												event.preventDefault();
												moveActiveIndex(-1);
											}

											if (["Enter", " "].includes(event.key)) {
												event.preventDefault();
												commitSelection(index);
											}
										}}
										ref={(element) => {
											optionRefs.current[index] = element;
										}}
										role="option"
										type="button"
									>
										<div className="min-w-0">
											<p className="truncate text-sm font-bold uppercase tracking-[0.16em]">
												{option.label}
											</p>
										</div>
										{isSelected ? (
											<div className="neo-border flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--bg-accent)] text-[var(--text-on-accent)]">
												<Check className="h-4 w-4" />
											</div>
										) : null}
									</button>
								);
							})}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

function SidebarContent({
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

function ReviewDecisionBar({
	disabled,
	onFlip,
	onForget,
	onRemember,
}: {
	disabled?: boolean;
	onFlip: () => void;
	onForget: () => void;
	onRemember: () => void;
}) {
	return (
		<div className="neo-border-t grid grid-cols-2 gap-2 bg-[var(--bg-app)]/70 p-3 sm:gap-3 sm:p-4">
			<button
				className="neo-card-no-hover col-span-2 min-w-0 px-3 py-3 text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-[var(--bg-card-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
				disabled={disabled}
				onClick={onFlip}
				type="button"
			>
				<span className="flex items-center justify-center gap-2">
					<RotateCcw className="h-4 w-4 shrink-0" /> Flip
				</span>
			</button>
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
	onFlip,
	onForget,
	onRemember,
}: {
	card: Flashcard;
	disabled?: boolean;
	isBack: boolean;
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
	card: Flashcard;
	isFlipped: boolean;
	swipeDirection: ReviewAction | null;
	onFlip: () => void;
	onForget: () => void;
	onRemember: () => void;
}) {
	const [dragIntent, setDragIntent] = useState<ReviewAction | "return" | null>(
		null,
	);
	const dragX = useMotionValue(0);
	const dragRotate = useTransform(dragX, [-220, 0, 220], [-10, 0, 10]);
	const leftGlowOpacity = useTransform(
		dragX,
		[-REVIEW_DRAG_THRESHOLD, -24, 0],
		[0.22, 0.08, 0],
	);
	const rightGlowOpacity = useTransform(
		dragX,
		[0, 24, REVIEW_DRAG_THRESHOLD],
		[0, 0.08, 0.22],
	);

	const handleDrag = (
		_event: MouseEvent | TouchEvent | PointerEvent,
		info: { offset: { x: number } },
	) => {
		const offsetX = info.offset.x;

		if (offsetX >= REVIEW_DRAG_THRESHOLD) {
			setDragIntent("remembered");
			return;
		}

		if (offsetX <= -REVIEW_DRAG_THRESHOLD) {
			setDragIntent("forgotten");
			return;
		}

		if (Math.abs(offsetX) > 20) {
			setDragIntent("return");
			return;
		}

		setDragIntent(null);
	};

	const handleDragEnd = (
		_event: MouseEvent | TouchEvent | PointerEvent,
		info: { offset: { x: number } },
	) => {
		if (swipeDirection) {
			return;
		}

		if (info.offset.x >= REVIEW_DRAG_THRESHOLD) {
			setDragIntent(null);
			onRemember();
			return;
		}

		if (info.offset.x <= -REVIEW_DRAG_THRESHOLD) {
			setDragIntent(null);
			onForget();
			return;
		}

		setDragIntent(null);
	};

	const dragHintLabel =
		dragIntent === "remembered"
			? "Release to mark known"
			: dragIntent === "forgotten"
				? "Release for again"
				: dragIntent === "return"
					? "Release to return"
					: null;

	return (
		<motion.div
			animate={
				swipeDirection === "remembered"
					? { opacity: 0.1, x: 360, y: 28 }
					: swipeDirection === "forgotten"
						? { opacity: 0.1, x: -360, y: 28 }
						: { opacity: 1, x: 0, y: 0 }
			}
			className="absolute inset-x-1 inset-y-2 z-30 sm:inset-0"
			drag={swipeDirection ? false : "x"}
			dragConstraints={{ left: 0, right: 0 }}
			dragElastic={0.18}
			dragMomentum={false}
			initial={{ opacity: 0, scale: 0.95, y: -24 }}
			onDrag={handleDrag}
			onDragEnd={handleDragEnd}
			style={{ rotate: dragRotate, x: dragX }}
			transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
		>
			<motion.div
				className="pointer-events-none absolute inset-0 rounded-[2px] bg-[linear-gradient(90deg,rgba(0,0,0,0.12),transparent_45%)]"
				style={{ opacity: leftGlowOpacity }}
			/>
			<motion.div
				className="pointer-events-none absolute inset-0 rounded-[2px] bg-[linear-gradient(270deg,rgba(255,140,0,0.18),transparent_45%)]"
				style={{ opacity: rightGlowOpacity }}
			/>
			<AnimatePresence>
				{dragHintLabel && !swipeDirection && (
					<motion.div
						animate={{ opacity: 1, y: 0 }}
						className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2"
						exit={{ opacity: 0, y: -6 }}
						initial={{ opacity: 0, y: -8 }}
					>
						<div className="neo-card-no-hover px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] neo-text-muted">
							{dragHintLabel}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
			<div className="flashcard-shell flashcard-draggable h-full w-full">
				<div
					className={`flashcard-inner h-full w-full ${isFlipped ? "is-flipped" : ""}`}
				>
					<ReviewCardFace
						card={card}
						isBack={false}
						onFlip={onFlip}
						onForget={onForget}
						onRemember={onRemember}
					/>
					<ReviewCardFace
						card={card}
						isBack
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
	card: Flashcard;
	depth: number;
}) {
	const parsedFace = parseCardFace(card.front);
	const offsetY = depth * 10;
	const rotation = depth % 2 === 0 ? depth * -1.8 : depth * 1.5;
	const scale = 1 - depth * 0.05;
	const opacity = 1 - depth * 0.12;

	return (
		<motion.div
			animate={{ opacity, rotate: rotation, scale, x: 0, y: offsetY }}
			className="absolute inset-x-1 inset-y-2 sm:inset-0"
			initial={false}
			style={{ zIndex: 20 - depth }}
			transition={{ bounce: 0.2, duration: 0.32, ease: "easeOut" }}
		>
			<div className="neo-card-no-hover flex h-full w-full min-w-0 flex-col justify-between overflow-hidden bg-[var(--bg-card)] px-4 py-4 sm:px-5 sm:py-5">
				<div className="flex items-center justify-between gap-3">
					<span className="text-[10px] font-bold uppercase tracking-[0.18em] neo-text-muted sm:text-[11px]">
						Queued
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
	songTitle,
	swipeDirection,
	totalCards,
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
	reviewLeft: Flashcard[];
	songTitle: string;
	swipeDirection: ReviewAction | null;
	totalCards: number;
}) {
	const currentCard = reviewLeft[0];
	const visibleCards = reviewLeft.slice(0, REVIEW_STACK_LIMIT);
	const progress = totalCards ? (rememberedCount / totalCards) * 100 : 0;

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

						<div className="relative order-2 flex min-h-[460px] items-center justify-center overflow-hidden px-3 pb-5 pt-2 sm:min-h-[520px] sm:px-5 sm:pb-6 sm:pt-3 md:min-h-[560px] md:p-8">
							<div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,140,0,0.18),_transparent_48%)]" />
							<div className="neo-border absolute left-4 top-6 h-16 w-16 rotate-[-10deg] bg-[var(--bg-accent)]/30 sm:left-8 sm:top-10 sm:h-24 sm:w-24" />
							<div className="neo-border absolute bottom-8 right-4 h-12 w-12 rotate-[8deg] bg-[var(--bg-card-hover)] sm:bottom-14 sm:right-10 sm:h-16 sm:w-16" />

							{currentCard ? (
								<div className="relative z-10 flex w-full max-w-[460px] min-w-0 flex-col items-center justify-center">
									<div className="flashcard-scene relative h-[450px] w-full sm:h-[520px] md:h-[540px]">
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

						<div className="relative order-1 border-b-2 border-black p-3 sm:p-4 lg:order-2 lg:overflow-y-auto lg:border-b-0 lg:border-l-2 lg:p-6">
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0">
									<p className="text-[10px] font-bold uppercase tracking-[0.18em] neo-text-muted sm:text-[11px]">
										Flashcard review
									</p>
									<h3 className="neo-wrap-anywhere mt-1 text-2xl font-bold uppercase tracking-[-0.05em] sm:text-3xl lg:mt-2 lg:text-4xl">
										{songTitle}
									</h3>
								</div>
								<button
									className="neo-card-no-hover shrink-0 p-2.5 hover:bg-[var(--bg-card-hover)] sm:p-3"
									onClick={onClose}
									type="button"
								>
									<X className="h-5 w-5" />
								</button>
							</div>

							<div className="neo-border mt-3 h-2.5 overflow-hidden bg-[var(--bg-card-hover)] sm:mt-4 lg:h-3">
								<motion.div
									animate={{ width: `${progress}%` }}
									className="h-full bg-[var(--bg-accent)]"
									initial={false}
								/>
							</div>

							<div className="mt-3 grid grid-cols-3 gap-2 text-center lg:mt-5">
								<div className="neo-border neo-stat-chip bg-[var(--bg-card)] px-2 py-2">
									<p className="text-[9px] font-bold uppercase tracking-[0.12em] neo-text-muted sm:text-[10px]">
										Known
									</p>
									<p className="mt-1 text-lg font-bold sm:text-xl lg:text-2xl">
										{rememberedCount}
									</p>
								</div>
								<div className="neo-border neo-stat-chip bg-[var(--bg-card)] px-2 py-2">
									<p className="text-[9px] font-bold uppercase tracking-[0.12em] neo-text-muted sm:text-[10px]">
										Again
									</p>
									<p className="mt-1 text-lg font-bold sm:text-xl lg:text-2xl">
										{forgottenCount}
									</p>
								</div>
								<div className="neo-border neo-stat-chip bg-[var(--bg-card)] px-2 py-2">
									<p className="text-[9px] font-bold uppercase tracking-[0.12em] neo-text-muted sm:text-[10px]">
										Left
									</p>
									<p className="mt-1 text-lg font-bold sm:text-xl lg:text-2xl">
										{reviewLeft.length}
									</p>
								</div>
							</div>

							<div className="mt-4 hidden lg:block">
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

export function AiStudioShell({ songsList }: { songsList: SongListItem[] }) {
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const pathname = useLocation({ select: (state) => state.pathname });
	const pathMatch = pathname.match(/^\/song\/(\d+)$/);
	const selectedSongId = pathMatch ? Number(pathMatch[1]) : null;
	const selectedSong = selectedSongId
		? (songsList.find((song) => song.id === selectedSongId) ?? null)
		: null;

	return (
		<div className="neo-app flex h-screen overflow-hidden font-sans">
			<AnimatePresence>
				{isSidebarOpen && (
					<>
						<motion.button
							animate={{ opacity: 1 }}
							aria-label="Close sidebar"
							className="fixed inset-0 z-40 bg-black/50 md:hidden"
							exit={{ opacity: 0 }}
							initial={{ opacity: 0 }}
							onClick={() => setIsSidebarOpen(false)}
							transition={{ duration: 0.22, ease: "easeOut" }}
							type="button"
						/>
						<motion.aside
							animate={{ x: 0 }}
							className="neo-sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col md:hidden"
							exit={{ x: "-100%" }}
							initial={{ x: "-100%" }}
							transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
						>
							<SidebarContent
								onClose={() => setIsSidebarOpen(false)}
								selectedSongId={selectedSongId}
								songsList={songsList}
							/>
						</motion.aside>
					</>
				)}
			</AnimatePresence>

			<aside className="neo-sidebar hidden md:flex md:w-72 md:flex-col">
				<SidebarContent
					onClose={() => setIsSidebarOpen(false)}
					selectedSongId={selectedSongId}
					songsList={songsList}
				/>
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
						{selectedSong ? selectedSong.title : "New Song"}
					</h1>
				</header>
				<div className="flex-1 overflow-y-auto">
					<Outlet />
				</div>
			</main>
		</div>
	);
}

export function NewSongPage() {
	const [urlInput, setUrlInput] = useState("");
	const [selectedModelId, setSelectedModelId] = useState<SongGenerationModelId>(
		DEFAULT_SONG_GENERATION_MODEL_ID,
	);
	const [isGenerating, setIsGenerating] = useState(false);
	const [statusMessages, setStatusMessages] = useState<
		Array<{ id: string; message: string }>
	>([]);
	const [generationError, setGenerationError] = useState<string | null>(null);
	const generationSourceRef = useRef<EventSource | null>(null);
	const navigate = useNavigate();
	const router = useRouter();

	const handleGenerate = useCallback(async () => {
		const nextUrl = urlInput.trim();
		if (!nextUrl || isGenerating) {
			return;
		}

		generationSourceRef.current?.close();
		setIsGenerating(true);
		setGenerationError(null);
		setStatusMessages([]);

		try {
			const endpoint = `/api/generate-song-progress?${new URLSearchParams({
				model: selectedModelId,
				url: nextUrl,
			}).toString()}`;

			await new Promise<void>((resolve) => {
				const source = new EventSource(endpoint);
				generationSourceRef.current = source;
				let settled = false;

				const cleanup = () => {
					source.close();
					if (generationSourceRef.current === source) {
						generationSourceRef.current = null;
					}
				};

				const finish = () => {
					if (settled) {
						return;
					}

					settled = true;
					cleanup();
					resolve();
				};

				source.addEventListener("progress", (event) => {
					const payload = JSON.parse((event as MessageEvent<string>).data) as {
						message: string;
						step: string;
					};
					setStatusMessages((currentValue) => [
						...currentValue,
						{ id: crypto.randomUUID(), message: payload.message },
					]);
				});

				source.addEventListener("done", async (event) => {
					const payload = JSON.parse((event as MessageEvent<string>).data) as {
						flashcardCount: number;
						runId: number;
						songId: number;
					};
					setIsGenerating(false);
					setUrlInput("");
					await navigate({
						params: { songId: String(payload.songId) },
						to: "/song/$songId",
					});
					await router.invalidate();
					finish();
				});

				source.addEventListener("generation-error", (event) => {
					const payload = JSON.parse((event as MessageEvent<string>).data) as {
						message: string;
					};
					setGenerationError(payload.message);
					setIsGenerating(false);
					finish();
				});

				source.onerror = (_event) => {
					if (settled) {
						return;
					}

					setGenerationError("SSE connection failed. Please try again.");
					setIsGenerating(false);
					finish();
				};
			});
		} catch (error) {
			setGenerationError(
				error instanceof Error
					? error.message
					: "Song generation failed. Please try again.",
			);
			setIsGenerating(false);
		}
	}, [isGenerating, navigate, router, selectedModelId, urlInput]);

	useEffect(() => {
		return () => {
			generationSourceRef.current?.close();
		};
	}, []);

	return (
		<div className="p-4 md:p-8 lg:p-12">
			<div className="mx-auto max-w-4xl">
				<div className="flex min-h-[70vh] flex-col items-center justify-center space-y-8 text-center">
					<div className="relative w-full max-w-3xl">
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

							<form
								className="flex flex-col gap-4"
								onSubmit={(event) => {
									event.preventDefault();
									void handleGenerate();
								}}
							>
								<SongModelPicker
									disabled={isGenerating}
									onChange={setSelectedModelId}
									value={selectedModelId}
								/>
								<div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-end">
									<div className="w-full lg:flex-1">
										<p className="mb-2 text-left text-[11px] font-bold uppercase tracking-[0.2em] neo-text-muted">
											Song URL
										</p>
										<input
											aria-busy={isGenerating}
											className="neo-input w-full text-lg font-mono disabled:cursor-not-allowed disabled:opacity-60"
											disabled={isGenerating}
											onChange={(event) => setUrlInput(event.target.value)}
											placeholder="e.g. https://genius.com/..."
											type="text"
											value={urlInput}
										/>
									</div>
									<button
										className="neo-button flex w-full items-center justify-center gap-2 px-8 py-3 text-lg disabled:cursor-not-allowed disabled:opacity-60"
										disabled={isGenerating}
										type="submit"
									>
										{isGenerating ? (
											"Generating..."
										) : (
											<>
												Generate <ArrowRight className="h-5 w-5" />
											</>
										)}
									</button>
								</div>
							</form>

							{(isGenerating ||
								statusMessages.length > 0 ||
								generationError) && (
								<div className="neo-card-no-hover mt-6 overflow-hidden text-left">
									<div className="neo-border-b px-4 py-3">
										<p className="text-xs font-bold tracking-[0.18em] uppercase neo-text-muted">
											Generation Progress
										</p>
									</div>
									<div className="space-y-3 p-4">
										{statusMessages.map((statusMessage, index) => {
											const isActive =
												index === statusMessages.length - 1 && isGenerating;
											return (
												<div
													className="flex items-center gap-3"
													key={statusMessage.id}
												>
													<div
														className={`neo-border flex h-8 w-8 shrink-0 items-center justify-center text-xs font-bold ${
															isActive
																? "bg-[var(--bg-accent)] text-[var(--text-on-accent)]"
																: "bg-[var(--bg-app)] neo-text-muted"
														}`}
													>
														{index + 1}
													</div>
													<p className="min-w-0 text-sm font-mono leading-relaxed neo-text-muted">
														{statusMessage.message}
													</p>
												</div>
											);
										})}
										{generationError && (
											<p className="neo-border bg-red-50 px-3 py-3 text-sm font-mono text-red-700">
												{generationError}
											</p>
										)}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function DeleteSongModal({
	errorMessage,
	isDeleting,
	isOpen,
	onCancel,
	onConfirm,
	songTitle,
}: {
	errorMessage: string | null;
	isDeleting: boolean;
	isOpen: boolean;
	onCancel: () => void;
	onConfirm: () => void;
	songTitle: string;
}) {
	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					animate={{ opacity: 1 }}
					className="neo-review-backdrop fixed inset-0 z-[70] flex items-center justify-center p-4"
					exit={{ opacity: 0 }}
					initial={{ opacity: 0 }}
				>
					<button
						aria-label="Close delete confirmation"
						className="absolute inset-0"
						disabled={isDeleting}
						onClick={onCancel}
						type="button"
					/>
					<motion.div
						animate={{ opacity: 1, scale: 1, y: 0 }}
						className="neo-card-no-hover relative z-10 w-full max-w-xl overflow-hidden bg-[var(--bg-app)]"
						exit={{ opacity: 0, scale: 0.96, y: 20 }}
						initial={{ opacity: 0, scale: 0.94, y: 28 }}
						transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
					>
						<div className="neo-border-b flex items-start justify-between gap-4 p-5 md:p-6">
							<div className="flex min-w-0 items-start gap-4">
								<div className="neo-button-danger flex h-12 w-12 shrink-0 items-center justify-center">
									<Trash2 className="h-5 w-5" />
								</div>
								<div className="min-w-0">
									<p className="text-[11px] font-bold uppercase tracking-[0.2em] neo-text-muted">
										Delete song
									</p>
									<h3 className="neo-wrap-anywhere mt-2 text-3xl font-bold uppercase tracking-[-0.05em]">
										Delete this lesson?
									</h3>
								</div>
							</div>
							<button
								className="neo-card-no-hover shrink-0 p-2.5 hover:bg-[var(--bg-card-hover)]"
								disabled={isDeleting}
								onClick={onCancel}
								type="button"
							>
								<X className="h-5 w-5" />
							</button>
						</div>

						<div className="space-y-4 p-5 md:p-6">
							<p className="font-mono text-sm leading-relaxed neo-text-muted md:text-base">
								This removes{" "}
								<span className="font-bold text-[var(--text-main)]">
									{songTitle}
								</span>{" "}
								and its lyrics, translations, vocabulary notes, and flashcards.
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

						<div className="neo-border-t flex flex-col gap-3 p-5 md:flex-row md:justify-end md:p-6">
							<button
								className="neo-card-no-hover px-5 py-3 font-bold uppercase tracking-[0.18em] hover:bg-[var(--bg-card-hover)] disabled:opacity-60"
								disabled={isDeleting}
								onClick={onCancel}
								type="button"
							>
								Cancel
							</button>
							<button
								className="neo-button-danger px-5 py-3 uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-60"
								disabled={isDeleting}
								onClick={onConfirm}
								type="button"
							>
								{isDeleting ? "Deleting..." : "Delete song"}
							</button>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

export function SongDetailPage({
	chatThreads,
	flashcardRun,
	showChatWidget = true,
	songLesson,
}: {
	chatThreads: SongChatThread[];
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
	const router = useRouter();
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
			await navigate({ to: "/" });
			await router.invalidate();
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

						<div className="space-y-4">
							{songLesson.lines.map((line) => {
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
											<motion.div
												animate={{ rotate: isExpanded ? 180 : 0 }}
												className="neo-border shrink-0 bg-[var(--bg-app)] p-2"
												initial={false}
												transition={{
													duration: 0.24,
													ease: [0.22, 1, 0.36, 1],
												}}
											>
												<ChevronDown className="h-5 w-5" />
											</motion.div>
										</button>

										<AnimatePresence initial={false}>
											{isExpanded && (
												<motion.div
													animate={{ height: "auto", opacity: 1 }}
													className="overflow-hidden"
													exit={{ height: 0, opacity: 0 }}
													initial={{ height: 0, opacity: 0 }}
													transition={{
														duration: 0.28,
														ease: [0.22, 1, 0.36, 1],
													}}
												>
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
												</motion.div>
											)}
										</AnimatePresence>
									</div>
								);
							})}
						</div>
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
				<SongChat
					initialThreads={chatThreads}
					key={songLesson.song.id}
					songId={songLesson.song.id}
				/>
			) : null}
		</>
	);
}
