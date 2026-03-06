import { createFileRoute } from "@tanstack/react-router";
import { generateSongFromUrl } from "~/utils/song-generation.server";

function formatSseEvent(event: string, data: unknown) {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const Route = createFileRoute("/api/generate-song-progress")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const encoder = new TextEncoder();
				const url = new URL(request.url);
				const sourceUrl = url.searchParams.get("url")?.trim() ?? "";

				const stream = new ReadableStream({
					async start(controller) {
						let closed = false;

						const closeStream = () => {
							if (closed) {
								return;
							}

							closed = true;
							controller.close();
						};

						const sendEvent = (event: string, data: unknown) => {
							if (closed) {
								return;
							}

							controller.enqueue(encoder.encode(formatSseEvent(event, data)));
						};

						request.signal.addEventListener("abort", closeStream, {
							once: true,
						});

						if (!sourceUrl) {
							sendEvent("generation-error", {
								message: "A song URL is required.",
							});
							closeStream();
							return;
						}

						sendEvent("open", { message: "SSE connection established." });

						try {
							const result = await generateSongFromUrl(sourceUrl, (event) => {
								if (request.signal.aborted) {
									return;
								}

								if (event.type === "status") {
									sendEvent("progress", {
										message: event.message,
										step: event.step,
									});
								}
							});

							if (request.signal.aborted) {
								closeStream();
								return;
							}

							sendEvent("done", {
								flashcardCount: result.flashcardCount,
								runId: result.runId,
								songId: result.songId,
							});
							closeStream();
						} catch (error) {
							sendEvent("generation-error", {
								message:
									error instanceof Error
										? error.message
										: "Song generation failed. Please try again.",
							});
							closeStream();
						}
					},
				});

				return new Response(stream, {
					headers: {
						"Cache-Control": "no-cache, no-transform",
						Connection: "keep-alive",
						"Content-Type": "text/event-stream",
					},
				});
			},
		},
	},
});
