import { createFileRoute } from "@tanstack/react-router";
import { SongPage } from "~/components/ai-studio";

export const Route = createFileRoute("/song/$songId")({
	component: SongPage,
});
