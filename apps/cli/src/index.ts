#!/usr/bin/env node

import "dotenv/config";
import { runExtractHtml } from "./commands/extract-html";
import { runFlashcards } from "./commands/flashcards";
import { runSongs } from "./commands/songs";
import { runTranslateSong } from "./commands/translate-song";

const HELP_TEXT = [
	"Usage:",
	"  pnpm cli extract-html <url>",
	"  pnpm cli translate-song <url>",
	"  pnpm cli songs [id]",
	"  pnpm cli songs delete <id>",
	"  pnpm cli flashcards build <songId>",
	"  pnpm cli flashcards list <songId>",
	"",
	"Examples:",
	"  pnpm cli extract-html https://genius.com/Genius-romanizations-rokudenashi-one-voice-romanized-lyrics",
	"  pnpm cli translate-song https://www.lyrical-nonsense.com/global/lyrics/sayuri/hana-no-tou/",
	"  pnpm cli songs",
	"  pnpm cli songs 1",
	"  pnpm cli songs delete 1",
	"  pnpm cli flashcards build 1",
	"  pnpm cli flashcards list 1",
].join("\n");

type CliArgs =
	| { command: "extract-html" | "translate-song"; url: string }
	| { command: "songs"; action: "list"; id?: number }
	| { command: "songs"; action: "delete"; id: number }
	| { command: "flashcards"; action: "build" | "list"; songId: number };

function parsePositiveInteger(rawValue: string, label: string): number {
	const parsedValue = Number(rawValue);
	if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
		throw new Error(`Invalid ${label} \"${rawValue}\".\n\n${HELP_TEXT}`);
	}

	return parsedValue;
}

function parseCliArgs(argv: string[]): CliArgs {
	const rawArgs = argv.slice(2).filter((arg) => arg.trim().length > 0);
	const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

	if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
		throw new Error(HELP_TEXT);
	}

	const command = args[0];

	if (command === "songs") {
		const actionArg = args[1];
		if (!actionArg) {
			return { command: "songs", action: "list" };
		}

		if (actionArg === "delete") {
			const idArg = args[2];
			if (!idArg) {
				throw new Error(`Missing song id.\n\n${HELP_TEXT}`);
			}

			return {
				command: "songs",
				action: "delete",
				id: parsePositiveInteger(idArg, "song id"),
			};
		}

		return {
			command: "songs",
			action: "list",
			id: parsePositiveInteger(actionArg, "song id"),
		};
	}

	if (command === "flashcards") {
		const action = args[1];
		const idArg = args[2];
		if (action !== "build" && action !== "list") {
			throw new Error(`Invalid flashcards action "${action}".\n\n${HELP_TEXT}`);
		}
		if (!idArg) {
			throw new Error(`Missing song id.\n\n${HELP_TEXT}`);
		}

		return {
			command: "flashcards",
			action,
			songId: parsePositiveInteger(idArg, "song id"),
		};
	}

	const urlArg = args[1];
	if (!urlArg) {
		throw new Error(`Missing URL.\n\n${HELP_TEXT}`);
	}

	let parsed: URL;
	try {
		parsed = new URL(urlArg);
	} catch {
		throw new Error(`Invalid URL.\n\n${HELP_TEXT}`);
	}

	if (!["http:", "https:"].includes(parsed.protocol)) {
		throw new Error("Only http/https URLs are supported.");
	}

	if (command === "extract-html" || command === "translate-song") {
		return { command, url: parsed.toString() };
	}

	throw new Error(`Unknown command "${command}".\n\n${HELP_TEXT}`);
}

async function main(): Promise<void> {
	try {
		const parsed = parseCliArgs(process.argv);

		switch (parsed.command) {
			case "extract-html":
				await runExtractHtml(parsed.url);
				return;
			case "translate-song":
				await runTranslateSong(parsed.url);
				return;
			case "songs":
				await runSongs(parsed.action, parsed.id);
				return;
			case "flashcards":
				await runFlashcards(parsed.action, parsed.songId);
				return;
			default: {
				const exhaustiveCheck: never = parsed;
				throw new Error(
					`Unknown command "${exhaustiveCheck}".\n\n${HELP_TEXT}`,
				);
			}
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);

		// Help text errors should exit as success so they feel like --help.
		if (message === HELP_TEXT) {
			process.stdout.write(`${message}\n`);
			process.exit(0);
		}

		console.error(`cli failed: ${message}`);
		process.exit(1);
	}
}

void main();
