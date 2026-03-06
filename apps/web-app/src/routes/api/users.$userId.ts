import { createFileRoute } from "@tanstack/react-router";
import type { User } from "~/utils/users";

export const Route = createFileRoute("/api/users/$userId")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				console.info(`Fetching users by id=${params.userId}... @`, request.url);
				try {
					const response = await fetch(
						`https://jsonplaceholder.typicode.com/users/${params.userId}`,
					);
					if (!response.ok) {
						throw new Error("Failed to fetch user");
					}

					const user = (await response.json()) as User;

					return Response.json({
						id: user.id,
						name: user.name,
						email: user.email,
					});
				} catch (error) {
					console.error(error);
					return Response.json({ error: "User not found" }, { status: 404 });
				}
			},
		},
	},
});
