import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { importExternalHtmlDeck } from "@agentdeck/compat-profiles";
import { renderStandaloneHtml } from "@agentdeck/runtime";
import { htmlDomFallbackReason, writeHtmlCompatibilityReport } from "../converters/html.js";
import { stringFlag } from "../flags.js";
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
import type { CliResult, HtmlCompatibilityAnalysis, HtmlWrapStrategy } from "../types.js";
import { resolveHtmlAsset } from "../utils/files.js";
import { printDiagnostics } from "./build.js";
import { maybeVerifyWrappedOutput } from "./wrap-shared.js";

export async function wrapHtmlDom(params: {
  file: string;
  htmlPath: string;
  htmlSource: string;
  options: { positionals: string[]; flags: Record<string, string | boolean> };
  analysis: HtmlCompatibilityAnalysis;
  requestedStrategy: HtmlWrapStrategy;
  selectedStrategy: Exclude<HtmlWrapStrategy, "auto">;
  fallback: (analysis: HtmlCompatibilityAnalysis, reason: string) => Promise<CliResult>;
}): Promise<CliResult> {
  const { file, htmlPath, htmlSource, options, analysis, requestedStrategy, selectedStrategy, fallback } = params;
  const outDir = resolve(String(options.flags.out ?? "dist"));
  const sourceDir = dirname(htmlPath);
  const assetEntries: Array<{ src: string; resolved?: string; bytes?: number; inlined: boolean; warning?: string }> = [];
  const imported = importExternalHtmlDeck(htmlSource, {
    sourceName: file,
    title: stringFlag(options.flags.title),
    assetResolver: (src) => resolveHtmlAsset(src, sourceDir, assetEntries),
  });

  const fallbackReason = htmlDomFallbackReason(imported, analysis);
  if (requestedStrategy === "auto" && fallbackReason) {
    console.log(`DOM wrap looked risky after extraction; switching to raster (${fallbackReason}).`);
    return fallback({
      ...analysis,
      recommendedStrategy: "raster",
      confidence: Math.max(analysis.confidence, 0.82),
      reasons: [...analysis.reasons, fallbackReason],
    }, fallbackReason);
  }

  mkdirSync(outDir, { recursive: true });
  const outputHtml = renderStandaloneHtml(imported.deck, {
    includeSourceJson: false,
    mode: "audience",
    profile: "external-html",
  });
  const outputPath = join(outDir, "index.html");
  const assetReportPath = join(outDir, "asset-report.json");
  writeFileSync(outputPath, outputHtml, "utf8");
  const htmlBytes = statSync(outputPath).size;
  const assetReport = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    agentdeckVersion: AGENTDECK_VERSION,
    source: reportSource(htmlPath, { debug: Boolean(options.flags.debug) }),
    sourceKind: "html",
    environment: reportEnvironment(["dom-import"]),
    pipeline: [pipelineAttempt({ step: "html-to-dom", backend: "generic-dom-import", status: imported.warnings.some((diagnostic) => diagnostic.level === "error") ? "failed" : "success", message: `${imported.slideCount} slide(s)` })],
    output: reportOutput({
      htmlPath: options.flags.debug ? outputPath : "index.html",
      bytes: htmlBytes,
      pageCount: imported.slideCount,
      packMode: "single-html",
      fidelity: "dom",
    }),
    qualitySignals: defaultQualitySignals(imported.warnings.map((diagnostic) => diagnostic.message)),
    assets: assetEntries,
  };
  writeJsonReport(assetReportPath, assetReport);
  const compatReportPath = writeHtmlCompatibilityReport(outDir, {
    schemaVersion: REPORT_SCHEMA_VERSION,
    agentdeckVersion: AGENTDECK_VERSION,
    source: reportSource(htmlPath, { debug: Boolean(options.flags.debug) }),
    sourceKind: "html",
    requestedStrategy,
    selectedStrategy,
    analysis,
    adapterId: "generic-dom-import",
    pipeline: assetReport.pipeline,
    output: assetReport.output,
    qualitySignals: assetReport.qualitySignals,
    wrappedSlides: imported.slideCount,
    fallbackUsed: imported.warnings.some((diagnostic) => diagnostic.code === "compat.external_html.slides.fallback"),
  });
  console.log(`Wrapped ${imported.slideCount} slide(s) into ${outputPath}`);
  console.log(`Wrote ${assetReportPath}`);
  console.log(`Wrote ${compatReportPath}`);
  if (imported.warnings.length) printDiagnostics(imported.warnings);
  const verifyResult = await maybeVerifyWrappedOutput(outputPath, options);
  if (options.flags.json) console.log(JSON.stringify({ assetReport, verify: verifyResult.report }, null, 2));
  return { code: imported.warnings.some((diagnostic) => diagnostic.level === "error") ? 1 : verifyResult.code };
}
