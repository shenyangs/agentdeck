import { existsSync, mkdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs, positiveIntegerFlag } from "../flags.js";
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
import type { CliResult, VerifyContactSheet, VerifyIssue, VerifyReport, VerifySlideReview } from "../types.js";
import { resolveInputPath } from "../utils/files.js";

interface ContactSheetOptions {
  outputPath: string;
  columns?: number;
  thumbnailWidth?: number;
}

export async function commandVerify(args: string[]): Promise<CliResult> {
  const options = parseArgs(args);
  const file = options.positionals[0];
  if (!file) {
    console.error("Usage: agentdeck verify <dist/index.html> [--out verify-report.json] [--contact-sheet [contact-sheet.png]] [--contact-sheet-cols 4] [--contact-sheet-width 240] [--json]");
    return { code: 2 };
  }
  const htmlPath = resolveInputPath(file);
  const outPath = resolve(String(options.flags.out ?? join(dirname(htmlPath), "verify-report.json")));
  const contactSheet = contactSheetOptions(options.flags, outPath);
  const report = await verifyStandaloneHtml(htmlPath, {
    debug: Boolean(options.flags.debug),
    contactSheet,
  });
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

export async function verifyStandaloneHtml(htmlPath: string, options: { debug?: boolean; contactSheet?: ContactSheetOptions } = {}): Promise<VerifyReport> {
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
    const contactSheet = options.contactSheet
      ? await createContactSheet(browser, page, first.slideCount, options.contactSheet)
      : undefined;
    if (contactSheet) {
      const blankPages = contactSheet.pages.filter((slide) => slide.flags.includes("blank")).map((slide) => slide.index);
      const clippedPages = contactSheet.pages.filter((slide) => slide.flags.includes("clipped")).map((slide) => slide.index);
      const lowResolutionPages = contactSheet.pages.filter((slide) => slide.flags.includes("low-resolution")).map((slide) => slide.index);
      if (blankPages.length) issues.push({ level: "warn", code: "slides.blank", message: `Contact sheet flagged possible blank slide(s): ${formatPageList(blankPages)}.` });
      if (clippedPages.length) issues.push({ level: "warn", code: "slides.clipped", message: `Contact sheet flagged possible clipped slide(s): ${formatPageList(clippedPages)}.` });
      if (lowResolutionPages.length) issues.push({ level: "warn", code: "slides.low_resolution", message: `Contact sheet flagged low-resolution slide image(s): ${formatPageList(lowResolutionPages)}.` });
    }
    const status = issues.some((issue) => issue.level === "fail") ? "fail" : issues.length ? "warn" : "pass";
    const outputBytes = statSync(htmlPath).size;
    const warnings = issues.filter((issue) => issue.level === "warn").map((issue) => `${issue.code}: ${issue.message}`);
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
        blankPages: contactSheet?.pages.filter((slide) => slide.flags.includes("blank")).map((slide) => slide.index) ?? [],
        pageCountMismatch: checks.overviewCount === false,
        oversizedOutput: false,
        warnings,
      },
      slideCount: first.slideCount,
      overviewCount: first.overviewCount,
      visibleAreaRatio,
      imageFailures: first.imageFailures,
      checks,
      issues,
      contactSheet,
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
  if (report.contactSheet) lines.push(`Contact sheet: ${report.contactSheet.path}`);
  for (const issue of report.issues) {
    lines.push(`${issue.level.toUpperCase()} ${issue.code}: ${issue.message}`);
  }
  return lines.join("\n");
}

function contactSheetOptions(flags: Record<string, string | boolean>, reportPath: string): ContactSheetOptions | undefined {
  if (!flags["contact-sheet"]) return undefined;
  const value = flags["contact-sheet"];
  const outputPath = typeof value === "string" ? resolve(value) : join(dirname(reportPath), "contact-sheet.png");
  return {
    outputPath,
    columns: positiveIntegerFlag(flags["contact-sheet-cols"]),
    thumbnailWidth: positiveIntegerFlag(flags["contact-sheet-width"]),
  };
}

async function createContactSheet(
  browser: any,
  deckPage: any,
  slideCount: number,
  options: ContactSheetOptions,
): Promise<VerifyContactSheet> {
  mkdirSync(dirname(options.outputPath), { recursive: true });
  await deckPage.setViewportSize({ width: 960, height: 540 });
  await deckPage.waitForTimeout(120);
  const renderPage = await browser.newPage();
  try {
    const layout = contactSheetLayout(slideCount, options);
    await setupContactSheetCanvas(renderPage, slideCount, layout);
    const pages: VerifySlideReview[] = [];
    for (let index = 1; index <= slideCount; index += 1) {
      await deckPage.evaluate((target: number) => { location.hash = `#/${target}`; }, index);
      await deckPage.waitForTimeout(50);
      const locator = deckPage.locator(".ad-scaled > .ad-slide:not([hidden])");
      const buffer = await locator.screenshot({ type: "png", scale: "css" });
      const metadata = await collectSlideCaptureMetadata(deckPage, index, buffer.byteLength);
      const review = await appendContactSheetSlide(
        renderPage,
        `data:image/png;base64,${buffer.toString("base64")}`,
        metadata,
        slideCount,
        layout,
      );
      pages.push(review);
    }
    await renderPage.locator("canvas").screenshot({ path: options.outputPath });
    return {
      path: options.outputPath,
      pageCount: slideCount,
      columns: layout.columns,
      thumbnailWidth: layout.thumbnailWidth,
      pages,
    };
  } finally {
    await renderPage.close();
  }
}

interface SlideCaptureMetadata {
  index: number;
  screenshotBytes: number;
  visibleRatio: number;
  stageCoverageRatio: number;
  imageScaleRatio?: number;
}

async function collectSlideCaptureMetadata(page: any, index: number, screenshotBytes: number): Promise<SlideCaptureMetadata> {
  const metrics = await page.evaluate(() => {
    const rectObject = (rect: DOMRect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height });
    const intersectionArea = (a: ReturnType<typeof rectObject>, b: ReturnType<typeof rectObject>) => {
      const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return width * height;
    };
    const visible = document.querySelector<HTMLElement>(".ad-scaled > .ad-slide:not([hidden])");
    const stage = document.querySelector<HTMLElement>(".ad-stage");
    const slideRect = visible ? rectObject(visible.getBoundingClientRect()) : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const stageRect = stage ? rectObject(stage.getBoundingClientRect()) : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight };
    const slideArea = Math.max(1, slideRect.width * slideRect.height);
    const stageArea = Math.max(1, stageRect.width * stageRect.height);
    const imageRatios = [...document.querySelectorAll<HTMLImageElement>(".ad-scaled > .ad-slide:not([hidden]) img")]
      .filter((image) => image.naturalWidth > 0 && image.naturalHeight > 0)
      .map((image) => {
        const rect = image.getBoundingClientRect();
        const widthRatio = image.naturalWidth / Math.max(1, rect.width * window.devicePixelRatio);
        const heightRatio = image.naturalHeight / Math.max(1, rect.height * window.devicePixelRatio);
        return Math.min(widthRatio, heightRatio);
      });
    return {
      visibleRatio: intersectionArea(slideRect, stageRect) / slideArea,
      stageCoverageRatio: intersectionArea(slideRect, stageRect) / stageArea,
      imageScaleRatio: imageRatios.length ? Math.min(...imageRatios) : undefined,
    };
  });
  return { index, screenshotBytes, ...metrics };
}

interface ContactSheetLayout {
  columns: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  headerHeight: number;
  labelHeight: number;
  padding: number;
  cellWidth: number;
  cellHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

function contactSheetLayout(count: number, options: ContactSheetOptions): ContactSheetLayout {
  let columns = options.columns || (count > 120 ? 6 : count > 60 ? 5 : 4);
  columns = Math.max(1, Math.min(8, columns));
  let thumbnailWidth = options.thumbnailWidth || (count > 120 ? 180 : 240);
  thumbnailWidth = Math.max(120, Math.min(360, thumbnailWidth));
  let rows = Math.max(1, Math.ceil(count / columns));
  let thumbnailHeight = Math.round(thumbnailWidth * 9 / 16);
  const headerHeight = 56;
  const labelHeight = 26;
  const padding = 14;
  const maxCanvasHeight = 15_000;
  while (headerHeight + rows * (thumbnailHeight + labelHeight + padding) + padding > maxCanvasHeight && columns < 8) {
    columns += 1;
    rows = Math.max(1, Math.ceil(count / columns));
  }
  while (headerHeight + rows * (thumbnailHeight + labelHeight + padding) + padding > maxCanvasHeight && thumbnailWidth > 120) {
    thumbnailWidth -= 20;
    thumbnailHeight = Math.round(thumbnailWidth * 9 / 16);
  }
  const cellWidth = thumbnailWidth + padding;
  const cellHeight = thumbnailHeight + labelHeight + padding;
  return {
    columns,
    thumbnailWidth,
    thumbnailHeight,
    headerHeight,
    labelHeight,
    padding,
    cellWidth,
    cellHeight,
    canvasWidth: columns * cellWidth + padding,
    canvasHeight: headerHeight + rows * cellHeight + padding,
  };
}

async function setupContactSheetCanvas(page: any, slideCount: number, layout: ContactSheetLayout): Promise<void> {
  await page.setContent("<!doctype html><html><body style=\"margin:0;background:#f6f7f9\"><canvas></canvas></body></html>");
  await page.evaluate(({ slideCount, layout }: { slideCount: number; layout: ContactSheetLayout }) => {
    const canvas = document.querySelector("canvas")!;
    canvas.width = layout.canvasWidth;
    canvas.height = layout.canvasHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f6f7f9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#14161a";
    ctx.font = "700 22px Arial, sans-serif";
    ctx.fillText("AgentDeck Verify Contact Sheet", layout.padding, 34);
    ctx.font = "12px Arial, sans-serif";
    ctx.fillStyle = "#5b6472";
    ctx.fillText(`${slideCount} slide(s)`, layout.padding, 51);
  }, { slideCount, layout });
}

async function appendContactSheetSlide(
  page: any,
  dataUrl: string,
  metadata: SlideCaptureMetadata,
  slideCount: number,
  layout: ContactSheetLayout,
): Promise<VerifySlideReview> {
  return await page.evaluate(
    async ({ dataUrl, metadata, slideCount, layout }: {
      dataUrl: string;
      metadata: SlideCaptureMetadata;
      slideCount: number;
      layout: ContactSheetLayout;
    }) => {
      const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Unable to load slide capture"));
        image.src = src;
      });
      const image = await loadImage(dataUrl);
      const canvas = document.querySelector("canvas")!;
      const ctx = canvas.getContext("2d")!;
      const index = metadata.index;
      const col = (index - 1) % layout.columns;
      const row = Math.floor((index - 1) / layout.columns);
      const x = layout.padding + col * layout.cellWidth;
      const y = layout.headerHeight + row * layout.cellHeight;
      const scale = Math.min(layout.thumbnailWidth / image.width, layout.thumbnailHeight / image.height);
      const drawWidth = Math.round(image.width * scale);
      const drawHeight = Math.round(image.height * scale);
      const drawX = x + Math.round((layout.thumbnailWidth - drawWidth) / 2);
      const drawY = y + layout.labelHeight + Math.round((layout.thumbnailHeight - drawHeight) / 2);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y + layout.labelHeight, layout.thumbnailWidth, layout.thumbnailHeight);
      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
      ctx.strokeStyle = "#c8ced8";
      ctx.strokeRect(x + 0.5, y + layout.labelHeight + 0.5, layout.thumbnailWidth - 1, layout.thumbnailHeight - 1);

      const stats = imageStats(image);
      const flags: Array<"blank" | "clipped" | "low-resolution"> = [];
      if (stats.blankScore >= 0.98) flags.push("blank");
      if (metadata.visibleRatio < 0.98) flags.push("clipped");
      if (image.width < 640 || image.height < 360 || (metadata.imageScaleRatio !== undefined && metadata.imageScaleRatio < 0.75)) flags.push("low-resolution");

      ctx.fillStyle = flags.length ? "#9f2d20" : "#25633f";
      ctx.font = "700 12px Arial, sans-serif";
      const status = flags.length ? flags.join(",") : "ok";
      ctx.fillText(`${String(index).padStart(3, "0")}/${slideCount} ${status}`, x, y + 17);

      const review = {
        index,
        screenshotWidth: image.width,
        screenshotHeight: image.height,
        visibleRatio: metadata.visibleRatio,
        stageCoverageRatio: metadata.stageCoverageRatio,
        imageScaleRatio: metadata.imageScaleRatio,
        blankScore: stats.blankScore,
        flags,
      };

      function imageStats(image: HTMLImageElement): { blankScore: number } {
        const probeWidth = 64;
        const probeHeight = Math.max(1, Math.round(probeWidth * image.height / image.width));
        const probe = document.createElement("canvas");
        probe.width = probeWidth;
        probe.height = probeHeight;
        const probeCtx = probe.getContext("2d", { willReadFrequently: true })!;
        probeCtx.drawImage(image, 0, 0, probeWidth, probeHeight);
        const data = probeCtx.getImageData(0, 0, probeWidth, probeHeight).data;
        let mean = 0;
        let pixels = 0;
        for (let i = 0; i < data.length; i += 4) {
          mean += (data[i] + data[i + 1] + data[i + 2]) / 3;
          pixels += 1;
        }
        mean /= Math.max(1, pixels);
        let variance = 0;
        for (let i = 0; i < data.length; i += 4) {
          const value = (data[i] + data[i + 1] + data[i + 2]) / 3;
          variance += (value - mean) ** 2;
        }
        variance /= Math.max(1, pixels);
        const normalizedVariance = Math.min(1, variance / (255 * 255));
        return { blankScore: 1 - Math.min(1, normalizedVariance * 70) };
      }

      return review;
    },
    {
      dataUrl,
      metadata,
      slideCount,
      layout,
    },
  );
}

function formatPageList(pages: number[]): string {
  const first = pages.slice(0, 12).join(", ");
  return pages.length > 12 ? `${first}, +${pages.length - 12} more` : first;
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
