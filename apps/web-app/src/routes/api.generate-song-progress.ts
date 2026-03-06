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
							for await (const event of generateSongFromUrl(sourceUrl)) {
								if (request.signal.aborted) {
									closeStream();
									return;
								}

								if (event.type === "status") {
									sendEvent("progress", {
										message: event.message,
										step: event.step,
									});
									continue;
								}

								if (event.type === "done") {
									sendEvent("done", {
										flashcardCount: event.flashcardCount,
										runId: event.runId,
										songId: event.songId,
									});
									closeStream();
									return;
								}
							}

							sendEvent("generation-error", {
								message: "Song generation finished without returning a song.",
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
