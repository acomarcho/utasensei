import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SongDetailPage } from "~/components/songs/song-detail-page";
import { songPageDataQueryOptions } from "~/utils/songs.query-options";

export const Route = createFileRoute("/song/$songId")({
	loader: ({ context, params }) => {
		const songId = Number(params.songId);
		return context.queryClient.ensureQueryData(
			songPageDataQueryOptions(songId),
		);
	},
	component: SongRouteComponent,
});

function SongRouteComponent() {
	const { songId } = Route.useParams();
	const { data } = useSuspenseQuery(songPageDataQueryOptions(Number(songId)));
	const { flashcardRun, songLesson } = data;

	return <SongDetailPage flashcardRun={flashcardRun} songLesson={songLesson} />;
}
