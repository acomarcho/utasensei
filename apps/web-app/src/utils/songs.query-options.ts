import {
	type QueryClient,
	queryOptions,
	type Updater,
} from "@tanstack/react-query";
import type { SongPageData } from "~/data/ai-studio";
import { getSongPageDataFn, getSongsListFn } from "~/utils/songs.functions";

export const songsListQueryKey = ["songs", "list"] as const;

export function songPageDataQueryKey(songId: number) {
	return ["songs", "page", songId] as const;
}

export function songsListQueryOptions() {
	return queryOptions({
		queryKey: songsListQueryKey,
		queryFn: () => getSongsListFn(),
		staleTime: 30_000,
	});
}

export function songPageDataQueryOptions(songId: number) {
	return queryOptions({
		queryKey: songPageDataQueryKey(songId),
		queryFn: async (): Promise<SongPageData> => {
			if (!Number.isInteger(songId) || songId <= 0) {
				return { chatThreads: [], flashcardRun: null, songLesson: null };
			}

			return getSongPageDataFn({ data: { songId } });
		},
		staleTime: 30_000,
	});
}

export function updateSongPageData(
	queryClient: QueryClient,
	songId: number,
	updater: Updater<SongPageData | undefined, SongPageData | undefined>,
) {
	queryClient.setQueryData(songPageDataQueryKey(songId), updater);
}
