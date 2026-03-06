const MARKDOWN_NEW_ENDPOINT = "https://markdown.new/";

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

	return {
		sourceUrl: payload.url?.trim() || normalizedUrl,
		title: payload.title?.trim() || "",
		markdown,
		method: payload.method?.trim() || null,
		tokens: typeof payload.tokens === "number" ? payload.tokens : null,
	};
}
