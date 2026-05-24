import type {
  DeckDocument,
  DeckMeta,
  DeckMode,
  CompatibilityProfile,
  OutputFormat,
  ScenarioId,
  Slide,
  SlideBlock,
  ThemeId,
} from "./types.js";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const SLIDE_HEADING_RE = /^#\s+(.+)$/gm;
const DIRECTIVE_RE = /^([a-zA-Z][\w-]*)\s*:\s*(.+)$/;
const DEFAULT_OUTPUTS: OutputFormat[] = ["html", "pdf", "png", "long-image", "grid9"];
const THEME_IDS = new Set(["editorial", "swiss", "launch", "course"]);
const SCENARIO_IDS = new Set(["media", "pitch", "keynote", "course", "bid", "launch-campaign"]);
const DECK_MODES = new Set(["audience", "presenter", "creator"]);
const COMPATIBILITY_PROFILES = new Set(["agentdeck", "external-html", "swiss-locked"]);

export function parseDeckMarkdown(markdown: string, sourcePath?: string): DeckDocument {
  const frontmatter = markdown.match(FRONTMATTER_RE);
  const rawMeta = frontmatter ? parseSimpleYaml(frontmatter[1] ?? "") : {};
  const body = frontmatter ? markdown.slice(frontmatter[0].length) : markdown;
  const meta = normalizeMeta(rawMeta);
  const slides = parseSlides(body);

  if (slides.length === 0 && meta.title) {
    slides.push({
      id: "cover",
      title: meta.title,
      layout: "cover",
      blocks: [],
      raw: "",
    });
  }

  return { meta, slides, sourcePath };
}

export function parseSimpleYaml(source: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    result[match[1]] = parseYamlValue(match[2]);
  }
  return result;
}

function parseYamlValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => stripQuotes(item.trim()))
      .filter(Boolean);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return stripQuotes(trimmed);
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

function normalizeMeta(raw: Record<string, unknown>): DeckMeta {
  const theme = typeof raw.theme === "string" && THEME_IDS.has(raw.theme) ? raw.theme : "editorial";
  const outputs = Array.isArray(raw.outputs)
    ? raw.outputs.filter((output): output is OutputFormat => typeof output === "string")
    : DEFAULT_OUTPUTS;
  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Untitled Deck";

  return {
    ...raw,
    title,
    subtitle: stringValue(raw.subtitle),
    author: stringValue(raw.author),
    lang: stringValue(raw.lang) ?? "zh-CN",
    theme: theme as ThemeId,
    aspect: "16:9",
    outputs,
    scenario: scenarioValue(raw.scenario),
    audience: stringValue(raw.audience),
    mode: modeValue(raw.mode),
    variants: arrayStringValue(raw.variants),
    compatibility: compatibilityValue(raw.compatibility),
    filenameStem: slugify(stringValue(raw.filenameStem) ?? title),
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function arrayStringValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function scenarioValue(value: unknown): ScenarioId | undefined {
  return typeof value === "string" && SCENARIO_IDS.has(value) ? (value as ScenarioId) : undefined;
}

function modeValue(value: unknown): DeckMode {
  return typeof value === "string" && DECK_MODES.has(value) ? (value as DeckMode) : "audience";
}

function compatibilityValue(value: unknown): CompatibilityProfile {
  return typeof value === "string" && COMPATIBILITY_PROFILES.has(value) ? (value as CompatibilityProfile) : "agentdeck";
}

function parseSlides(body: string): Slide[] {
  const headings = [...body.matchAll(SLIDE_HEADING_RE)];
  if (headings.length === 0) return [];

  return headings.map((heading, index) => {
    const start = (heading.index ?? 0) + heading[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index ?? body.length : body.length;
    const title = heading[1].trim();
    const raw = body.slice(start, end).trim();
    const { directives, content } = splitDirectives(raw);
    const layout = directives.layout ?? inferLayout(title, content, index);
    const blocks = parseBlocks(content, directives);

    return {
      id: directives.id ?? slugify(title || `slide-${index + 1}`),
      title,
      layout,
      note: directives.note,
      image: directives.image,
      alt: directives.alt,
      dataLayout: directives["data-layout"],
      imageSlot: directives["image-slot"],
      social: directives.social,
      blocks,
      raw,
    };
  });
}

function splitDirectives(raw: string): { directives: Record<string, string>; content: string } {
  const directives: Record<string, string> = {};
  const lines = raw.split(/\r?\n/);
  let cursor = 0;

  while (cursor < lines.length) {
    const line = lines[cursor].trim();
    if (!line) {
      cursor += 1;
      continue;
    }
    const match = line.match(DIRECTIVE_RE);
    if (!match) break;
    directives[match[1]] = match[2].trim();
    cursor += 1;
  }

  return { directives, content: lines.slice(cursor).join("\n").trim() };
}

function parseBlocks(content: string, directives: Record<string, string>): SlideBlock[] {
  const blocks: SlideBlock[] = [];
  if (directives.image) {
    blocks.push({
      type: "image",
      src: directives.image,
      alt: directives.alt ?? "",
      slot: directives["image-slot"],
      caption: directives.caption,
    });
  }

  const chunks = content.split(/\n{2,}/).map((chunk) => chunk.trim()).filter(Boolean);
  for (const chunk of chunks) {
    if (chunk.startsWith("```")) {
      blocks.push(parseCodeBlock(chunk));
      continue;
    }
    if (/^::kpi\b/.test(chunk)) {
      blocks.push(parseKpiBlock(chunk));
      continue;
    }
    if (/^::formula\b/.test(chunk)) {
      blocks.push({ type: "formula", text: chunk.replace(/^::formula\s*/, "").trim() });
      continue;
    }
    if (/^!\[[^\]]*]\([^)]+\)/.test(chunk)) {
      blocks.push(parseImageBlock(chunk));
      continue;
    }
    if (chunk.split(/\r?\n/).every((line) => /^[-*]\s+/.test(line.trim()))) {
      blocks.push({ type: "list", items: chunk.split(/\r?\n/).map((line) => line.replace(/^[-*]\s+/, "").trim()) });
      continue;
    }
    if (chunk.split(/\r?\n/).every((line) => /^>\s?/.test(line.trim()))) {
      blocks.push({ type: "quote", text: chunk.replace(/^>\s?/gm, "").trim() });
      continue;
    }
    if (isMarkdownTable(chunk)) {
      blocks.push(parseTableBlock(chunk));
      continue;
    }
    blocks.push({ type: "paragraph", text: chunk.replace(/\s*\n\s*/g, " ") });
  }

  return blocks;
}

function parseCodeBlock(chunk: string): SlideBlock {
  const match = chunk.match(/^```(\w+)?\r?\n([\s\S]*?)\r?\n```$/);
  if (!match) return { type: "code", language: "text", code: chunk.replace(/^```|```$/g, "") };
  const language = match[1] || "text";
  if (language === "mermaid") {
    return { type: "diagram", syntax: "mermaid", code: match[2] };
  }
  return { type: "code", language, code: match[2] };
}

function parseKpiBlock(chunk: string): SlideBlock {
  const body = chunk.replace(/^::kpi\s*/, "").trim();
  const [label = "Metric", value = "0", detail] = body.split("|").map((part) => part.trim());
  return { type: "kpi", label, value, detail };
}

function parseImageBlock(chunk: string): SlideBlock {
  const match = chunk.match(/^!\[([^\]]*)]\(([^)]+)\)(?:\s+"([^"]+)")?/);
  return {
    type: "image",
    alt: match?.[1] ?? "",
    src: match?.[2] ?? "",
    caption: match?.[3],
  };
}

function isMarkdownTable(chunk: string): boolean {
  const lines = chunk.split(/\r?\n/);
  return lines.length >= 2 && /^\|.+\|$/.test(lines[0].trim()) && /^\|[\s:|-]+\|$/.test(lines[1].trim());
}

function parseTableBlock(chunk: string): SlideBlock {
  const lines = chunk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headers = splitTableRow(lines[0]);
  const rows = lines.slice(2).map(splitTableRow);
  return { type: "table", headers, rows };
}

function splitTableRow(line: string): string[] {
  return line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function inferLayout(title: string, content: string, index: number): string {
  if (index === 0) return "cover";
  if (/谢谢|thank|closing|结语/i.test(title)) return "closing";
  if (/^>\s?/m.test(content)) return "quote";
  if (/!\[[^\]]*]\([^)]+\)/.test(content)) return "image-hero";
  if (/^[-*]\s+/m.test(content)) return "steps";
  if (content.length < 80) return "statement";
  return "insight";
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "slide";
}
