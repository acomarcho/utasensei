import { createFileRoute } from "@tanstack/react-router";
import { SongDetailPage } from "~/components/ai-studio";
import { getSongPageDataFn } from "~/utils/songs.functions";

export const Route = createFileRoute("/song/$songId")({
	loader: async ({ params }) => {
		const songId = Number(params.songId);

		if (!Number.isInteger(songId) || songId <= 0) {
			return {
				flashcardRun: null,
				songLesson: null,
			};
		}

		return getSongPageDataFn({ data: { songId } });
	},
	component: SongRouteComponent,
});

function SongRouteComponent() {
	const { flashcardRun, songLesson } = Route.useLoaderData();

	return <SongDetailPage flashcardRun={flashcardRun} songLesson={songLesson} />;
}
