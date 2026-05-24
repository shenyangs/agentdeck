import { slugify, type DeckDocument, type Diagnostic } from "@agentdeck/schema";

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

function firstText(html: string, tags: string[]): string | undefined {
  for (const tag of tags) {
    const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    const text = textContent(match?.[1] ?? "");
    if (text) return text;
  }
  return undefined;
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

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
