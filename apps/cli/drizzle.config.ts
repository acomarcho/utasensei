import "dotenv/config";
import { defineConfig } from "drizzle-kit";

function normalizeDbUrl(rawUrl: string): string {
	if (rawUrl.startsWith("file:") || rawUrl.includes("://")) {
		return rawUrl;
	}

	return `file:${rawUrl}`;
}

const rawUrl = process.env.DB_FILE_NAME ?? "./utasensei.db";
const url = normalizeDbUrl(rawUrl);

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
	dbCredentials: {
		url,
	},
});
