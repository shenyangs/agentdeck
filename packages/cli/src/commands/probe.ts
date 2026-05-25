import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import {
  analyzeHtmlCompatibility,
} from "../converters/html.js";
import { availableOfficeBackends, describeTriedOfficeBackends, recommendedOfficeBackend } from "../converters/office.js";
import { availablePdfRenderBackends } from "./shared-pdf.js";
import { htmlStrategy, officeBackendPreference, parseArgs, stringFlag } from "../flags.js";
import {
  AGENTDECK_VERSION,
  REPORT_SCHEMA_VERSION,
  defaultQualitySignals,
  reportEnvironment,
  reportOutput,
  reportSource,
  writeJsonReport,
} from "../reports.js";
import type { CliResult, HtmlWrapStrategy, OfficeBackendPreference, PipelineAttempt, ProbeReport } from "../types.js";
import { hasNodeModule, resolveInputPath } from "../utils/files.js";

export function commandProbe(args: string[]): CliResult {
  const options = parseArgs(args);
  const file = options.positionals[0];
  if (!file) {
    console.error("Usage: agentdeck probe <input> [--json] [--out probe-report.json]");
    return { code: 2 };
  }
  const sourcePath = resolveInputPath(file);
  const report = probeInput(sourcePath, {
    htmlStrategy: htmlStrategy(options.flags["html-strategy"] ?? options.flags.strategy),
    officeBackend: officeBackendPreference(options.flags["office-backend"]),
    debug: Boolean(options.flags.debug),
  });
  const outPath = stringFlag(options.flags.out);
  if (outPath) {
    const resolvedOut = resolve(outPath);
    mkdirSync(dirname(resolvedOut), { recursive: true });
    writeJsonReport(resolvedOut, report);
  }
  if (options.flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatProbeReport(report));
    if (outPath) console.log(`Wrote ${resolve(outPath)}`);
  }
  return { code: report.inputKind === "unsupported" ? 1 : 0 };
}

export function probeInput(sourcePath: string, options: { htmlStrategy: HtmlWrapStrategy; officeBackend: OfficeBackendPreference; debug?: boolean }): ProbeReport {
  const ext = extname(sourcePath).toLowerCase();
  const exists = existsSync(sourcePath);
  const risks = exists ? [] : [`source file not found: ${sourcePath}`];
  const pdfBackends = availablePdfRenderBackends();
  const source = reportSource(sourcePath, { debug: options.debug });
  const baseBackends = [...pdfBackends, hasNodeModule("playwright") ? "playwright" : ""].filter(Boolean) as string[];
  const environment = reportEnvironment(baseBackends);
  const baseReport = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    agentdeckVersion: AGENTDECK_VERSION,
    source,
    environment,
    pipeline: [] as PipelineAttempt[],
    output: reportOutput({ pageCount: 0, bytes: 0, fidelity: "unknown" }),
    qualitySignals: defaultQualitySignals(risks),
  };

  if (ext === ".html" || ext === ".htm") {
    const html = exists ? readFileSync(sourcePath, "utf8") : "";
    const analysis = analyzeHtmlCompatibility(html);
    const selected = options.htmlStrategy === "auto" ? analysis.recommendedStrategy : options.htmlStrategy;
    return {
      ...baseReport,
      inputKind: "html",
      recommendedRoute: `wrap-html:${selected}`,
      confidence: analysis.confidence,
      availableBackends: ["chromium"],
      missingDependencies: hasNodeModule("playwright") ? [] : ["playwright"],
      risks: [
        ...risks,
        ...(selected === "raster" ? ["raster HTML preserves visual layout but removes source DOM interactivity"] : []),
      ],
      html: {
        requestedStrategy: options.htmlStrategy,
        recommendedStrategy: analysis.recommendedStrategy,
        signals: analysis.signals,
        reasons: analysis.reasons,
      },
    };
  }

  if (ext === ".pdf") {
    return {
      ...baseReport,
      inputKind: "pdf",
      recommendedRoute: "pdf->page-images->single-html",
      confidence: pdfBackends.length ? 0.92 : 0.2,
      availableBackends: pdfBackends,
      missingDependencies: pdfBackends.length ? [] : ["pdftoppm or pdftocairo or python module pypdfium2/pdf2image"],
      risks,
      pdf: { availableRenderers: pdfBackends },
    };
  }

  if ([".ppt", ".pptx", ".doc", ".docx", ".xls", ".xlsx", ".key"].includes(ext)) {
    const officeBackends = availableOfficeBackends(ext);
    const recommended = options.officeBackend === "auto" ? recommendedOfficeBackend(ext, officeBackends) : options.officeBackend;
    return {
      ...baseReport,
      environment: reportEnvironment([...officeBackends, ...baseBackends]),
      inputKind: "office",
      recommendedRoute: recommended ? `${recommended}->pdf->page-images->single-html` : "office->pdf unavailable",
      confidence: recommended ? 0.84 : 0.18,
      availableBackends: [...officeBackends, ...pdfBackends],
      missingDependencies: [
        ...(!officeBackends.length ? ["LibreOffice, Keynote/Quick Look on macOS, or Microsoft Office COM on Windows"] : []),
        ...(!pdfBackends.length ? ["PDF renderer: pdftoppm, pdftocairo, pypdfium2, or pdf2image"] : []),
      ],
      risks: [
        ...risks,
        ...(recommended ? [] : ["no Office to PDF backend is currently available"]),
        ...(options.officeBackend !== "auto" && !officeBackends.includes(options.officeBackend) ? [`forced backend is unavailable: ${options.officeBackend}`] : []),
      ],
      office: {
        extension: ext,
        recommendedBackend: recommended,
        availableBackends: officeBackends,
        triedBackends: describeTriedOfficeBackends(ext),
      },
      pdf: { availableRenderers: pdfBackends },
    };
  }

  if (ext === ".md") {
    return {
      ...baseReport,
      inputKind: "markdown",
      recommendedRoute: "markdown->agentdeck-build->single-html",
      confidence: 0.9,
      availableBackends: ["agentdeck markdown parser"],
      missingDependencies: [],
      risks,
    };
  }

  return {
    ...baseReport,
    inputKind: "unsupported",
    recommendedRoute: "unsupported",
    confidence: 0,
    availableBackends: [],
    missingDependencies: [],
    risks: [...risks, `unsupported extension: ${ext || basename(sourcePath)}`],
  };
}

export function formatProbeReport(report: ProbeReport): string {
  const lines = [
    `Input: ${report.source.path}${report.source.redacted ? " (path redacted)" : ""}`,
    `Kind: ${report.inputKind}`,
    `Recommended route: ${report.recommendedRoute}`,
    `Confidence: ${Math.round(report.confidence * 100)}%`,
    `Available backends: ${report.availableBackends.length ? report.availableBackends.join(", ") : "none"}`,
  ];
  if (report.missingDependencies.length) lines.push(`Missing dependencies: ${report.missingDependencies.join(", ")}`);
  if (report.risks.length) lines.push(`Risks: ${report.risks.join("; ")}`);
  if (report.html) lines.push(`HTML strategy: ${report.html.recommendedStrategy} (${report.html.reasons.slice(0, 3).join("; ")})`);
  if (report.office) lines.push(`Office backend: ${report.office.recommendedBackend ?? "none"} (available: ${report.office.availableBackends.join(", ") || "none"})`);
  return lines.join("\n");
}
