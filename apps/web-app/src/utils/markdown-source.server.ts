const MARKDOWN_NEW_ENDPOINT = "https://markdown.new/";
const REFERENCE_SOURCE_URL =
	"https://www.lyrical-nonsense.com/global/lyrics/sayuri/mikazuki/";
const REFERENCE_SOURCE_TOKENS = 14888;
const REFERENCE_SOURCE_MARKDOWN_CHARS = 52839;
const MAX_MARKDOWN_SOURCE_TOKENS = REFERENCE_SOURCE_TOKENS * 2.5;

type MarkdownNewSuccessResponse = {
	success: true;
	url?: string;
	title?: string;
	content?: string;
	method?: string;
	tokens?: number;
	error?: string;
};

function parseHttpUrl(rawUrl: string): string {
	const value = rawUrl.trim();
	if (!value) {
		throw new Error("A song URL is required.");
	}

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(value);
	} catch {
		throw new Error("Invalid URL. Please provide a valid http/https URL.");
	}

	if (!["http:", "https:"].includes(parsedUrl.protocol)) {
		throw new Error("Only http/https URLs are supported.");
	}

	return parsedUrl.toString();
}

async function parseErrorMessage(response: Response): Promise<string> {
	try {
		const payload = (await response.json()) as {
			error?: string;
			message?: string;
		};
		return (
			payload.error ?? payload.message ?? `Request failed (${response.status}).`
		);
	} catch {
		return `Request failed (${response.status}).`;
	}
}

function estimateTokensFromMarkdown(markdown: string): number {
	return Math.ceil(
		(markdown.length * REFERENCE_SOURCE_TOKENS) /
			REFERENCE_SOURCE_MARKDOWN_CHARS,
	);
}

function assertTokenLimit(
	tokens: number | null,
	markdown: string,
): number | null {
	const effectiveTokens = tokens ?? estimateTokensFromMarkdown(markdown);

	if (effectiveTokens <= MAX_MARKDOWN_SOURCE_TOKENS) {
		return tokens;
	}

	const tokenSource = tokens === null ? "estimated" : "reported";

	throw new Error(
		[
			`Song source is too large to process: markdown.new ${tokenSource} ${effectiveTokens.toLocaleString()} tokens.`,
			`The current limit is ${MAX_MARKDOWN_SOURCE_TOKENS.toLocaleString()} tokens (${REFERENCE_SOURCE_TOKENS.toLocaleString()} tokens from ${REFERENCE_SOURCE_URL} x 2.5).`,
		].join(" "),
	);
}

export type MarkdownSource = {
	sourceUrl: string;
	title: string;
	markdown: string;
	method: string | null;
	tokens: number | null;
};

export async function fetchMarkdownSource(
	rawUrl: string,
): Promise<MarkdownSource> {
	const normalizedUrl = parseHttpUrl(rawUrl);
	const response = await fetch(MARKDOWN_NEW_ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			method: "auto",
			retain_images: false,
			url: normalizedUrl,
		}),
	});

	if (!response.ok) {
		const details = await parseErrorMessage(response);
		throw new Error(`markdown.new request failed: ${details}`);
	}

	const payload = (await response.json()) as MarkdownNewSuccessResponse;
	if (!payload.success) {
		throw new Error(
			`markdown.new request failed: ${payload.error ?? "Unknown conversion error."}`,
		);
	}

	const markdown = (payload.content ?? "").trim();
	if (!markdown) {
		throw new Error("markdown.new returned empty content.");
	}

	const tokens = assertTokenLimit(
		typeof payload.tokens === "number" ? payload.tokens : null,
		markdown,
	);

	return {
		sourceUrl: payload.url?.trim() || normalizedUrl,
		title: payload.title?.trim() || "",
		markdown,
		method: payload.method?.trim() || null,
		tokens,
	};
}
