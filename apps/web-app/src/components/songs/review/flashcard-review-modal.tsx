import { Check, RotateCcw, Sparkles, X } from "lucide-react";
import {
	AnimatePresence,
	motion,
	useMotionValue,
	useTransform,
} from "motion/react";
import { useState } from "react";
import type { Flashcard } from "~/data/ai-studio";

const REVIEW_STACK_LIMIT = 5;
const REVIEW_DRAG_THRESHOLD = 110;

type ReviewAction = "forgotten" | "remembered";

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
				{dragHintLabel && !swipeDirection ? (
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
				) : null}
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

export function FlashcardReviewModal({
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
			{isOpen ? (
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
			) : null}
		</AnimatePresence>
	);
}
