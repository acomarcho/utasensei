import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

function normalizeDbUrl(rawUrl: string): string {
  if (rawUrl.startsWith("file:") || rawUrl.includes("://")) {
    return rawUrl;
  }

  return `file:${rawUrl}`;
}

const rawUrl = process.env.DB_FILE_NAME ?? "./utasensei.db";
const url = normalizeDbUrl(rawUrl);

const client = createClient({ url });

export const db = drizzle(client);
