#!/usr/bin/env node

import "dotenv/config";
import { runChat } from "./commands/chat";
import { runExtractHtml } from "./commands/extract-html";
import { runFlashcards } from "./commands/flashcards";
import { runSongs } from "./commands/songs";
import { runTranslateSong } from "./commands/translate-song";
import {
	DEFAULT_SONG_GENERATION_MODEL_ID,
	parseSongGenerationModelId,
	SONG_GENERATION_MODEL_ALIASES,
	SONG_GENERATION_MODEL_IDS,
	type SongGenerationModelId,
} from "./lib/song-generation-models";

const HELP_TEXT = [
	"Usage:",
	"  pnpm cli extract-html <url>",
	"  pnpm cli translate-song <url> [--model <model>]",
	"  pnpm cli songs [id]",
	"  pnpm cli songs delete <id>",
	"  pnpm cli flashcards build <songId>",
	"  pnpm cli flashcards list <songId>",
	'  pnpm cli chat <songId> "<message>"',
	'  pnpm cli chat <songId> --thread <threadId> "<message>"',
	"  pnpm cli chat threads <songId>",
	"  pnpm cli chat delete <threadId>",
	"",
	"Examples:",
	"  pnpm cli extract-html https://genius.com/Genius-romanizations-rokudenashi-one-voice-romanized-lyrics",
	"  pnpm cli translate-song https://www.lyrical-nonsense.com/global/lyrics/sayuri/hana-no-tou/",
	`  pnpm cli translate-song https://www.lyrical-nonsense.com/global/lyrics/sayuri/hana-no-tou/ --model ${SONG_GENERATION_MODEL_ALIASES[1]}`,
	"  pnpm cli songs",
	"  pnpm cli songs 1",
	"  pnpm cli songs delete 1",
	"  pnpm cli flashcards build 1",
	"  pnpm cli flashcards list 1",
	'  pnpm cli chat 1 "What does this line imply?"',
	'  pnpm cli chat 1 --thread 2 "Explain that more simply."',
	"  pnpm cli chat threads 1",
	"  pnpm cli chat delete 2",
].join("\n");

type CliArgs =
	| { command: "extract-html"; url: string }
	| { command: "translate-song"; modelId: SongGenerationModelId; url: string }
	| { command: "songs"; action: "list"; id?: number }
	| { command: "songs"; action: "delete"; id: number }
	| { command: "flashcards"; action: "build" | "list"; songId: number }
	| {
			command: "chat";
			action: "send";
			songId: number;
			message: string;
			threadId?: number;
	  }
	| { command: "chat"; action: "threads"; songId: number }
	| { command: "chat"; action: "delete"; threadId: number };

function parseUrlArg(rawValue: string | undefined): string {
	if (!rawValue) {
		throw new Error(`Missing URL.\n\n${HELP_TEXT}`);
	}

	let parsed: URL;
	try {
		parsed = new URL(rawValue);
	} catch {
		throw new Error(`Invalid URL.\n\n${HELP_TEXT}`);
	}

	if (!["http:", "https:"].includes(parsed.protocol)) {
		throw new Error("Only http/https URLs are supported.");
	}

	return parsed.toString();
}

function parseTranslateSongArgs(args: string[]): {
	modelId: SongGenerationModelId;
	url: string;
} {
	const url = parseUrlArg(args[1]);

	if (args.length === 2) {
		return {
			modelId: DEFAULT_SONG_GENERATION_MODEL_ID,
			url,
		};
	}

	if (args[2] !== "--model") {
		throw new Error(`Unknown option "${args[2]}".\n\n${HELP_TEXT}`);
	}

	const rawModelId = args[3];
	if (!rawModelId) {
		throw new Error(`Missing model id after --model.\n\n${HELP_TEXT}`);
	}

	if (args.length > 4) {
		throw new Error(`Too many arguments for translate-song.\n\n${HELP_TEXT}`);
	}

	const modelId = parseSongGenerationModelId(rawModelId);
	if (!modelId) {
		throw new Error(
			`Invalid model "${rawModelId}". Allowed values: ${SONG_GENERATION_MODEL_ALIASES.join(", ")} (aliases) or ${SONG_GENERATION_MODEL_IDS.join(", ")} (full ids).\n\n${HELP_TEXT}`,
		);
	}

	return { modelId, url };
}

function parsePositiveInteger(rawValue: string, label: string): number {
	const parsedValue = Number(rawValue);
	if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
		throw new Error(`Invalid ${label} "${rawValue}".\n\n${HELP_TEXT}`);
	}

	return parsedValue;
}

function parseRequiredMessage(args: string[], startIndex: number): string {
	const message = args.slice(startIndex).join(" ").trim();
	if (!message) {
		throw new Error(`Missing message.\n\n${HELP_TEXT}`);
	}

	return message;
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

	if (command === "chat") {
		const actionArg = args[1];
		if (!actionArg) {
			throw new Error(`Missing chat arguments.\n\n${HELP_TEXT}`);
		}

		if (actionArg === "threads") {
			const songIdArg = args[2];
			if (!songIdArg || args.length > 3) {
				throw new Error(`Invalid chat threads usage.\n\n${HELP_TEXT}`);
			}

			return {
				command: "chat",
				action: "threads",
				songId: parsePositiveInteger(songIdArg, "song id"),
			};
		}

		if (actionArg === "delete") {
			const threadIdArg = args[2];
			if (!threadIdArg || args.length > 3) {
				throw new Error(`Invalid chat delete usage.\n\n${HELP_TEXT}`);
			}

			return {
				command: "chat",
				action: "delete",
				threadId: parsePositiveInteger(threadIdArg, "thread id"),
			};
		}

		const songId = parsePositiveInteger(actionArg, "song id");
		if (args[2] === "--thread") {
			const threadIdArg = args[3];
			if (!threadIdArg) {
				throw new Error(`Missing thread id.\n\n${HELP_TEXT}`);
			}

			return {
				command: "chat",
				action: "send",
				songId,
				threadId: parsePositiveInteger(threadIdArg, "thread id"),
				message: parseRequiredMessage(args, 4),
			};
		}

		if (args[2]?.startsWith("--")) {
			throw new Error(`Unknown option "${args[2]}".\n\n${HELP_TEXT}`);
		}

		return {
			command: "chat",
			action: "send",
			songId,
			message: parseRequiredMessage(args, 2),
		};
	}

	if (command === "extract-html") {
		if (args.length > 2) {
			throw new Error(`Too many arguments for extract-html.\n\n${HELP_TEXT}`);
		}

		return { command, url: parseUrlArg(args[1]) };
	}

	if (command === "translate-song") {
		return { command, ...parseTranslateSongArgs(args) };
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
				await runTranslateSong(parsed.url, parsed.modelId);
				return;
			case "songs":
				await runSongs(parsed.action, parsed.id);
				return;
			case "flashcards":
				await runFlashcards(parsed.action, parsed.songId);
				return;
			case "chat":
				await runChat(parsed);
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
