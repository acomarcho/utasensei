import { cleanHtmlTreeToYaml, extractCleanHtmlTree } from "../lib/clean-html";

export async function runExtractHtml(url: string): Promise<void> {
	const extracted = await extractCleanHtmlTree(url);
	process.stdout.write(cleanHtmlTreeToYaml(extracted));
}
