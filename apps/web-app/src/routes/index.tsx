import { createFileRoute } from "@tanstack/react-router";
import { NewSongPage } from "~/components/songs/new-song-page";

export const Route = createFileRoute("/")({
	component: NewSongPage,
});
