import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join, parse, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderStandaloneHtml, writeStandaloneHtmlFile } from "@agentdeck/runtime";
import {
  analyzeHtmlCompatibility,
  chooseHtmlCaptureStrategy,
  detectHtmlDeckAdapter,
  htmlTitle,
  installLocalOnlyNetworkPolicy,
  navigateHtmlCapturePage,
  viewportFlag,
  writeHtmlCompatibilityReport,
} from "../converters/html.js";
import { imageOutputOptions, stringFlag } from "../flags.js";
import { applyImageOutputOptions, prepareRenderedSingleHtmlAssets, renderedFileDeck, writeRenderedPageAssets } from "../output/rendered-file.js";
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
import type {
  CapturePageStatus,
  CliResult,
  CompatibilityScan,
  HtmlCaptureStrategy,
  HtmlCompatibilityAnalysis,
  HtmlWrapStrategy,
  PipelineAttempt,
  RenderedPage,
} from "../types.js";
import { pageReportEntry, sizeBudgetWarnings } from "../utils/images.js";
import { maybeVerifyWrappedOutput } from "./wrap-shared.js";

export async function wrapHtmlRaster(
  htmlPath: string,
  htmlSource: string,
  options: { positionals: string[]; flags: Record<string, string | boolean> },
  analysis: HtmlCompatibilityAnalysis = analyzeHtmlCompatibility(htmlSource),
  requestedStrategy: HtmlWrapStrategy = "auto",
  fallbackReason?: string,
  compatibilityScan?: CompatibilityScan,
): Promise<CliResult> {
  const outDir = resolve(String(options.flags.out ?? "dist"));
  const title = stringFlag(options.flags.title) ?? htmlTitle(htmlSource) ?? parse(htmlPath).name;
  const viewport = viewportFlag(options.flags.viewport);
  const settleMs = Number(options.flags["settle-ms"] ?? 900);
  const imageOptions = imageOutputOptions(options.flags);
  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  if (!options.flags["allow-network"]) await installLocalOnlyNetworkPolicy(page);
  let pages: RenderedPage[] = [];
  const capturePages: CapturePageStatus[] = [];
  const sourceUrl = pathToFileURL(htmlPath).toString();
  let captureStrategy: HtmlCaptureStrategy = "hash";
  let adapterId = "generic-section";
  const pipeline: PipelineAttempt[] = [];
  const startedAt = Date.now();

  try {
    await page.goto(sourceUrl, { waitUntil: "load" });
    const browserDetectedCount = await page.evaluate(() => {
      const selectors = ["#deck .slide", ".slide", ".ppt-slide", ".swiper-slide", "[data-slide]", ".page", "section"];
      for (const selector of selectors) {
        const found = document.querySelectorAll(selector).length;
        if (found > 1) return found;
      }
      return 1;
    });
    const count = Math.min(imageOptions.maxPages ?? Number.POSITIVE_INFINITY, Math.max(browserDetectedCount, analysis.signals.detectedSlideCount));
    adapterId = await detectHtmlDeckAdapter(page);
    captureStrategy = await chooseHtmlCaptureStrategy(page, sourceUrl, count, settleMs);

    for (let index = 0; index < count; index += 1) {
      await navigateHtmlCapturePage(page, sourceUrl, index, captureStrategy, settleMs);
      await page.addStyleTag({
        content: `body.agentdeck-raster-capture #nav,
body.agentdeck-raster-capture #hint,
body.agentdeck-raster-capture #overview,
body.agentdeck-raster-capture .deck-controls,
body.agentdeck-raster-capture .presenter-controls{display:none!important}`,
      });
      await page.evaluate((slideIndex: number) => {
        document.body.classList.add("agentdeck-raster-capture");
        const selectors = ["#deck .slide", ".slide", ".ppt-slide", ".swiper-slide", "[data-slide]", ".page", "section"];
        const slides = selectors
          .map((selector) => [...document.querySelectorAll<HTMLElement>(selector)])
          .find((items) => items.length > 1) ?? [];
        const slide = slides[slideIndex];
        const deck = document.querySelector<HTMLElement>("#deck") ?? slide?.parentElement;
        if (deck && slide && slides.length > 1) {
          const deckRect = deck.getBoundingClientRect();
          const deckStyle = window.getComputedStyle(deck);
          const looksHorizontal = deck.id === "deck" || deckRect.width > window.innerWidth * 1.8 || deckStyle.display.includes("flex");
          if (looksHorizontal) {
            deck.style.transition = "none";
            deck.style.transform = `translateX(${-slideIndex * 100}vw)`;
          }
          (window as any).__currentSlideIndex = slideIndex;
          document.querySelectorAll("#nav .dot").forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === slideIndex));
          slide.scrollIntoView({ block: "nearest", inline: "nearest" });
          slide.classList.add("active", "is-active", "current", "is-current");
          slide.removeAttribute("hidden");
        }
      }, index);
      await page.waitForTimeout(settleMs);
      const png = await page.screenshot({ type: "png", fullPage: false });
      capturePages.push({ index: index + 1, success: png.byteLength > 0 });
      pages.push({
        index: index + 1,
        src: `data:image/png;base64,${Buffer.from(png).toString("base64")}`,
        bytes: png.byteLength,
        sourceWidth: viewport.width,
        sourceHeight: viewport.height,
        outputWidth: viewport.width,
        outputHeight: viewport.height,
        format: "png",
        mime: "image/png",
      });
    }
    pipeline.push(pipelineAttempt({ step: "html-to-pages", backend: `playwright:${adapterId}:${captureStrategy}`, status: "success", durationMs: Date.now() - startedAt, message: `${pages.length} page(s)` }));
  } finally {
    await browser.close();
  }

  pages = await applyImageOutputOptions(pages, imageOptions);
  const singleHtmlAssets = imageOptions.pack === "single-html" ? prepareRenderedSingleHtmlAssets(pages) : undefined;
  const deckPages = singleHtmlAssets?.pages ?? writeRenderedPageAssets(pages, outDir, imageOptions.pack);
  const totalBytes = pages.reduce((sum, page) => sum + page.bytes, 0);
  const deck = renderedFileDeck(title, htmlPath, deckPages, "html-raster", imageOptions.fit);
  mkdirSync(outDir, { recursive: true });
  const outputPath = join(outDir, "index.html");
  const assetReportPath = join(outDir, "asset-report.json");
  const renderOptions = {
    embeddedAssets: singleHtmlAssets?.embeddedAssets,
    includeSourceJson: false,
    mode: "audience" as const,
    profile: "rendered-file",
  };
  if (singleHtmlAssets) {
    await writeStandaloneHtmlFile(deck, outputPath, renderOptions);
  } else {
    const outputHtml = renderStandaloneHtml(deck, renderOptions);
    writeFileSync(outputPath, outputHtml, "utf8");
  }
  const htmlBytes = statSync(outputPath).size;
  const sizeWarnings = sizeBudgetWarnings(totalBytes, imageOptions);
  const warnings = [
    ...sizeWarnings,
    ...(compatibilityScan?.warnings ?? []),
  ];
  const compatReportPath = writeHtmlCompatibilityReport(outDir, {
    schemaVersion: REPORT_SCHEMA_VERSION,
    agentdeckVersion: AGENTDECK_VERSION,
    source: reportSource(htmlPath, { debug: Boolean(options.flags.debug) }),
    sourceKind: "html",
    requestedStrategy,
    selectedStrategy: "raster",
    analysis,
    adapterId,
    captureStrategy,
    capturePages,
    pipeline,
    output: reportOutput({
      htmlPath: options.flags.debug ? outputPath : "index.html",
      bytes: htmlBytes,
      pageCount: pages.length,
      packMode: imageOptions.pack,
      fidelity: "raster-html",
    }),
    qualitySignals: {
      ...defaultQualitySignals(warnings),
      oversizedOutput: sizeWarnings.length > 0,
    },
    compatibilityScan,
    wrappedSlides: pages.length,
    fallbackUsed: Boolean(fallbackReason),
    fallbackReason,
  });
  const assetReport = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    agentdeckVersion: AGENTDECK_VERSION,
    source: reportSource(htmlPath, { debug: Boolean(options.flags.debug) }),
    sourceKind: "html",
    environment: reportEnvironment(["playwright"]),
    pipeline,
    output: reportOutput({
      htmlPath: options.flags.debug ? outputPath : "index.html",
      bytes: htmlBytes,
      pageCount: pages.length,
      packMode: imageOptions.pack,
      fidelity: "raster-html",
    }),
    qualitySignals: {
      ...defaultQualitySignals(warnings),
      oversizedOutput: sizeWarnings.length > 0,
    },
    compatibilityScan,
    fidelity: "raster-html",
    requestedStrategy,
    selectedStrategy: "raster",
    analysis,
    adapterId,
    captureStrategy,
    viewport,
    fit: imageOptions.fit,
    imageFormat: imageOptions.format,
    quality: imageOptions.format === "png" ? undefined : imageOptions.quality,
    maxWidth: imageOptions.maxWidth,
    maxPages: imageOptions.maxPages,
    maxOutputBytes: imageOptions.maxOutputBytes,
    sizeBudgetBytes: imageOptions.sizeBudgetBytes,
    packMode: imageOptions.pack,
    thumbnailDpi: imageOptions.thumbnailDpi,
    totalBytes,
    pages: deckPages.map((page) => pageReportEntry(page)),
    warnings,
  };
  writeJsonReport(assetReportPath, assetReport);
  console.log(`Raster-wrapped ${pages.length} HTML page(s) into ${outputPath}`);
  console.log(`Wrote ${assetReportPath}`);
  console.log(`Wrote ${compatReportPath}`);
  const verifyResult = await maybeVerifyWrappedOutput(outputPath, options);
  if (options.flags.json) console.log(JSON.stringify({ assetReport, verify: verifyResult.report }, null, 2));
  return { code: verifyResult.code };
}
