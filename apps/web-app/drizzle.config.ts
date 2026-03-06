import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "node:url";

function getDefaultDbPath() {
	return fileURLToPath(new URL("./utasensei.db", import.meta.url));
}

function normalizeDbUrl(rawUrl: string): string {
	if (rawUrl.startsWith("file:") || rawUrl.includes("://")) {
		return rawUrl;
	}

	const resolvedPath = fileURLToPath(new URL(rawUrl, import.meta.url));
	return `file:${resolvedPath}`;
}

const rawUrl = process.env.DB_FILE_NAME ?? getDefaultDbPath();
const url = normalizeDbUrl(rawUrl);

export default defineConfig({
	schema: "./src/utils/db/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
	dbCredentials: {
		url,
	},
});
