import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { DefaultCatchBoundary } from "./components/DefaultCatchBoundary";
import { NotFound } from "./components/NotFound";
import { routeTree } from "./routeTree.gen";
import { createAppQueryClient } from "./utils/query-client";

export function getRouter() {
	const queryClient = createAppQueryClient();
	const router = createRouter({
		context: { queryClient },
		routeTree,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultErrorComponent: DefaultCatchBoundary,
		defaultNotFoundComponent: () => <NotFound />,
		scrollRestoration: true,
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient,
		wrapQueryClient: true,
	});

	return router;
}
