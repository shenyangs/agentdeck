import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, parse, resolve } from "node:path";
import { renderStandaloneHtml, writeStandaloneHtmlFile } from "@agentdeck/runtime";
import { renderPdfToPngPages } from "../converters/pdf.js";
import { scanInputCompatibility } from "../converters/risk-scanner.js";
import { imageOutputOptions, stringFlag, timeoutMsFlag } from "../flags.js";
import { applyImageOutputOptions, prepareRenderedSingleHtmlAssets, renderedFileDeck, writeRenderedPageAssets } from "../output/rendered-file.js";
import {
  AGENTDECK_VERSION,
  REPORT_SCHEMA_VERSION,
  defaultQualitySignals,
  reportEnvironment,
  reportOutput,
  reportSource,
  writeJsonReport,
} from "../reports.js";
import type { CliResult, OfficeConversionBackend, PipelineAttempt } from "../types.js";
import { hasNodeModule } from "../utils/files.js";
import { pageReportEntry, sizeBudgetWarnings } from "../utils/images.js";
import { maybeVerifyWrappedOutput } from "./wrap-shared.js";

export async function commandWrapRenderedFile(
  pdfPath: string,
  options: { positionals: string[]; flags: Record<string, string | boolean> },
  originalSourcePath = pdfPath,
  officeBackend?: OfficeConversionBackend,
  upstreamPipeline: PipelineAttempt[] = [],
): Promise<CliResult> {
  const outDir = resolve(String(options.flags.out ?? "dist"));
  const title = stringFlag(options.flags.title) ?? parse(originalSourcePath).name;
  const dpi = Number(options.flags.dpi ?? 180);
  const imageOptions = imageOutputOptions(options.flags);
  const timeoutMs = timeoutMsFlag(options.flags["timeout-ms"]);
  const tempDir = mkdtempSync(join(tmpdir(), "agentdeck-pages-"));
  try {
    const rendered = renderPdfToPngPages(pdfPath, tempDir, dpi, {
      timeoutMs,
      maxPages: imageOptions.maxPages,
    });
    const pages = await applyImageOutputOptions(rendered.pages, imageOptions);
    const singleHtmlAssets = imageOptions.pack === "single-html" ? prepareRenderedSingleHtmlAssets(pages) : undefined;
    const deckPages = singleHtmlAssets?.pages ?? writeRenderedPageAssets(pages, outDir, imageOptions.pack);
    const totalBytes = pages.reduce((sum, page) => sum + page.bytes, 0);
    const deck = renderedFileDeck(title, originalSourcePath, deckPages, "rendered-file", imageOptions.fit);
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
    const compatibilityScan = scanInputCompatibility(originalSourcePath);
    const sizeWarnings = sizeBudgetWarnings(totalBytes, imageOptions);
    const warnings = [
      ...sizeWarnings,
      ...compatibilityScan.warnings,
    ];
    const assetReport = {
      schemaVersion: REPORT_SCHEMA_VERSION,
      agentdeckVersion: AGENTDECK_VERSION,
      source: reportSource(originalSourcePath, { debug: Boolean(options.flags.debug) }),
      renderedFrom: pdfPath === originalSourcePath ? undefined : reportSource(pdfPath, { debug: Boolean(options.flags.debug) }),
      environment: reportEnvironment([officeBackend, rendered.backend, hasNodeModule("playwright") ? "playwright" : ""].filter(Boolean) as string[]),
      pipeline: [
        ...upstreamPipeline,
        ...rendered.pipeline,
      ],
      output: reportOutput({
        htmlPath: options.flags.debug ? outputPath : "index.html",
        bytes: htmlBytes,
        pageCount: pages.length,
        packMode: imageOptions.pack,
        fidelity: "raster",
      }),
      qualitySignals: {
        ...defaultQualitySignals(warnings),
        oversizedOutput: sizeWarnings.length > 0,
      },
      compatibilityScan,
      fidelity: "raster",
      officeConverterBackend: officeBackend,
      dpi,
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
      rendererBackend: rendered.backend,
      pages: deckPages.map((page) => pageReportEntry(page)),
      warnings,
    };
    writeJsonReport(assetReportPath, assetReport);
    console.log(`Wrapped ${pages.length} rendered page(s) into ${outputPath}`);
    console.log(`Rendered PDF pages with ${rendered.backend}`);
    console.log(`Wrote ${assetReportPath}`);
    const verifyResult = await maybeVerifyWrappedOutput(outputPath, options);
    if (options.flags.json) console.log(JSON.stringify({ assetReport, verify: verifyResult.report }, null, 2));
    return { code: verifyResult.code };
  } finally {
    if (!options.flags["keep-temp"]) rmSync(tempDir, { recursive: true, force: true });
  }
}
