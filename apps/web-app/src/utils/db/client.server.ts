import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

function getDefaultDbPath() {
	return fileURLToPath(
		new URL("../../../../cli/utasensei.db", import.meta.url),
	);
}

function normalizeDbUrl(rawUrl: string): string {
	if (rawUrl.startsWith("file:") || rawUrl.includes("://")) {
		return rawUrl;
	}

	return `file:${rawUrl}`;
}

const rawUrl = process.env.DB_FILE_NAME ?? getDefaultDbPath();
const url = normalizeDbUrl(rawUrl);
const client = createClient({ url });

export const db = drizzle(client, { schema });
