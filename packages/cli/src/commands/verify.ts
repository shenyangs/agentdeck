import { existsSync, mkdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "../flags.js";
import { loadPlaywright } from "../process/playwright.js";
import {
  AGENTDECK_VERSION,
  REPORT_SCHEMA_VERSION,
  defaultQualitySignals,
  pipelineAttempt,
  reportEnvironment,
  reportOutput,
  reportSource,
  writeJsonReport,
} from "../reports.js";
import type { CliResult, VerifyIssue, VerifyReport } from "../types.js";
import { resolveInputPath } from "../utils/files.js";

export async function commandVerify(args: string[]): Promise<CliResult> {
  const options = parseArgs(args);
  const file = options.positionals[0];
  if (!file) {
    console.error("Usage: agentdeck verify <dist/index.html> [--out verify-report.json] [--json]");
    return { code: 2 };
  }
  const htmlPath = resolveInputPath(file);
  const report = await verifyStandaloneHtml(htmlPath, { debug: Boolean(options.flags.debug) });
  const outPath = resolve(String(options.flags.out ?? join(dirname(htmlPath), "verify-report.json")));
  mkdirSync(dirname(outPath), { recursive: true });
  writeJsonReport(outPath, report);
  if (options.flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatVerifyReport(report));
    console.log(`Wrote ${outPath}`);
  }
  return { code: report.status === "fail" ? 1 : 0 };
}

export async function verifyStandaloneHtml(htmlPath: string, options: { debug?: boolean } = {}): Promise<VerifyReport> {
  if (!existsSync(htmlPath)) throw new Error(`HTML file not found: ${htmlPath}`);
  const startedAt = Date.now();
  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const url = pathToFileURL(htmlPath).toString();
  try {
    await page.goto(`${url}#/1`, { waitUntil: "load" });
    await page.waitForTimeout(200);
    const first = await collectVerifyMetrics(page);
    const hashJump = await verifyHashJump(page, first.slideCount);
    const overviewJump = await verifyOverviewJump(page, first.slideCount);
    const comparePreview = await verifyComparePreview(page, first.slideCount);
    const after = await collectVerifyMetrics(page);
    const visibleAreaRatio = Math.max(first.visibleAreaRatio, after.visibleAreaRatio);
    const dockClear = first.dockClear && after.dockClear;
    const checks = {
      hasSlides: first.slideCount > 0,
      visibleArea: visibleAreaRatio >= 0.55,
      imagesLoaded: first.imageFailures.length === 0,
      hashJump,
      overviewCount: first.slideCount > 0 && first.overviewCount === first.slideCount,
      overviewJump,
      comparePreview,
      dockClear,
    };
    const issues: VerifyIssue[] = [];
    if (!checks.hasSlides) issues.push({ level: "fail", code: "slides.missing", message: "No AgentDeck slides were found." });
    if (!checks.visibleArea) issues.push({ level: "fail", code: "slide.too_small", message: `Visible slide area is too small (${Math.round(visibleAreaRatio * 100)}% of stage).` });
    if (!checks.imagesLoaded) issues.push({ level: "fail", code: "images.failed", message: `${first.imageFailures.length} image(s) failed to load.` });
    if (!checks.hashJump) issues.push({ level: "fail", code: "navigation.hash", message: "Hash navigation did not activate the requested slide." });
    if (!checks.overviewCount) issues.push({ level: "warn", code: "overview.count", message: `Overview thumbnail count (${first.overviewCount}) does not match slide count (${first.slideCount}).` });
    if (!checks.overviewJump) issues.push({ level: "warn", code: "navigation.overview", message: "Overview thumbnails did not jump to the selected slide." });
    if (!checks.comparePreview) issues.push({ level: "warn", code: "compare.preview", message: "Compare preview did not show the next slide." });
    if (!checks.dockClear) issues.push({ level: "warn", code: "dock.overlap", message: "Bottom dock overlaps the visible slide." });
    const status = issues.some((issue) => issue.level === "fail") ? "fail" : issues.length ? "warn" : "pass";
    const outputBytes = statSync(htmlPath).size;
    return {
      schemaVersion: REPORT_SCHEMA_VERSION,
      agentdeckVersion: AGENTDECK_VERSION,
      source: reportSource(htmlPath, { debug: options.debug }),
      status,
      environment: reportEnvironment(["playwright"]),
      pipeline: [pipelineAttempt({
        step: "verify-html-player",
        backend: "playwright",
        status: status === "fail" ? "failed" : "success",
        durationMs: Date.now() - startedAt,
        message: issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ") || undefined,
      })],
      output: reportOutput({
        htmlPath: options.debug ? htmlPath : basename(htmlPath),
        bytes: outputBytes,
        pageCount: first.slideCount,
        packMode: "single-html",
        fidelity: "unknown",
      }),
      qualitySignals: {
        blankPages: [],
        pageCountMismatch: checks.overviewCount === false,
        oversizedOutput: false,
        warnings: issues.filter((issue) => issue.level === "warn").map((issue) => `${issue.code}: ${issue.message}`),
      },
      slideCount: first.slideCount,
      overviewCount: first.overviewCount,
      visibleAreaRatio,
      imageFailures: first.imageFailures,
      checks,
      issues,
    };
  } finally {
    await browser.close();
  }
}

export function formatVerifyReport(report: VerifyReport): string {
  const lines = [
    `Verify: ${report.status.toUpperCase()}`,
    `Slides: ${report.slideCount}`,
    `Overview thumbnails: ${report.overviewCount}`,
    `Visible area: ${Math.round(report.visibleAreaRatio * 100)}%`,
  ];
  for (const issue of report.issues) {
    lines.push(`${issue.level.toUpperCase()} ${issue.code}: ${issue.message}`);
  }
  return lines.join("\n");
}

async function collectVerifyMetrics(page: any): Promise<{
  slideCount: number;
  overviewCount: number;
  visibleAreaRatio: number;
  imageFailures: Array<{ src: string; alt: string }>;
  dockClear: boolean;
}> {
  return await page.evaluate(() => {
    const rectObject = (rect: DOMRect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height });
    const intersectionArea = (a: ReturnType<typeof rectObject>, b: ReturnType<typeof rectObject>) => {
      const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return width * height;
    };
    const slides = [...document.querySelectorAll<HTMLElement>(".ad-scaled > .ad-slide")];
    const visible = document.querySelector<HTMLElement>(".ad-scaled > .ad-slide:not([hidden])");
    const stage = document.querySelector<HTMLElement>(".ad-stage");
    const dock = document.querySelector<HTMLElement>(".ad-dock");
    const slideRect = visible ? rectObject(visible.getBoundingClientRect()) : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const stageRect = stage ? rectObject(stage.getBoundingClientRect()) : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight };
    const stageArea = Math.max(1, stageRect.width * stageRect.height);
    const dockRect = dock ? rectObject(dock.getBoundingClientRect()) : undefined;
    const imageFailures = [...document.querySelectorAll<HTMLImageElement>(".ad-scaled img")]
      .filter((image) => !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0)
      .map((image) => ({ src: image.currentSrc || image.src || "", alt: image.alt || "" }));
    const overlap = dockRect ? intersectionArea(slideRect, dockRect) / Math.max(1, slideRect.width * slideRect.height) : 0;
    return {
      slideCount: slides.length,
      overviewCount: document.querySelectorAll("[data-overview-index]").length,
      visibleAreaRatio: intersectionArea(slideRect, stageRect) / stageArea,
      imageFailures,
      dockClear: overlap < 0.02,
    };
  });
}

async function verifyHashJump(page: any, slideCount: number): Promise<boolean> {
  if (slideCount <= 1) return slideCount === 1;
  await page.evaluate(() => { location.hash = "#/2"; });
  await page.waitForTimeout(250);
  return await page.evaluate(() => {
    const current = Number(document.querySelector("[data-current]")?.textContent?.trim());
    const visible = document.querySelector<HTMLElement>(".ad-scaled > .ad-slide:not([hidden])");
    return current === 2 || visible?.getAttribute("data-slide-index") === "1";
  });
}

async function verifyOverviewJump(page: any, slideCount: number): Promise<boolean> {
  if (slideCount <= 1) return slideCount === 1;
  const overviewButton = await page.$('[data-action="overview"]');
  if (!overviewButton) return false;
  await overviewButton.click();
  await page.waitForTimeout(150);
  const target = await page.$(`[data-overview-index="${slideCount - 1}"]`);
  if (!target) return false;
  await target.click();
  await page.waitForTimeout(200);
  return await page.evaluate((expected: number) => {
    const current = Number(document.querySelector("[data-current]")?.textContent?.trim());
    const visible = document.querySelector<HTMLElement>(".ad-scaled > .ad-slide:not([hidden])");
    return current === expected || visible?.getAttribute("data-slide-index") === String(expected - 1);
  }, slideCount);
}

async function verifyComparePreview(page: any, slideCount: number): Promise<boolean> {
  if (slideCount <= 1) return slideCount === 1;
  const compareButton = await page.$('[data-action="compare"]');
  if (!compareButton) return false;
  await compareButton.click();
  await page.waitForTimeout(150);
  const ok = await page.evaluate(() => {
    const compare = document.querySelector<HTMLElement>('[data-overlay="compare"]');
    const preview = document.querySelector<HTMLElement>("[data-compare-next]");
    return Boolean(compare && !compare.hidden && preview && preview.children.length > 0);
  });
  await compareButton.click();
  return ok;
}
