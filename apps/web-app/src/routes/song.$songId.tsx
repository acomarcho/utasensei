import { createFileRoute } from "@tanstack/react-router";
import { SongDetailPage } from "~/components/ai-studio";
import { getSongPageDataFn } from "~/utils/songs.functions";

export const Route = createFileRoute("/song/$songId")({
	loader: async ({ params }) => {
		const songId = Number(params.songId);

		if (!Number.isInteger(songId) || songId <= 0) {
			return {
				chatThreads: [],
				flashcardRun: null,
				songLesson: null,
			};
		}

		return getSongPageDataFn({ data: { songId } });
	},
	component: SongRouteComponent,
});

function SongRouteComponent() {
	const { chatThreads, flashcardRun, songLesson } = Route.useLoaderData();

	return (
		<SongDetailPage
			chatThreads={chatThreads}
			flashcardRun={flashcardRun}
			songLesson={songLesson}
		/>
	);
}
