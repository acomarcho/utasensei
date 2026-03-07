/// <reference types="vite/client" />
import { type QueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";
import { SongsShell } from "~/components/songs/songs-shell";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import appCss from "~/styles/app.css?url";
import { seo } from "~/utils/seo";
import { songsListQueryOptions } from "~/utils/songs.query-options";

type RouterContext = {
	queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			...seo({
				title: "UtaSensei | Learn Japanese From Lyrics",
				description:
					"A TanStack Start app for browsing lyric lessons and flashcards.",
			}),
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	loader: ({ context }) => {
		return context.queryClient.ensureQueryData(songsListQueryOptions());
	},
	errorComponent: DefaultCatchBoundary,
	notFoundComponent: () => <NotFound />,
	component: RootComponent,
});

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<TanStackRouterDevtools position="bottom-right" />
				<Scripts />
			</body>
		</html>
	);
}

function RootComponent() {
	const { data: songsList } = useSuspenseQuery(songsListQueryOptions());

	return (
		<RootDocument>
			<SongsShell songsList={songsList} />
		</RootDocument>
	);
}
