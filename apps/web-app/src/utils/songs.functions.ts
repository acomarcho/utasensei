import { createServerFn } from "@tanstack/react-start";
import { getSongPageData, listSongsForLibrary } from "~/utils/songs.server";

export const getSongsListFn = createServerFn({ method: "GET" }).handler(
	async () => {
		return listSongsForLibrary();
	},
);

export const getSongPageDataFn = createServerFn({ method: "GET" })
	.inputValidator((data: { songId: number }) => data)
	.handler(async ({ data }) => {
		return getSongPageData(data.songId);
	});
