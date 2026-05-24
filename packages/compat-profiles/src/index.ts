import { slugify, type DeckDocument, type Diagnostic } from "@agentdeck/schema";

export interface SwissLockedImportResult {
  markdown: string;
  slideCount: number;
  warnings: Diagnostic[];
}

export interface ExternalHtmlImportOptions {
  sourceName?: string;
  title?: string;
  assetResolver?: (url: string) => string;
}

export interface ExternalHtmlImportResult {
  deck: DeckDocument;
  slideCount: number;
  warnings: Diagnostic[];
}

export interface SwissLockedCompatibilityReport {
  diagnostics: Diagnostic[];
  levels: string[];
  slideCount: number;
  layoutCounts: Record<string, number>;
}

export const swissLockedLayoutMap: Record<string, string> = {
  S01: "section",
  S02: "timeline",
  S03: "statement",
  S04: "cards",
  S05: "comparison",
  S06: "kpi",
  S07: "kpi",
  S08: "diagram",
  S09: "statement",
  S10: "statement",
  S11: "comparison",
  S12: "steps",
  S13: "cards",
  S14: "diagram",
  S15: "evidence-grid",
  S16: "evidence-grid",
  S17: "diagram",
  S18: "table",
  S19: "insight",
  S20: "kpi",
  S21: "timeline",
  S22: "image-hero",
  "SWISS-COVER-ASCII": "cover",
  "SWISS-CLOSING-ASCII": "closing",
};

const allowedSwissLayouts = new Set(Object.keys(swissLockedLayoutMap));

export function importExternalHtmlDeck(html: string, options: ExternalHtmlImportOptions = {}): ExternalHtmlImportResult {
  const warnings: Diagnostic[] = [];
  const title = options.title || textContent(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || options.sourceName || "Imported HTML Deck";
  const sourceStyles = extractStyles(html, options.assetResolver);
  const slides = extractExternalSlides(html);

  if (slides.usedFallback) {
    warnings.push({
      level: "warning",
      code: "compat.external_html.slides.fallback",
      message: "No common slide containers found; wrapped the whole <body> as one slide.",
    });
  }

  return {
    deck: {
      meta: {
        title,
        subtitle: options.sourceName ? `Wrapped from ${options.sourceName}` : "Wrapped external HTML deck",
        author: "External source",
        lang: "zh-CN",
        theme: "swiss",
        aspect: "16:9",
        outputs: ["html", "pdf", "png"],
        mode: "audience",
        variants: [],
        compatibility: "external-html",
        filenameStem: slugify(title),
        sourceStyles,
      },
      slides: slides.items.map((slide, index) => ({
        id: slugify(slideTitle(slide, index)),
        title: slideTitle(slide, index),
        layout: "html-import",
        blocks: [
          {
            type: "html",
            html: rewriteReferences(stripExecutableScripts(slide), options.assetResolver),
            source: options.sourceName,
          },
        ],
        raw: slide,
      })),
    },
    slideCount: slides.items.length,
    warnings,
  };
}

export function validateSwissLockedHtml(html: string): Diagnostic[] {
  return inspectSwissLockedHtml(html).diagnostics;
}

export function inspectSwissLockedHtml(html: string, options: { visual?: boolean } = {}): SwissLockedCompatibilityReport {
  const diagnostics: Diagnostic[] = [];
  const htmlForSlides = html.replace(/<!--[\s\S]*?-->/g, "");
  const slides = extractSlideSections(htmlForSlides);
  const layoutCounts: Record<string, number> = {};

  if (slides.length === 0) {
    diagnostics.push({
      level: "error",
      code: "compat.swiss_locked.slides.empty",
      message: "No <section class=\"slide\"> pages found.",
    });
  }

  slides.forEach((slide, index) => {
    const slideIndex = index + 1;
    const layout = attr(slide.tag, "data-layout");
    if (layout) layoutCounts[layout] = (layoutCounts[layout] ?? 0) + 1;
    if (!layout) {
      diagnostics.push({
        level: "error",
        code: "compat.swiss_locked.layout.missing",
        message: "Swiss locked mode requires data-layout on every slide.",
        slideIndex,
      });
    } else if (!allowedSwissLayouts.has(layout)) {
      diagnostics.push({
        level: "error",
        code: "compat.swiss_locked.layout.unknown",
        message: `data-layout="${layout}" is not registered in S01-S22 or the Swiss locked cover/closing layouts.`,
        slideIndex,
      });
    }

    if (/\bdata-layout="P2[34]\b|Swiss Image Split|Swiss Evidence Grid|swiss-img-split|swiss-img-grid/.test(slide.html)) {
      diagnostics.push({
        level: "error",
        code: "compat.swiss_locked.experimental",
        message: "Experimental P23/P24 image structures are not allowed by default.",
        slideIndex,
      });
    }

    if (/<svg\b[\s\S]*?<text\b/i.test(slide.html)) {
      diagnostics.push({
        level: "error",
        code: "compat.swiss_locked.svg.text",
        message: "SVG contains visible <text>; use HTML labels and keep SVG for geometry.",
        slideIndex,
      });
    }

    if (!isStatementLike(layout)) {
      const topChunk = slide.html.slice(0, 1800);
      if (/text-align\s*:\s*center/i.test(topChunk)) {
        diagnostics.push({
          level: "error",
          code: "compat.swiss_locked.title.center",
          message: "Swiss body titles should stay left aligned.",
          slideIndex,
        });
      }
      if (/grid-template-columns\s*:\s*[0-9.]+fr\s+[0-9.]+fr/i.test(topChunk) && /<h[12]\b/i.test(topChunk)) {
        diagnostics.push({
          level: "warning",
          code: "compat.swiss_locked.title.grid",
          message: "Heading appears inside a custom fr/fr grid; confirm it copies a registered Sxx skeleton.",
          slideIndex,
        });
      }
    }

    const imageTags = [...slide.html.matchAll(/<img\b[^>]*src=["'](?:\.\/)?images\//g)];
    imageTags.forEach((match, imageIndex) => {
      const tag = tagAt(slide.html, match.index ?? 0);
      if (!/\bdata-image-slot=["']/.test(tag)) {
        diagnostics.push({
          level: "error",
          code: "compat.swiss_locked.image.slot",
          message: `Local image ${imageIndex + 1} is missing data-image-slot.`,
          slideIndex,
        });
      }
    });

    if (layout === "S22") {
      if (!/data-image-slot=["']s22-hero-21x9["']/.test(slide.html)) {
        diagnostics.push({
          level: "error",
          code: "compat.swiss_locked.s22.slot",
          message: "S22 must use data-image-slot=\"s22-hero-21x9\".",
          slideIndex,
        });
      }
      if (/object-position\s*:\s*top center/i.test(slide.html)) {
        diagnostics.push({
          level: "error",
          code: "compat.swiss_locked.s22.crop",
          message: "S22 photo uses object-position: top center; use center 35% or center center.",
          slideIndex,
        });
      }
    }
  });

  return {
    diagnostics,
    levels: compatibilityLevels(diagnostics, options.visual ?? false),
    slideCount: slides.length,
    layoutCounts,
  };
}

export function importSwissLockedHtml(html: string, sourceName = "Imported Swiss Locked Deck"): SwissLockedImportResult {
  const warnings = validateSwissLockedHtml(html).filter((diagnostic) => diagnostic.level !== "error");
  const slides = extractSlideSections(html);
  const title = textContent(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? sourceName) || sourceName;
  const markdown: string[] = [
    "---",
    `title: ${escapeFrontmatter(title)}`,
    "theme: swiss",
    "scenario: launch-campaign",
    "mode: audience",
    "compatibility: swiss-locked",
    "outputs: [html, pdf, png, long-image, grid9]",
    "---",
    "",
  ];

  slides.forEach((slide, index) => {
    const layout = attr(slide.tag, "data-layout") ?? "";
    const agentLayout = swissLockedLayoutMap[layout] ?? "insight";
    const heading = firstText(slide.html, ["h1", "h2", "h3"]) || `Slide ${index + 1}`;
    const image = firstImage(slide.html);
    const paragraph = firstParagraph(slide.html);
    markdown.push(`# ${heading}`);
    markdown.push(`layout: ${agentLayout}`);
    if (layout) markdown.push(`data-layout: ${layout}`);
    if (image) {
      markdown.push(`image: ${image.src}`);
      markdown.push(`alt: ${image.alt || heading}`);
      if (image.slot) markdown.push(`image-slot: ${image.slot}`);
    }
    markdown.push("");
    if (paragraph && paragraph !== heading) markdown.push(paragraph, "");
  });

  return {
    markdown: markdown.join("\n").trimEnd() + "\n",
    slideCount: slides.length,
    warnings,
  };
}

function extractSlideSections(html: string): Array<{ tag: string; html: string }> {
  const matches = [...html.matchAll(/<section\b(?=[^>]*class=["'][^"']*\bslide\b[^"']*["'])[^>]*>[\s\S]*?<\/section>/gi)];
  return matches.map((match) => ({
    tag: match[0].match(/^<section\b[^>]*>/i)?.[0] ?? "",
    html: match[0],
  }));
}

function extractExternalSlides(html: string): { items: string[]; usedFallback: boolean } {
  const withoutScripts = stripExecutableScripts(html);
  const patterns = [
    /<section\b(?=[^>]*class=["'][^"']*\b(?:slide|page|ppt-slide|swiper-slide)\b[^"']*["'])[^>]*>[\s\S]*?<\/section>/gi,
    /<div\b(?=[^>]*class=["'][^"']*\b(?:slide|page|ppt-slide|swiper-slide)\b[^"']*["'])[^>]*>[\s\S]*?<\/div>/gi,
    /<section\b[^>]*>[\s\S]*?<\/section>/gi,
  ];

  for (const pattern of patterns) {
    const matches = [...withoutScripts.matchAll(pattern)].map((match) => match[0]);
    if (matches.length > 0) return { items: matches, usedFallback: false };
  }

  const body = withoutScripts.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? withoutScripts;
  return { items: [body], usedFallback: true };
}

function extractStyles(html: string, assetResolver?: (url: string) => string): string {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => rewriteCssUrls(match[1] ?? "", assetResolver))
    .join("\n\n");
}

function stripExecutableScripts(html: string): string {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
}

function rewriteReferences(html: string, assetResolver?: (url: string) => string): string {
  if (!assetResolver) return html;
  return rewriteCssUrls(html, assetResolver).replace(/\b(src|href)=["']([^"']+)["']/gi, (full, attrName: string, url: string) => {
    return `${attrName}="${escapeAttr(assetResolver(url))}"`;
  });
}

function rewriteCssUrls(source: string, assetResolver?: (url: string) => string): string {
  if (!assetResolver) return source;
  return source.replace(/url\((['"]?)([^'")]+)\1\)/gi, (_full, quote: string, url: string) => {
    return `url(${quote}${assetResolver(url)}${quote})`;
  });
}

function slideTitle(html: string, index: number): string {
  return firstText(html, ["h1", "h2", "h3"]) || `Slide ${index + 1}`;
}

function attr(tag: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\b${escaped}=["']([^"']+)["']`, "i"));
  return match?.[1];
}

function tagAt(html: string, index: number): string {
  const end = html.indexOf(">", index);
  return end === -1 ? html.slice(index) : html.slice(index, end + 1);
}

function isStatementLike(layout: string | undefined): boolean {
  return layout === "S03" || layout === "S09" || layout === "S10" || layout === "SWISS-COVER-ASCII" || layout === "SWISS-CLOSING-ASCII";
}

function firstText(html: string, tags: string[]): string | undefined {
  for (const tag of tags) {
    const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    const text = textContent(match?.[1] ?? "");
    if (text) return text;
  }
  return undefined;
}

function firstParagraph(html: string): string | undefined {
  const match = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return textContent(match?.[1] ?? "");
}

function firstImage(html: string): { src: string; alt: string; slot?: string } | undefined {
  const match = html.match(/<img\b[^>]*>/i);
  if (!match) return undefined;
  const tag = match[0];
  const src = attr(tag, "src");
  if (!src) return undefined;
  return {
    src,
    alt: attr(tag, "alt") ?? "",
    slot: attr(tag, "data-image-slot"),
  };
}

function textContent(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeFrontmatter(value: string): string {
  return value.includes(":") ? JSON.stringify(value) : value;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function swissLockedIdToAgentLayout(id: string): string {
  return swissLockedLayoutMap[id] ?? slugify(id);
}

function compatibilityLevels(diagnostics: Diagnostic[], visual: boolean): string[] {
  const errors = diagnostics.filter((diagnostic) => diagnostic.level === "error");
  const levels = ["L1-structure"];
  if (!errors.some((diagnostic) => diagnostic.code.includes("layout"))) levels.push("L2-layout");
  if (!errors.some((diagnostic) => /image|slot|s22/.test(diagnostic.code))) levels.push("L3-slot");
  if (visual) levels.push("L4-visual-requested");
  if (!errors.length && visual) levels.push("L5-round-trip-ready");
  return levels;
}
