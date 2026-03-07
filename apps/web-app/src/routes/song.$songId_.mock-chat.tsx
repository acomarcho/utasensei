import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SongDetailPage } from "~/components/ai-studio";
import { ChatMock1 } from "~/components/chat-mock-1";
import { songPageDataQueryOptions } from "~/utils/songs.query-options";

export const Route = createFileRoute("/song/$songId_/mock-chat")({
	loader: ({ context, params }) => {
		const songId = Number(params.songId);
		return context.queryClient.ensureQueryData(
			songPageDataQueryOptions(songId),
		);
	},
	component: Mock1RouteComponent,
});

function Mock1RouteComponent() {
	const { songId } = Route.useParams();
	const { data } = useSuspenseQuery(songPageDataQueryOptions(Number(songId)));
	const { flashcardRun, songLesson } = data;

	return (
		<>
			<SongDetailPage
				flashcardRun={flashcardRun}
				showChatWidget={false}
				songLesson={songLesson}
			/>
			<ChatMock1 />
		</>
	);
}
