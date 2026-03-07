import { BookOpen, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { SongLine } from "~/data/ai-studio";

export function SongLessonLines({
	expandedLines,
	onToggle,
	lines,
}: {
	expandedLines: Set<number>;
	onToggle: (lineIndex: number) => void;
	lines: SongLine[];
}) {
	return (
		<div className="space-y-4">
			{lines.map((line) => {
				const isExpanded = expandedLines.has(line.lineIndex);

				return (
					<div
						className="neo-card-no-hover overflow-hidden"
						key={line.lineIndex}
					>
						<button
							className="flex w-full items-start justify-between gap-4 p-4 text-left transition-colors hover:bg-[var(--bg-card-hover)] md:p-6"
							onClick={() => onToggle(line.lineIndex)}
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
								transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
							>
								<ChevronDown className="h-5 w-5" />
							</motion.div>
						</button>

						<AnimatePresence initial={false}>
							{isExpanded ? (
								<motion.div
									animate={{ height: "auto", opacity: 1 }}
									className="overflow-hidden"
									exit={{ height: 0, opacity: 0 }}
									initial={{ height: 0, opacity: 0 }}
									transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
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
							) : null}
						</AnimatePresence>
					</div>
				);
			})}
		</div>
	);
}
