import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Diagnostic } from "@agentdeck/schema";
import type { HtmlCaptureStrategy, HtmlCompatibilityAnalysis, HtmlCompatibilityReport, HtmlWrapStrategy } from "../types.js";

export function analyzeHtmlCompatibility(html: string): HtmlCompatibilityAnalysis {
  const detectedSlideCount = detectHtmlSlideCount(html);
  const signals = {
    fixedViewport: /position\s*:\s*fixed/i.test(html),
    viewportUnits: /100vw/i.test(html) && /100vh/i.test(html),
    horizontalDeck: /translateX\s*\(/i.test(html) || /translate3d\s*\(/i.test(html) || /width\s*:\s*10000vw/i.test(html) || /width\s*=\s*\([^)]*total[^)]*\*\s*100\)/i.test(html),
    ownNavigation: /keydown/i.test(html) || /wheel/i.test(html) || /touchstart/i.test(html) || /hashchange/i.test(html) || /id=["']nav["']/i.test(html),
    canvasOrWebgl: /<canvas\b/i.test(html) || /webgl/i.test(html) || /getContext\(["']webgl/i.test(html),
    moduleScripts: /<script\b[^>]*type=["']module["']/i.test(html),
    externalScripts: /<script\b[^>]*\bsrc=/i.test(html),
    detectedSlideCount,
  };
  const score = [
    signals.fixedViewport ? 0.22 : 0,
    signals.viewportUnits ? 0.22 : 0,
    signals.horizontalDeck ? 0.2 : 0,
    signals.ownNavigation ? 0.14 : 0,
    signals.canvasOrWebgl ? 0.1 : 0,
    signals.moduleScripts ? 0.06 : 0,
    signals.externalScripts ? 0.03 : 0,
    detectedSlideCount > 1 ? 0.03 : 0,
  ].reduce((sum, value) => sum + value, 0);
  const reasons: string[] = [];
  if (signals.fixedViewport) reasons.push("detected fixed-position full-screen layout");
  if (signals.viewportUnits) reasons.push("detected 100vw/100vh slide sizing");
  if (signals.horizontalDeck) reasons.push("detected horizontal viewport deck transform");
  if (signals.ownNavigation) reasons.push("detected source navigation or keyboard handlers");
  if (signals.canvasOrWebgl) reasons.push("detected canvas/WebGL rendering");
  if (signals.moduleScripts) reasons.push("detected module scripts that may not survive DOM extraction");
  if (signals.externalScripts) reasons.push("detected external scripts");
  if (detectedSlideCount > 1) reasons.push(`detected ${detectedSlideCount} slide-like sections`);

  if (score >= 0.58) {
    return {
      recommendedStrategy: "raster",
      confidence: Math.min(0.98, score),
      reasons,
      signals,
    };
  }
  return {
    recommendedStrategy: "dom",
    confidence: Math.max(0.58, 1 - score),
    reasons: reasons.length ? reasons : ["no full-screen player signals detected"],
    signals,
  };
}

export function detectHtmlSlideCount(html: string): number {
  const patterns = [
    /<section\b(?=[^>]*class=["'][^"']*\bslide\b[^"']*["'])/gi,
    /<div\b(?=[^>]*class=["'][^"']*\b(?:slide|page|ppt-slide|swiper-slide)\b[^"']*["'])/gi,
    /<[^>]+\bdata-slide(?:=["'][^"']*["'])?[^>]*>/gi,
    /<section\b/gi,
  ];
  for (const pattern of patterns) {
    const count = [...html.matchAll(pattern)].length;
    if (count > 0) return count;
  }
  return 1;
}

export function htmlDomFallbackReason(imported: { slideCount: number; warnings: Diagnostic[] }, analysis: HtmlCompatibilityAnalysis): string | undefined {
  const usedFallback = imported.warnings.some((diagnostic) => diagnostic.code === "compat.external_html.slides.fallback");
  if (usedFallback && (analysis.signals.fixedViewport || analysis.signals.viewportUnits || analysis.signals.ownNavigation)) {
    return "DOM importer fell back to one body slide while the source looks like a player";
  }
  if (analysis.signals.detectedSlideCount > 1 && imported.slideCount < analysis.signals.detectedSlideCount) {
    return `DOM importer found ${imported.slideCount} slide(s), but source analysis found ${analysis.signals.detectedSlideCount}`;
  }
  return undefined;
}

export function writeHtmlCompatibilityReport(outDir: string, report: HtmlCompatibilityReport): string {
  const compatReportPath = join(outDir, "compat-report.json");
  writeFileSync(compatReportPath, JSON.stringify(report, null, 2), "utf8");
  return compatReportPath;
}

export function formatHtmlStrategyDecision(requested: HtmlWrapStrategy, selected: Exclude<HtmlWrapStrategy, "auto">, analysis: HtmlCompatibilityAnalysis): string {
  const confidence = Math.round(analysis.confidence * 100);
  const prefix = requested === "auto" ? "Auto HTML strategy" : "HTML strategy override";
  return `${prefix}: ${selected} (${confidence}% confidence; ${analysis.reasons.slice(0, 3).join("; ")})`;
}

export function htmlTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return undefined;
  return match[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim() || undefined;
}

export function viewportFlag(value: string | boolean | undefined): { width: number; height: number } {
  if (typeof value === "string") {
    const match = value.match(/^(\d+)x(\d+)$/i);
    if (match) return { width: Number(match[1]), height: Number(match[2]) };
  }
  return { width: 1920, height: 1080 };
}

export async function chooseHtmlCaptureStrategy(page: any, sourceUrl: string, count: number, settleMs: number): Promise<HtmlCaptureStrategy> {
  if (count <= 1) return "hash";
  const firstHash = await captureVisualSignature(page, sourceUrl, 0, "hash", settleMs);
  const secondHash = await captureVisualSignature(page, sourceUrl, 1, "hash", settleMs);
  if (firstHash !== secondHash) return "hash";
  const firstKeyboard = await captureVisualSignature(page, sourceUrl, 0, "keyboard", settleMs);
  const secondKeyboard = await captureVisualSignature(page, sourceUrl, 1, "keyboard", settleMs);
  if (firstKeyboard !== secondKeyboard) return "keyboard";
  const firstScroll = await captureVisualSignature(page, sourceUrl, 0, "scroll", settleMs);
  const secondScroll = await captureVisualSignature(page, sourceUrl, 1, "scroll", settleMs);
  if (firstScroll !== secondScroll) return "scroll";
  return "hash";
}

export async function detectHtmlDeckAdapter(page: any): Promise<string> {
  return await page.evaluate(() => {
    if ((window as any).Reveal || document.querySelector(".reveal .slides")) return "revealjs";
    if (document.querySelector(".bespoke-parent,.bespoke-slide")) return "bespoke";
    if (document.querySelector(".swiper,.swiper-container,.swiper-slide")) return "swiper";
    if (document.querySelector(".slidev-layout,#slide-content")) return "slidev";
    if (document.querySelector(".marpit,.marp-slide,[data-marpit-fragment]")) return "marp";
    if (document.querySelector("canvas") && document.querySelectorAll("section,.slide,.page,[data-slide]").length <= 1) return "canvas-single-page";
    return "generic-section";
  });
}

export async function installLocalOnlyNetworkPolicy(page: any): Promise<void> {
  await page.route("**/*", (route: any) => {
    const url = route.request().url();
    if (/^(file:|data:|blob:|about:)/i.test(url)) {
      route.continue();
      return;
    }
    route.abort();
  });
}

export async function captureVisualSignature(page: any, sourceUrl: string, index: number, strategy: HtmlCaptureStrategy, settleMs: number): Promise<string> {
  await navigateHtmlCapturePage(page, sourceUrl, index, strategy, Math.min(settleMs, 250));
  return await page.evaluate(() => {
    const body = document.body;
    const active = document.querySelector(".active,.is-active,.current,.is-current,[aria-current='true']");
    return [
      window.scrollX,
      window.scrollY,
      document.documentElement.scrollLeft,
      document.documentElement.scrollTop,
      body?.scrollLeft,
      body?.scrollTop,
      active?.textContent?.slice(0, 160) ?? "",
      document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.textContent?.slice(0, 160) ?? "",
      document.querySelector("canvas") ? "canvas" : "",
    ].join("|");
  });
}

export async function navigateHtmlCapturePage(page: any, sourceUrl: string, index: number, strategy: HtmlCaptureStrategy, settleMs: number): Promise<void> {
  const url = new URL(sourceUrl);
  url.searchParams.set("slide", String(index + 1));
  url.searchParams.set("agentdeck-raster", "1");
  url.hash = `#/${index + 1}`;
  await page.goto(url.toString(), { waitUntil: "load" });
  if (strategy === "keyboard") {
    for (let step = 0; step < index; step += 1) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(80);
    }
  }
  if (strategy === "scroll") {
    await page.evaluate((slideIndex: number) => {
      const x = window.innerWidth * slideIndex;
      const y = window.innerHeight * slideIndex;
      window.scrollTo({ left: x, top: y, behavior: "instant" as ScrollBehavior });
      document.documentElement.scrollLeft = x;
      document.documentElement.scrollTop = y;
      document.body.scrollLeft = x;
      document.body.scrollTop = y;
    }, index);
  }
  await page.waitForTimeout(settleMs);
}


