import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

const APP_ROOT_URL = new URL("../../../", import.meta.url);

function getDefaultDbPath() {
	return fileURLToPath(new URL("./utasensei.db", APP_ROOT_URL));
}

function normalizeDbUrl(rawUrl: string): string {
	if (rawUrl.startsWith("file:") || rawUrl.includes("://")) {
		return rawUrl;
	}

	const resolvedPath = fileURLToPath(new URL(rawUrl, APP_ROOT_URL));
	return `file:${resolvedPath}`;
}

const rawUrl = process.env.DB_FILE_NAME ?? getDefaultDbPath();
const url = normalizeDbUrl(rawUrl);
const client = createClient({ url });

export const db = drizzle(client, { schema });
