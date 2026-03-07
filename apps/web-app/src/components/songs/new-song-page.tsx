import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GenerationProgressPanel } from "~/components/songs/generation-progress-panel";
import { SongModelPicker } from "~/components/songs/song-model-picker";
import {
	DEFAULT_SONG_GENERATION_MODEL_ID,
	type SongGenerationModelId,
} from "~/utils/song-generation-models";
import { songsListQueryKey } from "~/utils/songs.query-options";

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
	const queryClient = useQueryClient();

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

					void payload.step;
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

					void payload.flashcardCount;
					void payload.runId;
					setIsGenerating(false);
					setUrlInput("");
					await navigate({
						params: { songId: String(payload.songId) },
						to: "/song/$songId",
					});
					await queryClient.invalidateQueries({
						queryKey: songsListQueryKey,
					});
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

				source.onerror = () => {
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
	}, [isGenerating, navigate, queryClient, selectedModelId, urlInput]);

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

							<GenerationProgressPanel
								generationError={generationError}
								isGenerating={isGenerating}
								statusMessages={statusMessages}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
