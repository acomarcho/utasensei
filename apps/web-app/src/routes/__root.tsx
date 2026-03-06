/// <reference types="vite/client" />
import type { ReactNode } from "react";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import { AiStudioShell } from "~/components/ai-studio";
import appCss from "~/styles/app.css?url";
import { getSongsListFn } from "~/utils/songs.functions";
import { seo } from "~/utils/seo";

export const Route = createRootRoute({
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
	loader: async () => {
		const songsList = await getSongsListFn();
		return { songsList };
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
	const { songsList } = Route.useLoaderData();

	return (
		<RootDocument>
			<AiStudioShell songsList={songsList} />
		</RootDocument>
	);
}
