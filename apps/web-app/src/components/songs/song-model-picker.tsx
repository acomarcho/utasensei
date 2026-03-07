import { Check, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
	SONG_GENERATION_MODEL_OPTIONS,
	type SongGenerationModelId,
} from "~/utils/song-generation-models";

export function SongModelPicker({
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
