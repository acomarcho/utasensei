import { Check, Sparkles } from "lucide-react";

export function GenerationProgressPanel({
	generationError,
	isGenerating,
	statusMessages,
}: {
	generationError: string | null;
	isGenerating: boolean;
	statusMessages: Array<{ id: string; message: string }>;
}) {
	if (!isGenerating && statusMessages.length === 0 && !generationError) {
		return null;
	}

	return (
		<div className="neo-card-no-hover mt-6 overflow-hidden text-left">
			<div className="neo-border-b px-4 py-3">
				<p className="text-xs font-bold tracking-[0.18em] uppercase neo-text-muted">
					Generation Progress
				</p>
			</div>
			<div className="space-y-3 p-4">
				{statusMessages.map((statusMessage, index) => {
					const isActive = index === statusMessages.length - 1 && isGenerating;

					return (
						<div className="flex items-center gap-3" key={statusMessage.id}>
							<div
								className={`neo-border flex h-8 w-8 shrink-0 items-center justify-center text-xs font-bold ${
									isActive
										? "bg-[var(--bg-accent)] text-[var(--text-on-accent)]"
										: "bg-[var(--bg-app)] neo-text-muted"
								}`}
							>
								{isActive ? (
									<Sparkles className="h-4 w-4" />
								) : (
									<Check className="h-4 w-4" />
								)}
							</div>
							<p className="min-w-0 text-sm font-mono leading-relaxed neo-text-muted">
								{statusMessage.message}
							</p>
						</div>
					);
				})}
				{generationError ? (
					<p className="neo-border bg-red-50 px-3 py-3 text-sm font-mono text-red-700">
						{generationError}
					</p>
				) : null}
			</div>
		</div>
	);
}
