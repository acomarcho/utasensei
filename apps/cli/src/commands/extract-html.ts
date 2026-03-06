import { fetchMarkdownSource } from "../lib/markdown-source";

export async function runExtractHtml(url: string): Promise<void> {
	const extracted = await fetchMarkdownSource(url);
	process.stdout.write(`${extracted.markdown}\n`);
}
