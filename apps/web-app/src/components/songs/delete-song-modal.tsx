import { Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export function DeleteSongModal({
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
			{isOpen ? (
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
			) : null}
		</AnimatePresence>
	);
}
