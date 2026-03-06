import { createFileRoute } from "@tanstack/react-router";
import { SongDetailPage } from "~/components/ai-studio";
import { ChatMock1 } from "~/components/chat-mock-1";
import { getSongPageDataFn } from "~/utils/songs.functions";

export const Route = createFileRoute("/song/$songId_/mock-chat")({
	loader: async ({ params }) => {
		const songId = Number(params.songId);

		if (!Number.isInteger(songId) || songId <= 0) {
			return { flashcardRun: null, songLesson: null };
		}

		return getSongPageDataFn({ data: { songId } });
	},
	component: Mock1RouteComponent,
});

function Mock1RouteComponent() {
	const { flashcardRun, songLesson } = Route.useLoaderData();

	return (
		<>
			<SongDetailPage flashcardRun={flashcardRun} songLesson={songLesson} />
			<ChatMock1 />
		</>
	);
}
