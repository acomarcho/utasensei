#!/usr/bin/env node

import { chromium } from "playwright";

const USAGE = 'Usage: pnpm clean-html-extract -- "https://example.com/page"';
const DEFAULT_MAX_DEPTH = 20;
const DEFAULT_MAX_NODES = 3000;

type SimpleNode = {
  tag: string;
  text?: string;
  children?: SimpleNode[];
};

function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function parseUrlArg(argv: string[]): string {
  const args = argv.slice(2).filter((arg) => arg.trim().length > 0);
  const urlArg = (args[0] === "--" ? args[1] : args[0])?.trim();
  if (!urlArg) {
    throw new Error(USAGE);
  }

  let parsed: URL;
  try {
    parsed = new URL(urlArg);
  } catch {
    throw new Error(`Invalid URL.\n${USAGE}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https URLs are supported.");
  }

  return parsed.toString();
}

function yamlScalar(text: string): string {
  const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function nodeToYaml(node: SimpleNode, indent: number): string {
  const pad = "  ".repeat(indent);

  if (!node.children || node.children.length === 0) {
    const value = node.text ? yamlScalar(node.text) : '""';
    return `${pad}- ${node.tag}: ${value}\n`;
  }

  let out = `${pad}- ${node.tag}:\n`;

  if (node.text) {
    out += `${pad}  - text: ${yamlScalar(node.text)}\n`;
  }

  for (const child of node.children) {
    out += nodeToYaml(child, indent + 1);
  }

  return out;
}

function toYamlDocument(title: string, url: string, nodes: SimpleNode[]): string {
  let out = "";
  out += `title: ${yamlScalar(title)}\n`;
  out += `url: ${yamlScalar(url)}\n`;
  out += "tree:\n";

  for (const node of nodes) {
    out += nodeToYaml(node, 1);
  }

  return out;
}

async function extractStructure(url: string): Promise<{
  title: string;
  url: string;
  nodes: SimpleNode[];
}> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"]
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      locale: "en-US"
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1_000);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const title = await page.title();
      const bodySnippet = (await page.locator("body").innerText()).slice(0, 500);
      const onChallengePage =
        /just a moment/i.test(title) ||
        /make sure you'?re a human/i.test(bodySnippet) ||
        /verification successful/i.test(bodySnippet);

      if (!onChallengePage) {
        break;
      }

      await page.waitForTimeout(1_000);
    }

    const browserExtractor = new Function(
      `return ({ maxDepth, maxNodes }) => {
        const SKIP_TAGS = new Set([
          "script",
          "style",
          "noscript",
          "svg",
          "canvas",
          "iframe",
          "meta",
          "link"
        ]);

        const normalize = (raw) => String(raw || "").replace(/\\s+/g, " ").trim();

        const isHidden = (el) => {
          if (el.hidden) return true;
          if (el.getAttribute("aria-hidden") === "true") return true;
          const style = window.getComputedStyle(el);
          return style.display === "none" || style.visibility === "hidden";
        };

        let keptNodes = 0;

        const walk = (el, depth) => {
          if (depth > maxDepth || keptNodes >= maxNodes) return null;

          const tag = el.tagName.toLowerCase();
          if (SKIP_TAGS.has(tag) || isHidden(el)) return null;

          const children = [];
          const directTextParts = [];

          for (const child of Array.from(el.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
              const text = normalize(child.textContent);
              if (text) directTextParts.push(text);
              continue;
            }

            if (child.nodeType === Node.ELEMENT_NODE) {
              const childNode = walk(child, depth + 1);
              if (childNode) children.push(childNode);
            }
          }

          const text = normalize(directTextParts.join(" "));
          if (!text && children.length === 0) return null;

          keptNodes += 1;
          const node = { tag };
          if (text) node.text = text;
          if (children.length > 0) node.children = children;
          return node;
        };

        const roots = [];
        for (const child of Array.from(document.body.children)) {
          const node = walk(child, 0);
          if (node) roots.push(node);
        }

        if (roots.length === 0) {
          roots.push({ tag: "body", text: normalize(document.body.innerText || "") });
        }

        return { title: document.title || "", url: location.href, nodes: roots };
      };`
    )() as (args: { maxDepth: number; maxNodes: number }) => {
      title: string;
      url: string;
      nodes: SimpleNode[];
    };

    return await page.evaluate(browserExtractor, {
      maxDepth: DEFAULT_MAX_DEPTH,
      maxNodes: DEFAULT_MAX_NODES
    });
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  try {
    const url = parseUrlArg(process.argv);
    const extracted = await extractStructure(url);
    const yaml = toYamlDocument(
      normalizeText(extracted.title),
      extracted.url,
      extracted.nodes
    );
    process.stdout.write(yaml);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`clean-html-extract failed: ${message}`);
    process.exit(1);
  }
}

void main();
