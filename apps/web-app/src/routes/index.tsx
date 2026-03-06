import { createFileRoute } from "@tanstack/react-router";
import { NewSongPage } from "~/components/ai-studio";

export const Route = createFileRoute("/")({
	component: NewSongPage,
});
