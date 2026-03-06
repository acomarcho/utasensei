import { createServerFn } from "@tanstack/react-start";
import {
	deleteSongById,
	getSongPageData,
	listSongsForLibrary,
} from "~/utils/songs.server";
import {
	deleteSongChatThread,
	getSongChatThread,
	sendSongChatMessage,
} from "~/utils/song-chat.server";

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

export const deleteSongFn = createServerFn({ method: "POST" })
	.inputValidator((data: { songId: number }) => data)
	.handler(async ({ data }) => {
		return deleteSongById(data.songId);
	});

export const getSongChatThreadFn = createServerFn({ method: "POST" })
	.inputValidator((data: { songId: number; threadId: number }) => data)
	.handler(async ({ data }) => {
		return getSongChatThread(data.songId, data.threadId);
	});

export const sendSongChatMessageFn = createServerFn({ method: "POST" })
	.inputValidator(
		(data: { songId: number; message: string; threadId?: number }) => data,
	)
	.handler(async function* ({ data }) {
		yield* sendSongChatMessage(data);
	});

export const deleteSongChatThreadFn = createServerFn({ method: "POST" })
	.inputValidator((data: { threadId: number }) => data)
	.handler(async ({ data }) => {
		return deleteSongChatThread(data.threadId);
	});
