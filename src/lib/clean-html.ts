import { chromium } from "playwright";

export const DEFAULT_MAX_DEPTH = 20;
export const DEFAULT_MAX_NODES = 3000;

export type SimpleNode = {
  tag: string;
  text?: string;
  children?: SimpleNode[];
};

export type CleanHtmlTree = {
  title: string;
  url: string;
  nodes: SimpleNode[];
};

export type CleanHtmlExtractOptions = {
  maxDepth?: number;
  maxNodes?: number;
  challengeWaitAttempts?: number;
  challengeWaitMs?: number;
};

function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
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

export function cleanHtmlTreeToYaml(tree: CleanHtmlTree): string {
  let out = "";
  out += `title: ${yamlScalar(normalizeText(tree.title))}\n`;
  out += `url: ${yamlScalar(tree.url)}\n`;
  out += "tree:\n";

  for (const node of tree.nodes) {
    out += nodeToYaml(node, 1);
  }

  return out;
}

export function collectOrderedTextSegments(
  nodes: SimpleNode[],
  maxSegments = 3000
): string[] {
  const segments: string[] = [];

  const walk = (node: SimpleNode): void => {
    if (segments.length >= maxSegments) {
      return;
    }

    if (node.text) {
      const normalized = normalizeText(node.text);
      if (normalized) {
        segments.push(normalized);
      }
    }

    if (!node.children) {
      return;
    }

    for (const child of node.children) {
      walk(child);
      if (segments.length >= maxSegments) {
        return;
      }
    }
  };

  for (const node of nodes) {
    walk(node);
    if (segments.length >= maxSegments) {
      break;
    }
  }

  return segments;
}

export async function extractCleanHtmlTree(
  url: string,
  options: CleanHtmlExtractOptions = {}
): Promise<CleanHtmlTree> {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const challengeWaitAttempts = options.challengeWaitAttempts ?? 20;
  const challengeWaitMs = options.challengeWaitMs ?? 1000;

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
    await page.waitForTimeout(challengeWaitMs);

    for (let attempt = 0; attempt < challengeWaitAttempts; attempt += 1) {
      const title = await page.title();
      const bodySnippet = (await page.locator("body").innerText()).slice(0, 500);
      const onChallengePage =
        /just a moment/i.test(title) ||
        /make sure you'?re a human/i.test(bodySnippet) ||
        /verification successful/i.test(bodySnippet);

      if (!onChallengePage) {
        break;
      }

      await page.waitForTimeout(challengeWaitMs);
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
    )() as (args: { maxDepth: number; maxNodes: number }) => CleanHtmlTree;

    return await page.evaluate(browserExtractor, { maxDepth, maxNodes });
  } finally {
    await browser.close();
  }
}
