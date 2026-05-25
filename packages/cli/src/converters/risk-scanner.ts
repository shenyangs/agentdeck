import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";
import type {
  CompatibilityAssetKind,
  CompatibilityAssetSignal,
  CompatibilityAssetStatus,
  CompatibilityRenderRisk,
  CompatibilityScan,
  HtmlCompatibilityAnalysis,
} from "../types.js";

const SCAN_SCHEMA_VERSION = "1.0";
const MAX_REPORTED_ITEMS = 80;

export function scanInputCompatibility(
  sourcePath: string,
  options: { htmlSource?: string; allowNetwork?: boolean } = {},
): CompatibilityScan {
  const ext = extname(sourcePath).toLowerCase();
  if (ext === ".html" || ext === ".htm") {
    const html = options.htmlSource ?? (existsSync(sourcePath) ? readFileSync(sourcePath, "utf8") : "");
    return scanHtmlCompatibility(html, dirname(sourcePath), { allowNetwork: Boolean(options.allowNetwork) });
  }
  if ([".pptx", ".docx", ".xlsx"].includes(ext)) {
    return scanOpenXmlCompatibility(sourcePath);
  }
  if ([".ppt", ".doc", ".xls", ".key"].includes(ext)) {
    return buildScan("office", [], [], [
      "Binary or native Office formats cannot be inspected for linked resources before conversion; verify rendered output after wrap.",
    ]);
  }
  if (ext === ".pdf") return buildScan("pdf");
  if (ext === ".md") return buildScan("markdown");
  return buildScan("unsupported");
}

export function scanHtmlCompatibility(
  html: string,
  sourceDir: string,
  options: { allowNetwork?: boolean } = {},
): CompatibilityScan {
  const assets: CompatibilityAssetSignal[] = [];
  const addAsset = (kind: CompatibilityAssetKind, url: string, source: string) => {
    const trimmed = decodeHtmlEntities(url.trim());
    if (!trimmed) return;
    assets.push({
      kind,
      url: trimmed,
      status: classifyAssetUrl(trimmed, sourceDir),
      source,
    });
  };

  for (const match of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) addAsset("image", match[1] ?? "", "img[src]");
  for (const match of html.matchAll(/<image\b[^>]*\b(?:href|xlink:href)=["']([^"']+)["'][^>]*>/gi)) addAsset("image", match[1] ?? "", "svg image[href]");
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) addAsset("script", match[1] ?? "", "script[src]");
  for (const match of html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
    addAsset(linkKind(match[0]), match[1] ?? "", "link[href]");
  }
  for (const match of html.matchAll(/<(?:video|audio|source)\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) addAsset("media", match[1] ?? "", "media[src]");
  for (const match of html.matchAll(/<video\b[^>]*\bposter=["']([^"']+)["'][^>]*>/gi)) addAsset("image", match[1] ?? "", "video[poster]");
  for (const match of html.matchAll(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) addAsset("iframe", match[1] ?? "", "iframe[src]");
  for (const match of html.matchAll(/<object\b[^>]*\bdata=["']([^"']+)["'][^>]*>/gi)) addAsset("object", match[1] ?? "", "object[data]");
  for (const match of html.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
    for (const item of parseSrcset(match[1] ?? "")) addAsset("image", item, "srcset");
  }
  for (const match of html.matchAll(/url\((['"]?)([^'")]+)\1\)/gi)) addAsset(cssUrlKind(match[2] ?? ""), match[2] ?? "", "css url()");

  const renderRisks = detectHtmlRenderRisks(html);
  const warnings = scanWarnings(buildSummary(assets, renderRisks), options.allowNetwork);
  return buildScan("html", assets, renderRisks, warnings);
}

export function adjustHtmlAnalysisForCompatibilityScan(
  analysis: HtmlCompatibilityAnalysis,
  scan: CompatibilityScan,
): HtmlCompatibilityAnalysis {
  const renderDependent = scan.renderRisks.filter((risk) => [
    "html.math-renderer",
    "html.diagram-renderer",
    "html.canvas",
    "html.webgl",
    "html.iframe",
    "html.foreign-object",
  ].includes(risk.code));
  if (!renderDependent.length || analysis.recommendedStrategy === "raster") return analysis;
  return {
    ...analysis,
    recommendedStrategy: "raster",
    confidence: Math.max(analysis.confidence, 0.74),
    reasons: [
      ...analysis.reasons,
      `detected render-dependent content (${renderDependent.map((risk) => risk.code.replace(/^html\./, "")).join(", ")})`,
    ],
  };
}

function scanOpenXmlCompatibility(sourcePath: string): CompatibilityScan {
  if (!existsSync(sourcePath)) return buildScan("office", [], [], [`source file not found: ${sourcePath}`]);
  let entries: ZipEntry[];
  try {
    entries = readZipEntries(sourcePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildScan("office", [], [], [`OpenXML relationship scan skipped: ${message}`]);
  }

  const assets: CompatibilityAssetSignal[] = [];
  for (const entry of entries.filter((item) => item.name.endsWith(".rels"))) {
    let xml = "";
    try {
      xml = readZipEntryText(sourcePath, entry);
    } catch {
      continue;
    }
    for (const relationship of xml.matchAll(/<Relationship\b([^>]*)\/?>/gi)) {
      const attrs = relationshipAttributes(relationship[1] ?? "");
      const target = attrs.Target ?? attrs.target;
      if (!target) continue;
      const mode = attrs.TargetMode ?? attrs.targetmode;
      if (mode !== "External" && !isExternalUrl(target)) continue;
      const type = attrs.Type ?? attrs.type;
      assets.push({
        kind: officeRelationshipKind(type, target),
        url: decodeXmlEntities(target),
        status: isExternalUrl(target) ? "external" : "special",
        source: entry.name,
        relationshipType: type,
      });
    }
  }

  const externalVisualLinks = assets.filter((asset) => ["image", "media", "object", "office-relationship"].includes(asset.kind)).length;
  const warnings = externalVisualLinks
    ? [`OpenXML package has ${externalVisualLinks} external visual/object relationship(s); conversion may need network access or original linked files.`]
    : [];
  return buildScan("office", assets, [], warnings);
}

function buildScan(
  sourceKind: CompatibilityScan["sourceKind"],
  assets: CompatibilityAssetSignal[] = [],
  renderRisks: CompatibilityRenderRisk[] = [],
  warnings: string[] = [],
): CompatibilityScan {
  const limitedAssets = assets.slice(0, MAX_REPORTED_ITEMS);
  const summary = buildSummary(assets, renderRisks);
  return {
    schemaVersion: SCAN_SCHEMA_VERSION,
    scanner: "agentdeck-compatibility-risk",
    sourceKind,
    summary,
    assets: limitedAssets,
    renderRisks,
    warnings,
  };
}

function buildSummary(assets: CompatibilityAssetSignal[], renderRisks: CompatibilityRenderRisk[]): CompatibilityScan["summary"] {
  return {
    externalResources: assets.filter((asset) => asset.status === "external").length,
    missingLocalResources: assets.filter((asset) => asset.status === "missing").length,
    localResources: assets.filter((asset) => asset.status === "local").length,
    dataResources: assets.filter((asset) => asset.status === "data").length,
    renderRiskCount: renderRisks.filter((risk) => risk.level === "warn").length,
    externalOfficeRelationships: assets.filter((asset) => asset.source?.endsWith(".rels") && asset.status === "external").length,
  };
}

function scanWarnings(summary: CompatibilityScan["summary"], allowNetwork?: boolean): string[] {
  const warnings: string[] = [];
  if (summary.externalResources) {
    warnings.push(
      allowNetwork
        ? `${summary.externalResources} external resource(s) detected; raster capture depends on current network availability.`
        : `${summary.externalResources} external resource(s) detected; raster capture blocks network by default and DOM output may not be fully offline.`,
    );
  }
  if (summary.missingLocalResources) warnings.push(`${summary.missingLocalResources} local resource(s) referenced by the source are missing.`);
  if (summary.renderRiskCount) warnings.push(`${summary.renderRiskCount} render-dependent feature(s) detected; raster capture is safer than DOM import.`);
  return warnings;
}

function classifyAssetUrl(url: string, sourceDir: string): CompatibilityAssetStatus {
  if (/^data:/i.test(url)) return "data";
  if (/^(?:blob:|mailto:|tel:|javascript:|#|about:)/i.test(url)) return "special";
  if (isExternalUrl(url)) return "external";
  const [pathname] = url.split(/[?#]/);
  if (!pathname) return "special";
  const resolved = resolve(sourceDir, pathname);
  return existsSync(resolved) && statSync(resolved).isFile() ? "local" : "missing";
}

function isExternalUrl(url: string): boolean {
  return /^(?:https?:)?\/\//i.test(url) || /^file:\/\//i.test(url);
}

function linkKind(tag: string): CompatibilityAssetKind {
  if (/\brel=["'][^"']*stylesheet/i.test(tag)) return "stylesheet";
  if (/\brel=["'][^"']*(?:preload|preconnect)/i.test(tag) && /\bas=["']font/i.test(tag)) return "font";
  if (/\brel=["'][^"']*(?:icon|apple-touch-icon)/i.test(tag)) return "image";
  return "other";
}

function cssUrlKind(url: string): CompatibilityAssetKind {
  return /\.(?:woff2?|ttf|otf|eot)(?:[?#].*)?$/i.test(url) ? "font" : "css-url";
}

function parseSrcset(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function detectHtmlRenderRisks(html: string): CompatibilityRenderRisk[] {
  const risks: CompatibilityRenderRisk[] = [];
  const add = (code: string, message: string, evidence?: string, recommendation = "Prefer raster capture for visual fidelity."): void => {
    risks.push({ code, level: "warn", message, evidence, recommendation });
  };
  if (/<canvas\b/i.test(html)) add("html.canvas", "Canvas content may be lost during DOM import.", "<canvas>");
  if (/webgl|getContext\(["']webgl/i.test(html)) add("html.webgl", "WebGL content depends on runtime rendering.", "webgl");
  if (/<iframe\b/i.test(html)) add("html.iframe", "Iframe content may be blocked, remote, or unavailable offline.", "<iframe>");
  if (/<math\b|mathjax|mjx-container|katex/i.test(html)) add("html.math-renderer", "Formula rendering may depend on MathJax/KaTeX fonts or scripts.", "mathjax/katex");
  if (/\bmermaid\b|<pre\b[^>]*class=["'][^"']*mermaid/i.test(html)) add("html.diagram-renderer", "Diagram rendering may depend on Mermaid or client-side scripts.", "mermaid");
  if (/\b(?:hljs|highlight\.js|prismjs|language-[a-z0-9_-]+)/i.test(html)) add("html.syntax-highlight", "Code highlighting may depend on CSS or client-side scripts.", "syntax highlight");
  if (/<script\b[^>]*type=["']module["']/i.test(html)) add("html.module-script", "Module scripts are removed by DOM import and require browser execution for raster capture.", "type=module");
  if (/<script\b[^>]*\bsrc=/i.test(html)) add("html.external-script", "External scripts are removed by DOM import and may be blocked during raster capture.", "script[src]");
  if (/<foreignObject\b/i.test(html)) add("html.foreign-object", "SVG foreignObject rendering is browser-dependent.", "<foreignObject>");
  if (/<svg\b[\s\S]*?<text\b/i.test(html)) risks.push({ code: "html.svg-text", level: "info", message: "SVG text detected; preserve with raster if fonts are unstable.", evidence: "<svg><text>" });
  return risks;
}

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function readZipEntries(filePath: string): ZipEntry[] {
  const data = readFileSync(filePath);
  const eocdOffset = findEndOfCentralDirectory(data);
  if (eocdOffset === -1) throw new Error("not a readable zip/OpenXML package");
  const totalEntries = data.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = data.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (data.readUInt32LE(offset) !== 0x02014b50) break;
    const method = data.readUInt16LE(offset + 10);
    const compressedSize = data.readUInt32LE(offset + 20);
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const localHeaderOffset = data.readUInt32LE(offset + 42);
    const name = data.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    entries.push({ name, method, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipEntryText(filePath: string, entry: ZipEntry): string {
  const data = readFileSync(filePath);
  const offset = entry.localHeaderOffset;
  if (data.readUInt32LE(offset) !== 0x04034b50) throw new Error(`invalid local header for ${entry.name}`);
  const nameLength = data.readUInt16LE(offset + 26);
  const extraLength = data.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const compressed = data.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return compressed.toString("utf8");
  if (entry.method === 8) return inflateRawSync(compressed).toString("utf8");
  throw new Error(`unsupported zip compression method ${entry.method}`);
}

function findEndOfCentralDirectory(data: Buffer): number {
  const min = Math.max(0, data.length - 65_557);
  for (let offset = data.length - 22; offset >= min; offset -= 1) {
    if (data.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function relationshipAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of source.matchAll(/([A-Za-z_:][\w:.-]*)=["']([^"']*)["']/g)) {
    attrs[match[1] ?? ""] = decodeXmlEntities(match[2] ?? "");
  }
  return attrs;
}

function officeRelationshipKind(type = "", target = ""): CompatibilityAssetKind {
  if (/image/i.test(type) || /\.(?:png|jpe?g|gif|webp|svg|tiff?)(?:[?#].*)?$/i.test(target)) return "image";
  if (/video|audio|media/i.test(type) || /\.(?:mp4|mov|mp3|wav|m4a)(?:[?#].*)?$/i.test(target)) return "media";
  if (/hyperlink/i.test(type)) return "hyperlink";
  if (/oleObject|package/i.test(type)) return "object";
  return "office-relationship";
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function decodeXmlEntities(value: string): string {
  return decodeHtmlEntities(value);
}
