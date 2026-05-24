#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, parse, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { importExternalHtmlDeck } from "@agentdeck/compat-profiles";
import { renderStandaloneHtml } from "@agentdeck/runtime";
import {
  formatDiagnostics,
  hasErrors,
  parseDeckMarkdown,
  validateDeck,
  type DeckDocument,
  type Diagnostic,
} from "@agentdeck/schema";
import { layoutRegistry } from "@agentdeck/themes";
import {
  analyzeHtmlCompatibility,
  chooseHtmlCaptureStrategy,
  detectHtmlDeckAdapter,
  formatHtmlStrategyDecision,
  htmlDomFallbackReason,
  htmlTitle,
  installLocalOnlyNetworkPolicy,
  navigateHtmlCapturePage,
  viewportFlag,
  writeHtmlCompatibilityReport,
} from "./converters/html.js";
import { renderPdfToPngPages } from "./converters/pdf.js";
import { findCommand } from "./process/find-command.js";
import { commandErrorMessage, commandOutput, runCommand } from "./process/run-command.js";
import {
  AGENTDECK_VERSION,
  REPORT_SCHEMA_VERSION,
  defaultQualitySignals,
  pipelineAttempt,
  reportEnvironment,
  reportOutput,
  reportSource,
  writeJsonReport,
} from "./reports.js";
import type {
  BuildResult,
  CapturePageStatus,
  CliResult,
  FitMode,
  HtmlCaptureStrategy,
  HtmlCompatibilityAnalysis,
  HtmlCompatibilityReport,
  HtmlWrapStrategy,
  ImageFormat,
  ImageOutputOptions,
  OfficeBackendPreference,
  OfficeConversionBackend,
  OfficeConversionResult,
  PackMode,
  PdfRenderBackend,
  PdfRenderResult,
  PipelineAttempt,
  ProbeReport,
  RenderedPage,
  VerifyIssue,
  VerifyReport,
} from "./types.js";

const help = `AgentDeck

Usage:
  agentdeck init [dir] [--theme editorial|swiss|launch|course]
  agentdeck dev [deck.md]
  agentdeck build [deck.md] [--out dist] [--single-html] [--mode audience|presenter|creator] [--profile agentdeck|external-html|rendered-file]
  agentdeck export [deck.md] [--pdf] [--png] [--long-image] [--grid9] [--social-pack] [--out dist]
  agentdeck probe <input> [--json] [--out probe-report.json]
  agentdeck verify <dist/index.html> [--out verify-report.json]
  agentdeck wrap <deck.html|deck.pdf|deck.ppt|deck.pptx|deck.doc|deck.docx|deck.xls|deck.xlsx|deck.key> [--out dist] [--title "Deck title"] [--dpi 180] [--fit contain|width|height|cover] [--image-format png|jpeg|webp] [--quality 82] [--max-width 1600] [--max-pages 100] [--max-output-mb 50] [--size-budget 50mb] [--pack single-html|folder] [--thumbnail-dpi 40] [--html-strategy auto|dom|raster] [--allow-network] [--no-verify] [--json] [--timeout-ms 120000] [--office-backend auto|libreoffice|keynote|quicklook-preview|windows-powerpoint|windows-word|windows-excel]
  agentdeck wrap-html <index.html> [--out dist] [--title "Deck title"] [--html-strategy auto|dom|raster] [--fit contain|width|height|cover] [--image-format png|jpeg|webp] [--quality 82] [--max-width 1600] [--max-pages 100] [--max-output-mb 50] [--size-budget 50mb] [--pack single-html|folder] [--thumbnail-dpi 40] [--allow-network] [--no-verify] [--json]
  agentdeck lint [deck.md]
  agentdeck doctor [--json] [--input file]
`;

export async function runCli(argv = process.argv.slice(2)): Promise<CliResult> {
  const [command, ...rest] = argv;

  try {
    if (!command || command === "--help" || command === "-h") {
      console.log(help);
      return { code: 0 };
    }
    if (command === "init") return commandInit(rest);
    if (command === "lint") return commandLint(rest);
    if (command === "build") return commandBuild(rest);
    if (command === "export") return commandExport(rest);
    if (command === "probe") return commandProbe(rest);
    if (command === "verify") return commandVerify(rest);
    if (command === "wrap") return commandWrap(rest);
    if (command === "wrap-html") return commandWrapHtml(rest);
    if (command === "dev") return commandDev(rest);
    if (command === "doctor") return commandDoctor(rest);

    console.error(`Unknown command: ${command}\n`);
    console.error(help);
    return { code: 2 };
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return { code: 1 };
  }
}

function commandProbe(args: string[]): CliResult {
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

async function commandVerify(args: string[]): Promise<CliResult> {
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

async function commandWrap(args: string[]): Promise<CliResult> {
  const options = parseArgs(args);
  const file = options.positionals[0];
  if (!file) {
    console.error('Usage: agentdeck wrap <deck.html|deck.pdf|deck.ppt|deck.pptx|deck.doc|deck.docx|deck.xls|deck.xlsx|deck.key> [--out dist] [--title "Deck title"] [--dpi 180] [--html-strategy auto|dom|raster] [--office-backend auto|libreoffice|keynote|quicklook-preview|windows-powerpoint|windows-word|windows-excel]');
    return { code: 2 };
  }
  const sourcePath = resolveInputPath(file);
  const ext = extname(sourcePath).toLowerCase();
  const officeBackend = officeBackendPreference(options.flags["office-backend"]);
  if (ext === ".html" || ext === ".htm") return commandWrapHtml(args);
  if (ext === ".pdf") return commandWrapRenderedFile(sourcePath, options);
  if ([".ppt", ".pptx", ".doc", ".docx", ".xls", ".xlsx", ".key"].includes(ext)) {
    const tempDir = mkdtempSync(join(tmpdir(), "agentdeck-office-"));
    try {
      const converted = await convertOfficeToPdf(sourcePath, tempDir, officeBackend, {
        timeoutMs: timeoutMsFlag(options.flags["timeout-ms"], 180_000),
      });
      return commandWrapRenderedFile(converted.pdfPath, options, sourcePath, converted.backend, converted.pipeline);
    } finally {
      if (!options.flags["keep-temp"]) rmSync(tempDir, { recursive: true, force: true });
    }
  }
  console.error(`Unsupported input for wrap: ${ext || basename(sourcePath)}. Use HTML, PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX, or KEY.`);
  return { code: 2 };
}

async function commandWrapHtml(args: string[]): Promise<CliResult> {
  const options = parseArgs(args);
  const file = options.positionals[0];
  if (!file) {
    console.error('Usage: agentdeck wrap-html <index.html> [--out dist] [--title "Deck title"] [--html-strategy auto|dom|raster] [--fit contain|width|height|cover] [--image-format png|jpeg|webp] [--quality 82] [--max-width 1600] [--size-budget 50mb]');
    return { code: 2 };
  }
  const htmlPath = resolveInputPath(file);
  const htmlSource = readFileSync(htmlPath, "utf8");
  const requestedStrategy = htmlStrategy(options.flags["html-strategy"] ?? options.flags.strategy);
  const analysis = analyzeHtmlCompatibility(htmlSource);
  const selectedStrategy: Exclude<HtmlWrapStrategy, "auto"> = requestedStrategy === "auto" ? analysis.recommendedStrategy : requestedStrategy;
  console.log(formatHtmlStrategyDecision(requestedStrategy, selectedStrategy, analysis));
  if (selectedStrategy === "raster") {
    return commandWrapHtmlRaster(htmlPath, htmlSource, options, analysis, requestedStrategy);
  }

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
    return commandWrapHtmlRaster(htmlPath, htmlSource, options, {
      ...analysis,
      recommendedStrategy: "raster",
      confidence: Math.max(analysis.confidence, 0.82),
      reasons: [...analysis.reasons, fallbackReason],
    }, requestedStrategy, fallbackReason);
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

async function commandWrapHtmlRaster(
  htmlPath: string,
  htmlSource: string,
  options: { positionals: string[]; flags: Record<string, string | boolean> },
  analysis = analyzeHtmlCompatibility(htmlSource),
  requestedStrategy: HtmlWrapStrategy = "auto",
  fallbackReason?: string,
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
  const deckPages = writeRenderedPageAssets(pages, outDir, imageOptions.pack);
  const totalBytes = pages.reduce((sum, page) => sum + page.bytes, 0);
  const deck = renderedFileDeck(title, htmlPath, deckPages, "html-raster", imageOptions.fit);
  mkdirSync(outDir, { recursive: true });
  const outputHtml = renderStandaloneHtml(deck, {
    includeSourceJson: false,
    mode: "audience",
    profile: "rendered-file",
  });
  const outputPath = join(outDir, "index.html");
  const assetReportPath = join(outDir, "asset-report.json");
  writeFileSync(outputPath, outputHtml, "utf8");
  const htmlBytes = statSync(outputPath).size;
  const warnings = sizeBudgetWarnings(totalBytes, imageOptions);
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
      oversizedOutput: warnings.length > 0,
    },
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
      oversizedOutput: warnings.length > 0,
    },
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

function commandInit(args: string[]): CliResult {
  const options = parseArgs(args);
  const dir = resolve(options.positionals[0] ?? ".");
  const theme = String(options.flags.theme ?? "editorial");
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "assets"), { recursive: true });
  const deckPath = join(dir, "deck.md");
  if (existsSync(deckPath) && !options.flags.force) {
    throw new Error(`${deckPath} already exists. Pass --force to overwrite.`);
  }
  writeFileSync(deckPath, starterDeck(theme), "utf8");
  console.log(`Created ${deckPath}`);
  return { code: 0 };
}

function commandLint(args: string[]): CliResult {
  const deck = loadDeck(args[0] ?? "deck.md");
  const diagnostics = validateDeck(deck, layoutRegistry);
  printDiagnostics(diagnostics);
  return { code: hasErrors(diagnostics) ? 1 : 0 };
}

function commandBuild(args: string[]): CliResult {
  const options = parseArgs(args);
  const deckPath = options.positionals[0] ?? "deck.md";
  const outDir = resolve(String(options.flags.out ?? "dist"));
  const result = buildDeck(deckPath, outDir, Boolean(options.flags["single-html"] ?? true), {
    mode: stringFlag(options.flags.mode),
    profile: stringFlag(options.flags.profile),
  });
  console.log(`Built ${result.htmlPath}`);
  console.log(`Wrote ${result.assetReportPath}`);
  return { code: 0 };
}

async function commandExport(args: string[]): Promise<CliResult> {
  const options = parseArgs(args);
  const deckPath = options.positionals[0] ?? "deck.md";
  const outDir = resolve(String(options.flags.out ?? "dist"));
  const build = buildDeck(deckPath, outDir, true, {});
  const wanted = {
    pdf: Boolean(options.flags.pdf),
    png: Boolean(options.flags.png),
    longImage: Boolean(options.flags["long-image"]),
    grid9: Boolean(options.flags.grid9),
    socialPack: Boolean(options.flags["social-pack"]),
  };
  if (!wanted.pdf && !wanted.png && !wanted.longImage && !wanted.grid9 && !wanted.socialPack) {
    wanted.pdf = true;
    wanted.png = true;
  }

  await exportWithPlaywright(build, outDir, wanted);
  return { code: 0 };
}

function commandDev(args: string[]): CliResult {
  const deckPath = resolve(args[0] ?? "deck.md");
  const deck = loadDeck(deckPath);
  const cacheDir = resolve(".agentdeck/dev");
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(join(cacheDir, "deck.json"), JSON.stringify(deck, null, 2), "utf8");
  writeFileSync(
    join(cacheDir, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(deck.meta.title)}</title></head><body><div id="root"></div><script>window.__AGENTDECK_DECK__=${JSON.stringify(deck)}</script><script type="module" src="/main.tsx"></script></body></html>`,
    "utf8",
  );
  writeFileSync(
    join(cacheDir, "main.tsx"),
    `import "@agentdeck/runtime/styles.css";\nimport "@agentdeck/runtime/render";\n`,
    "utf8",
  );
  console.log("Starting Vite preview for AgentDeck...");
  const child = spawn("npx", ["vite", "--host", "0.0.0.0", cacheDir], { stdio: "inherit" });
  child.on("exit", (code) => {
    process.exitCode = code ?? 0;
  });
  return { code: 0 };
}

function commandDoctor(args: string[] = []): CliResult {
  const options = parseArgs(args);
  const input = stringFlag(options.flags.input) ?? options.positionals[0];
  const office = findCommand(["/Applications/LibreOffice.app/Contents/MacOS/soffice", "soffice", "libreoffice"]);
  const pdfRenderers = describePdfRenderers();
  const nativeOffice = describeNativeOfficeFallbacks();
  const inputExt = input ? extname(resolveInputPath(input)).toLowerCase() : "";
  const availableBackends = [
    ...(inputExt ? availableOfficeBackends(inputExt) : availableOfficeBackends(".pptx")),
    ...availablePdfRenderBackends(),
    hasNodeModule("playwright") ? "playwright" : "",
  ].filter(Boolean);
  const checks = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    agentdeckVersion: AGENTDECK_VERSION,
    environment: reportEnvironment(availableBackends),
    input: input ? reportSource(resolveInputPath(input), { debug: Boolean(options.flags.debug) }) : undefined,
    required: {
      node: { status: "ok", message: process.version },
      cli: { status: "ok", message: "AgentDeck CLI loaded" },
    },
    neededForInput: {
      officeConverter: office ? { status: inspectOfficeInstallation(office) ? "warn" : "ok", message: describeOfficeConverter(office) } : { status: "missing", message: "not found; Office wrap needs LibreOffice, native macOS fallback, or Windows Office COM" },
      nativeOfficeFallbacks: { status: nativeOffice === "none detected" ? "missing" : "ok", message: nativeOffice },
      pdfRenderers: { status: availablePdfRenderBackends().length ? "ok" : "missing", message: pdfRenderers },
    },
    optional: {
      playwright: { status: hasNodeModule("playwright") ? "ok" : "missing", message: hasNodeModule("playwright") ? "available" : "not installed; export/verify/raster need it" },
    },
    risk: {
      windowsOfficeCom: { status: process.platform === "win32" ? "experimental" : "not-applicable", message: "Windows Office COM is wired but requires Windows + desktop Office verification." },
    },
  };
  if (options.flags.json) {
    console.log(JSON.stringify(checks, null, 2));
    return { code: 0 };
  }
  console.log(`Node: ${checks.required.node.message}`);
  console.log(`Working directory: ${process.cwd()}`);
  console.log(`Office converter: ${checks.neededForInput.officeConverter.message}`);
  console.log(`Native Office fallbacks: ${checks.neededForInput.nativeOfficeFallbacks.message}`);
  console.log(`PDF renderers: ${checks.neededForInput.pdfRenderers.message}`);
  console.log(`Playwright: ${checks.optional.playwright.message}`);
  console.log(`Windows Office COM: ${checks.risk.windowsOfficeCom.message}`);
  return { code: 0 };
}

function probeInput(sourcePath: string, options: { htmlStrategy: HtmlWrapStrategy; officeBackend: OfficeBackendPreference; debug?: boolean }): ProbeReport {
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

function formatProbeReport(report: ProbeReport): string {
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

async function verifyStandaloneHtml(htmlPath: string, options: { debug?: boolean } = {}): Promise<VerifyReport> {
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

function formatVerifyReport(report: VerifyReport): string {
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

function describeOfficeConverter(commandPath: string): string {
  const installationIssue = inspectOfficeInstallation(commandPath);
  if (installationIssue) return `${commandPath} (${installationIssue})`;
  const probe = spawnSync(commandPath, ["--version"], { encoding: "utf8", timeout: 5_000 });
  if (probe.error) return `${commandPath} (${probe.error.message.includes("ETIMEDOUT") ? "version check timed out" : `version check failed: ${probe.error.message}`})`;
  const output = `${probe.stdout || ""}${probe.stderr || ""}`.trim();
  return output ? `${commandPath} (${output.split(/\r?\n/)[0]})` : `${commandPath} (found; version output unavailable)`;
}

function describePdfRenderers(): string {
  const backends = availablePdfRenderBackends().map((backend) => {
    if (backend === "pdftoppm") {
      const command = findCommand(["pdftoppm"]);
      return `pdftoppm (${command ? describeCommandVersion(command, ["-v"]) : "unavailable"})`;
    }
    if (backend === "pdftocairo") {
      const command = findCommand(["pdftocairo"]);
      return `pdftocairo (${command ? describeCommandVersion(command, ["-v"]) : "unavailable"})`;
    }
    const python = findCommand(["python3"]);
    return `${backend} via ${python ?? "python3"}`;
  });
  return backends.length ? backends.join("; ") : "none found; PDF wrapping needs poppler or Python PDF fallback";
}

function availablePdfRenderBackends(): PdfRenderBackend[] {
  const backends: PdfRenderBackend[] = [];
  const pdftoppm = findCommand(["pdftoppm"]);
  if (pdftoppm) backends.push("pdftoppm");
  const pdftocairo = findCommand(["pdftocairo"]);
  if (pdftocairo) backends.push("pdftocairo");
  const python = findCommand(["python3"]);
  if (python && pythonModuleAvailable(python, "pypdfium2")) backends.push("pypdfium2");
  if (python && pythonModuleAvailable(python, "pdf2image")) backends.push("pdf2image");
  return backends;
}

function availableOfficeBackends(ext: string): OfficeConversionBackend[] {
  const backends: OfficeConversionBackend[] = [];
  const converter = findCommand(["/Applications/LibreOffice.app/Contents/MacOS/soffice", "soffice", "libreoffice"]);
  if (converter && !inspectOfficeInstallation(converter)) backends.push("libreoffice");
  if (process.platform === "darwin" && [".ppt", ".pptx", ".key"].includes(ext) && keynoteAvailable()) backends.push("keynote");
  if (process.platform === "darwin" && [".doc", ".docx", ".xls", ".xlsx"].includes(ext) && quickLookPreviewAvailable()) backends.push("quicklook-preview");
  if (process.platform === "win32") {
    const windowsBackend = windowsOfficeBackendForExtension(ext);
    if (windowsBackend) backends.push(windowsBackend);
  }
  return backends;
}

function recommendedOfficeBackend(ext: string, available: OfficeConversionBackend[]): OfficeConversionBackend | undefined {
  if (available.includes("libreoffice")) return "libreoffice";
  if ([".ppt", ".pptx", ".key"].includes(ext) && available.includes("keynote")) return "keynote";
  if ([".doc", ".docx", ".xls", ".xlsx"].includes(ext) && available.includes("quicklook-preview")) return "quicklook-preview";
  return available[0];
}

function describeCommandVersion(commandPath: string, args: string[]): string {
  const probe = spawnSync(commandPath, args, { encoding: "utf8", timeout: 5_000 });
  if (probe.error) return probe.error.message.includes("ETIMEDOUT") ? "version check timed out" : "version check failed";
  const output = `${probe.stdout || ""}${probe.stderr || ""}`.trim();
  return output ? output.split(/\r?\n/)[0] : "version output unavailable";
}

function buildDeck(deckPathInput: string, outDir: string, singleHtml: boolean, renderOptions: { mode?: string; profile?: string }): BuildResult {
  const deckPath = resolve(deckPathInput);
  const deck = loadDeck(deckPath);
  const diagnostics = validateDeck(deck, layoutRegistry);
  if (hasErrors(diagnostics)) {
    printDiagnostics(diagnostics);
    throw new Error("Build stopped because deck validation failed.");
  }

  mkdirSync(outDir, { recursive: true });
  const assetEntries: Array<{ src: string; resolved?: string; bytes?: number; inlined: boolean; warning?: string }> = [];
  const html = renderStandaloneHtml(deck, {
    mode: renderOptions.mode as any,
    profile: renderOptions.profile,
    assetResolver: (src) => {
      if (/^(?:https?:|data:|\/)/i.test(src)) return src;
      const source = resolve(dirname(deckPath), src);
      if (!existsSync(source)) {
        assetEntries.push({ src, inlined: false, warning: "missing" });
        return src;
      }
      const bytes = statSync(source).size;
      if (!singleHtml) {
        assetEntries.push({ src, resolved: source, bytes, inlined: false });
        return src;
      }
      const data = readFileSync(source);
      assetEntries.push({
        src,
        resolved: source,
        bytes,
        inlined: true,
        warning: bytes > 2_000_000 ? "large asset inlined; consider resizing" : undefined,
      });
      return `data:${mimeFor(source)};base64,${data.toString("base64")}`;
    },
  });
  const htmlPath = join(outDir, "index.html");
  const assetReportPath = join(outDir, "asset-report.json");
  writeFileSync(htmlPath, html, "utf8");
  writeJsonReport(assetReportPath, {
    schemaVersion: REPORT_SCHEMA_VERSION,
    agentdeckVersion: AGENTDECK_VERSION,
    source: reportSource(deckPath),
    environment: reportEnvironment(["markdown"]),
    pipeline: [pipelineAttempt({ step: "markdown-to-html", backend: "agentdeck-markdown", status: "success", message: `${deck.slides.length} slide(s)` })],
    output: reportOutput({
      htmlPath: "index.html",
      bytes: statSync(htmlPath).size,
      pageCount: deck.slides.length,
      packMode: singleHtml ? "single-html" : "folder",
      fidelity: "markdown",
    }),
    qualitySignals: defaultQualitySignals(assetEntries.flatMap((entry) => entry.warning ? [`${entry.src}: ${entry.warning}`] : [])),
    assets: assetEntries,
  });
  return { deck, htmlPath, assetReportPath };
}

async function commandWrapRenderedFile(
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
    const deckPages = writeRenderedPageAssets(pages, outDir, imageOptions.pack);
    const totalBytes = pages.reduce((sum, page) => sum + page.bytes, 0);
    const deck = renderedFileDeck(title, originalSourcePath, deckPages, "rendered-file", imageOptions.fit);
    mkdirSync(outDir, { recursive: true });
    const outputHtml = renderStandaloneHtml(deck, {
      includeSourceJson: false,
      mode: "audience",
      profile: "rendered-file",
    });
    const outputPath = join(outDir, "index.html");
    const assetReportPath = join(outDir, "asset-report.json");
    writeFileSync(outputPath, outputHtml, "utf8");
    const htmlBytes = statSync(outputPath).size;
    const warnings = sizeBudgetWarnings(totalBytes, imageOptions);
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
        oversizedOutput: warnings.length > 0,
      },
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

async function maybeVerifyWrappedOutput(
  outputPath: string,
  options: { flags: Record<string, string | boolean> },
): Promise<{ code: number; report?: VerifyReport }> {
  if (options.flags["no-verify"]) return { code: 0 };
  try {
    const report = await verifyStandaloneHtml(outputPath, { debug: Boolean(options.flags.debug) });
    const reportPath = join(dirname(outputPath), "verify-report.json");
    writeJsonReport(reportPath, report);
    if (report.status === "pass") {
      console.log(`Verify PASS (${report.slideCount} slide(s))`);
      console.log(`Wrote ${reportPath}`);
      return { code: 0, report };
    }
    console.log(`Converted with ${report.status.toUpperCase()} quality signals. See ${reportPath}`);
    for (const issue of report.issues) console.log(`${issue.level.toUpperCase()} ${issue.code}: ${issue.message}`);
    return { code: report.status === "fail" ? 1 : 0, report };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`Converted, but verify could not run: ${message}`);
    return { code: 0 };
  }
}

function writeRenderedPageAssets(pages: RenderedPage[], outDir: string, pack: PackMode): RenderedPage[] {
  if (pack === "single-html") return pages;
  const assetsDir = join(outDir, "assets");
  mkdirSync(assetsDir, { recursive: true });
  return pages.map((page) => {
    const extension = page.format === "jpeg" ? "jpg" : page.format;
    const fileName = `page-${String(page.index).padStart(3, "0")}.${extension}`;
    const filePath = join(assetsDir, fileName);
    writeDataUrlFile(page.src, filePath);
    return {
      ...page,
      src: `assets/${fileName}`,
      fileName,
    };
  });
}

function writeDataUrlFile(dataUrl: string, filePath: string): void {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) {
    writeFileSync(filePath, dataUrl, "utf8");
    return;
  }
  const header = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  const data = /;base64/i.test(header) ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload));
  writeFileSync(filePath, data);
}

async function convertOfficeToPdf(
  sourcePath: string,
  outDir: string,
  preferredBackend: OfficeBackendPreference = "auto",
  options: { timeoutMs?: number } = {},
): Promise<OfficeConversionResult> {
  const ext = extname(sourcePath).toLowerCase();
  const failures: string[] = [];
  const pipeline: PipelineAttempt[] = [];
  const converter = findCommand(["/Applications/LibreOffice.app/Contents/MacOS/soffice", "soffice", "libreoffice"]);
  if (preferredBackend === "auto" || preferredBackend === "libreoffice") {
    if (converter) {
      const installationIssue = inspectOfficeInstallation(converter);
      if (!installationIssue) {
        try {
          const startedAt = Date.now();
          return {
            pdfPath: convertOfficeToPdfWithLibreOffice(sourcePath, outDir, converter, options.timeoutMs),
            backend: "libreoffice",
            pipeline: [...pipeline, pipelineAttempt({ step: "office-to-pdf", backend: "libreoffice", status: "success", durationMs: Date.now() - startedAt })],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          pipeline.push(pipelineAttempt({ step: "office-to-pdf", backend: "libreoffice", status: "failed", errorCode: "office.converter_failed", message }));
          failures.push(`libreoffice: ${message}`);
        }
      } else {
        pipeline.push(pipelineAttempt({ step: "office-to-pdf", backend: "libreoffice", status: "failed", errorCode: "office.installation_invalid", message: installationIssue }));
        failures.push(`libreoffice: ${installationIssue}`);
      }
    } else {
      pipeline.push(pipelineAttempt({ step: "office-to-pdf", backend: "libreoffice", status: "skipped", message: "not installed" }));
      failures.push("libreoffice: not installed");
    }
  }

  if (preferredBackend === "auto" || preferredBackend === "keynote") {
    if (process.platform === "darwin" && [".ppt", ".pptx", ".key"].includes(ext) && keynoteAvailable()) {
      try {
        const startedAt = Date.now();
        return {
          pdfPath: convertPresentationToPdfWithKeynote(sourcePath, outDir, options.timeoutMs),
          backend: "keynote",
          pipeline: [...pipeline, pipelineAttempt({ step: "office-to-pdf", backend: "keynote", status: "success", durationMs: Date.now() - startedAt })],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pipeline.push(pipelineAttempt({ step: "office-to-pdf", backend: "keynote", status: "failed", errorCode: "office.converter_failed", message }));
        failures.push(`keynote: ${message}`);
      }
    } else if (preferredBackend === "keynote") {
      pipeline.push(pipelineAttempt({ step: "office-to-pdf", backend: "keynote", status: "skipped", message: "not available for this file type or this platform" }));
      failures.push("keynote: not available for this file type or this platform");
    }
  }

  if (preferredBackend === "auto" || preferredBackend === "quicklook-preview") {
    if (process.platform === "darwin" && [".doc", ".docx", ".xls", ".xlsx"].includes(ext) && quickLookPreviewAvailable()) {
      try {
        const startedAt = Date.now();
        return {
          pdfPath: await convertOfficeToPdfWithQuickLookPreview(sourcePath, outDir, options.timeoutMs),
          backend: "quicklook-preview",
          pipeline: [...pipeline, pipelineAttempt({ step: "office-to-pdf", backend: "quicklook-preview", status: "success", durationMs: Date.now() - startedAt })],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pipeline.push(pipelineAttempt({ step: "office-to-pdf", backend: "quicklook-preview", status: "failed", errorCode: "office.converter_failed", message }));
        failures.push(`quicklook-preview: ${message}`);
      }
    } else if (preferredBackend === "quicklook-preview") {
      pipeline.push(pipelineAttempt({ step: "office-to-pdf", backend: "quicklook-preview", status: "skipped", message: "not available for this file type or this platform" }));
      failures.push("quicklook-preview: not available for this file type or this platform");
    }
  }

  if (preferredBackend === "auto" || preferredBackend.startsWith("windows-")) {
    if (process.platform === "win32") {
      const windowsBackend = preferredBackend === "auto"
        ? windowsOfficeBackendForExtension(ext)
        : preferredBackend as Extract<OfficeConversionBackend, "windows-powerpoint" | "windows-word" | "windows-excel">;
      if (windowsBackend) {
        try {
          const startedAt = Date.now();
          return {
            pdfPath: convertOfficeToPdfWithWindowsOffice(sourcePath, outDir, windowsBackend, options.timeoutMs),
            backend: windowsBackend,
            pipeline: [...pipeline, pipelineAttempt({ step: "office-to-pdf", backend: windowsBackend, status: "success", durationMs: Date.now() - startedAt })],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          pipeline.push(pipelineAttempt({ step: "office-to-pdf", backend: windowsBackend, status: "failed", errorCode: "office.converter_failed", message }));
          failures.push(`${windowsBackend}: ${message}`);
        }
      }
    } else if (preferredBackend !== "auto") {
      pipeline.push(pipelineAttempt({ step: "office-to-pdf", backend: preferredBackend, status: "skipped", message: "not available on this platform" }));
      failures.push(`${preferredBackend}: not available on this platform`);
    }
  }

  if (preferredBackend !== "auto") {
    throw new Error(
      [
        `Office to PDF conversion failed for forced backend '${preferredBackend}'.`,
        failures.join("\n"),
      ].join("\n"),
    );
  }

  throw new Error(
    [
      "Office to PDF conversion failed.",
      "Tried backends: " + describeTriedOfficeBackends(ext),
      failures.join("\n"),
    ].join("\n"),
  );
}

function convertOfficeToPdfWithLibreOffice(sourcePath: string, outDir: string, converter: string, timeoutMs = 120_000): string {
  const userProfile = join(outDir, "libreoffice-profile");
  mkdirSync(userProfile, { recursive: true });
  const result = runCommand(
    converter,
    [
      `-env:UserInstallation=${pathToFileURL(userProfile).href}`,
      "--headless",
      "--norestore",
      "--nodefault",
      "--nolockcheck",
      "--nofirststartwizard",
      "--convert-to",
      "pdf",
      "--outdir",
      outDir,
      sourcePath,
    ],
    { timeoutMs, env: officeConverterEnv() },
  );
  if (result.error) {
    const installationHint = inspectOfficeInstallation(converter);
    const detail = installationHint ? ` ${installationHint}.` : "";
    throw new Error(result.timedOut ? `timed out after ${Math.round(timeoutMs / 1000)} seconds.${detail}` : `${result.error.message}.${detail}`);
  }
  if (result.status !== 0) {
    throw new Error(commandOutput(result) || "unknown LibreOffice conversion error");
  }
  const expected = join(outDir, `${parse(sourcePath).name}.pdf`);
  if (existsSync(expected)) return expected;
  const pdf = readdirSync(outDir).find((file) => file.toLowerCase().endsWith(".pdf"));
  if (!pdf) throw new Error("LibreOffice did not produce a PDF");
  return join(outDir, pdf);
}

function convertPresentationToPdfWithKeynote(sourcePath: string, outDir: string, timeoutMs = 180_000): string {
  const pdfPath = join(outDir, `${parse(sourcePath).name}.pdf`);
  if (existsSync(pdfPath)) rmSync(pdfPath, { force: true });
  const script = [
    "on run argv",
    "set inputPath to POSIX file (item 1 of argv)",
    "set outputPath to POSIX file (item 2 of argv)",
    'tell application "Keynote"',
    "set appWasRunning to running",
    "launch",
    "set docRef to open inputPath",
    "delay 3",
    "export docRef to outputPath as PDF",
    "close docRef saving no",
    "if appWasRunning is false then quit",
    "end tell",
    "end run",
  ];
  const args = script.flatMap((line) => ["-e", line]).concat([sourcePath, pdfPath]);
  const result = runCommand("osascript", args, { timeoutMs });
  if (result.error) {
    throw new Error(commandErrorMessage(result, "Keynote export failed"));
  }
  if (result.status !== 0 || !existsSync(pdfPath)) {
    throw new Error(commandOutput(result) || "Keynote did not produce a PDF");
  }
  return pdfPath;
}

async function convertOfficeToPdfWithQuickLookPreview(sourcePath: string, outDir: string, timeoutMs = 120_000): Promise<string> {
  const qlmanage = findCommand(["qlmanage"]);
  if (!qlmanage) throw new Error("qlmanage not found");

  const previewDir = join(outDir, "quicklook-preview");
  mkdirSync(previewDir, { recursive: true });
  const result = runCommand(qlmanage, ["-p", "-o", previewDir, sourcePath], { timeoutMs });
  if (result.error) {
    throw new Error(commandErrorMessage(result, "Quick Look did not generate a preview"));
  }
  if (result.status !== 0) {
    throw new Error(commandOutput(result) || "Quick Look did not generate a preview");
  }

  const previewHtmlPath = findQuickLookPreviewHtml(previewDir);
  if (!previewHtmlPath) {
    throw new Error("Quick Look did not produce Preview.html");
  }

  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const pdfPath = join(outDir, `${parse(sourcePath).name}.pdf`);
  try {
    await page.goto(pathToFileURL(previewHtmlPath).toString(), { waitUntil: "load" });
    await page.pdf({
      path: pdfPath,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }

  if (!existsSync(pdfPath)) throw new Error("Quick Look preview did not print to PDF");
  return pdfPath;
}

function findQuickLookPreviewHtml(rootDir: string): string | undefined {
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const nextPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }
      if (entry.isFile() && entry.name === "Preview.html") {
        return nextPath;
      }
    }
  }
  return undefined;
}

function convertOfficeToPdfWithWindowsOffice(sourcePath: string, outDir: string, backend: Extract<OfficeConversionBackend, "windows-powerpoint" | "windows-word" | "windows-excel">, timeoutMs = 180_000): string {
  const shell = findCommand(["powershell", "pwsh"]);
  if (!shell) throw new Error("PowerShell not found");
  const pdfPath = join(outDir, `${parse(sourcePath).name}.pdf`);
  const inputLiteral = powershellLiteral(sourcePath);
  const outputLiteral = powershellLiteral(pdfPath);
  const scripts = {
    "windows-powerpoint": [
      "$app = New-Object -ComObject PowerPoint.Application",
      "$presentation = $app.Presentations.Open(" + inputLiteral + ", $false, $false, $false)",
      "$presentation.SaveAs(" + outputLiteral + ", 32)",
      "$presentation.Close()",
      "$app.Quit()",
    ],
    "windows-word": [
      "$app = New-Object -ComObject Word.Application",
      "$app.Visible = $false",
      "$document = $app.Documents.Open(" + inputLiteral + ", [ref]$false, [ref]$true)",
      "$document.ExportAsFixedFormat(" + outputLiteral + ", 17)",
      "$document.Close([ref]$false)",
      "$app.Quit()",
    ],
    "windows-excel": [
      "$app = New-Object -ComObject Excel.Application",
      "$app.Visible = $false",
      "$workbook = $app.Workbooks.Open(" + inputLiteral + ", 0, $true)",
      "$workbook.ExportAsFixedFormat(0, " + outputLiteral + ")",
      "$workbook.Close($false)",
      "$app.Quit()",
    ],
  } as const;
  const command = [
    "$ErrorActionPreference = 'Stop'",
    ...scripts[backend],
  ].join("; ");
  const result = runCommand(shell, ["-NoProfile", "-NonInteractive", "-Command", command], { timeoutMs });
  if (result.error) throw new Error(commandErrorMessage(result, "Windows Office COM automation failed"));
  if (result.status !== 0 || !existsSync(pdfPath)) {
    throw new Error(commandOutput(result) || "Windows Office COM automation failed");
  }
  return pdfPath;
}

function renderedFileDeck(title: string, sourcePath: string, pages: Array<{ index: number; src: string }>, origin: "rendered-file" | "html-raster", fit: FitMode): DeckDocument {
  return {
    meta: {
      title,
      subtitle: `${origin === "html-raster" ? "Rasterized HTML" : "Rendered"} from ${basename(sourcePath)}`,
      author: "Source file",
      lang: "zh-CN",
      theme: "swiss",
      aspect: "16:9",
      outputs: ["html", "pdf", "png"],
      mode: "audience",
      variants: [],
      compatibility: "rendered-file",
      filenameStem: slugifyLocal(title),
      sourceStyles: renderedFileSourceStyles(fit),
    },
    slides: pages.map((page) => ({
      id: `page-${page.index}`,
      title: `Page ${page.index}`,
      layout: "html-import",
      blocks: [{ type: "html" as const, html: `<img class="ad-imported-page" src="${page.src}" alt="Page ${page.index}">`, source: sourcePath }],
      raw: "",
    })),
  };
}

function renderedFileSourceStyles(fit: FitMode): string {
  const base = ".layout-html-import .ad-html-block{display:grid;place-items:center;background:#fff}.layout-html-import .ad-html-block img.ad-imported-page{display:block;background:#fff}";
  if (fit === "cover") return `${base}.layout-html-import .ad-html-block img.ad-imported-page{width:100%;height:100%;object-fit:cover}`;
  if (fit === "width") return `${base}.layout-html-import .ad-html-block img.ad-imported-page{width:100%;height:auto;max-height:none;object-fit:contain}`;
  if (fit === "height") return `${base}.layout-html-import .ad-html-block img.ad-imported-page{width:auto;height:100%;max-width:none;object-fit:contain}`;
  return `${base}.layout-html-import .ad-html-block img.ad-imported-page{width:100%;height:100%;object-fit:contain}`;
}

function imageOutputOptions(flags: Record<string, string | boolean>): ImageOutputOptions {
  const maxOutputBytes = maxOutputBytesFlag(flags["max-output-mb"]);
  const sizeBudgetBytes = sizeBudgetFlag(flags["size-budget"]);
  return {
    fit: fitMode(flags.fit),
    format: imageFormat(flags["image-format"]),
    quality: qualityFlag(flags.quality),
    maxWidth: positiveIntegerFlag(flags["max-width"]),
    sizeBudgetBytes: sizeBudgetBytes ?? maxOutputBytes,
    maxOutputBytes,
    maxPages: positiveIntegerFlag(flags["max-pages"]),
    pack: packMode(flags.pack),
    thumbnailDpi: positiveIntegerFlag(flags["thumbnail-dpi"]) ?? 40,
  };
}

function fitMode(value: string | boolean | undefined): FitMode {
  if (value === "width" || value === "height" || value === "cover" || value === "contain") return value;
  return "contain";
}

function imageFormat(value: string | boolean | undefined): ImageFormat {
  if (value === "jpeg" || value === "webp" || value === "png") return value;
  if (value === "jpg") return "jpeg";
  return "png";
}

function qualityFlag(value: string | boolean | undefined): number {
  if (typeof value !== "string") return 82;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 82;
  return Math.max(1, Math.min(100, Math.round(parsed)));
}

function positiveIntegerFlag(value: string | boolean | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

function sizeBudgetFlag(value: string | boolean | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(b|kb|mb)?$/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "b").toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  if (unit === "mb") return Math.round(amount * 1024 * 1024);
  if (unit === "kb") return Math.round(amount * 1024);
  return Math.round(amount);
}

function maxOutputBytesFlag(value: string | boolean | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.round(parsed * 1024 * 1024);
}

function packMode(value: string | boolean | undefined): PackMode {
  if (value === "folder" || value === "single-html") return value;
  return "single-html";
}

function timeoutMsFlag(value: string | boolean | undefined, fallback = 120_000): number {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

async function applyImageOutputOptions(pages: RenderedPage[], options: ImageOutputOptions): Promise<RenderedPage[]> {
  const needsCanvas = options.format !== "png" || Boolean(options.maxWidth);
  if (!needsCanvas) return pages;

  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  try {
    const converted: RenderedPage[] = [];
    for (const renderedPage of pages) {
      const result = await page.evaluate(
        async ({ src, format, quality, maxWidth }: { src: string; format: ImageFormat; quality: number; maxWidth?: number }) => {
          const image = new Image();
          image.decoding = "async";
          image.src = src;
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error("Image failed to load in canvas"));
          });
          const sourceWidth = image.naturalWidth || image.width;
          const sourceHeight = image.naturalHeight || image.height;
          const scale = maxWidth && sourceWidth > maxWidth ? maxWidth / sourceWidth : 1;
          const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
          const outputHeight = Math.max(1, Math.round(sourceHeight * scale));
          const canvas = document.createElement("canvas");
          canvas.width = outputWidth;
          canvas.height = outputHeight;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas 2D context unavailable");
          context.drawImage(image, 0, 0, outputWidth, outputHeight);
          const requestedMime = `image/${format}`;
          const dataUrl = canvas.toDataURL(requestedMime, format === "png" ? undefined : quality / 100);
          const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
          return { dataUrl, sourceWidth, sourceHeight, outputWidth, outputHeight, mime };
        },
        {
          src: renderedPage.src,
          format: options.format,
          quality: options.quality,
          maxWidth: options.maxWidth,
        },
      );
      converted.push({
        ...renderedPage,
        src: result.dataUrl,
        bytes: dataUrlBytes(result.dataUrl),
        sourceWidth: renderedPage.sourceWidth || result.sourceWidth,
        sourceHeight: renderedPage.sourceHeight || result.sourceHeight,
        outputWidth: result.outputWidth,
        outputHeight: result.outputHeight,
        format: imageFormatFromMime(result.mime),
        mime: result.mime,
      });
    }
    return converted;
  } finally {
    await browser.close();
  }
}

function imageFormatFromMime(mime: string): ImageFormat {
  if (mime === "image/jpeg") return "jpeg";
  if (mime === "image/webp") return "webp";
  return "png";
}

function dataUrlBytes(src: string): number {
  const comma = src.indexOf(",");
  if (comma === -1) return Buffer.byteLength(src);
  const header = src.slice(0, comma);
  const payload = src.slice(comma + 1);
  if (/;base64/i.test(header)) return Buffer.from(payload, "base64").byteLength;
  return Buffer.byteLength(decodeURIComponent(payload));
}

function pageReportEntry(page: RenderedPage): Record<string, string | number> {
  return {
    index: page.index,
    bytes: page.bytes,
    sourceWidth: page.sourceWidth,
    sourceHeight: page.sourceHeight,
    outputWidth: page.outputWidth,
    outputHeight: page.outputHeight,
    format: page.format,
    mime: page.mime,
    ...(page.fileName ? { fileName: page.fileName } : {}),
  };
}

function sizeBudgetWarnings(totalBytes: number, options: ImageOutputOptions): string[] {
  if (!options.sizeBudgetBytes || totalBytes <= options.sizeBudgetBytes) return [];
  return [`single HTML embedded images exceed size budget (${formatBytes(totalBytes)} > ${formatBytes(options.sizeBudgetBytes)})`];
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}mb`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}kb`;
  return `${bytes}b`;
}

function pngDimensions(data: Buffer): { width: number; height: number } {
  if (data.length >= 24 && data.toString("ascii", 1, 4) === "PNG") {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  return { width: 0, height: 0 };
}

function resolveInputPath(input: string): string {
  if (input.startsWith("file://")) return fileURLToPath(input);
  return resolve(input);
}

function htmlStrategy(value: string | boolean | undefined): HtmlWrapStrategy {
  if (value === "dom" || value === "raster" || value === "auto") return value;
  return "auto";
}

function officeBackendPreference(value: string | boolean | undefined): OfficeBackendPreference {
  if (
    value === "auto" ||
    value === "libreoffice" ||
    value === "keynote" ||
    value === "quicklook-preview" ||
    value === "windows-powerpoint" ||
    value === "windows-word" ||
    value === "windows-excel"
  ) return value;
  return "auto";
}

function pythonModuleAvailable(python: string, moduleName: string): boolean {
  const result = spawnSync(
    python,
    ["-c", `import importlib.util, sys; sys.exit(0 if importlib.util.find_spec(${JSON.stringify(moduleName)}) else 1)`],
    { encoding: "utf8", timeout: 5_000 },
  );
  return result.status === 0;
}

function officeConverterEnv(): NodeJS.ProcessEnv {
  return process.platform === "linux"
    ? { ...process.env, SAL_USE_VCLPLUGIN: "svp" }
    : { ...process.env };
}

function describeNativeOfficeFallbacks(): string {
  const fallbacks: string[] = [];
  if (process.platform === "darwin" && keynoteAvailable()) fallbacks.push("Keynote.app for .ppt/.pptx/.key -> PDF");
  if (process.platform === "darwin" && quickLookPreviewAvailable()) fallbacks.push("Quick Look preview for .doc/.docx/.xls/.xlsx -> HTML preview -> PDF");
  if (process.platform === "win32") fallbacks.push("PowerPoint/Word/Excel COM automation when Microsoft Office is installed");
  return fallbacks.length ? fallbacks.join("; ") : "none detected";
}

function inspectOfficeInstallation(commandPath: string): string | undefined {
  const bundlePath = officeBundlePath(commandPath);
  if (!bundlePath) return undefined;

  const gatekeeper = spawnSync("spctl", ["--assess", "--type", "execute", "-vv", bundlePath], { encoding: "utf8", timeout: 5_000 });
  const gatekeeperOutput = `${gatekeeper.stdout || ""}${gatekeeper.stderr || ""}`.trim();
  if (/sealed resource is missing or invalid/i.test(gatekeeperOutput)) {
    return "macOS reports the LibreOffice app bundle has missing or invalid sealed resources";
  }

  const attrs = spawnSync("xattr", ["-l", bundlePath], { encoding: "utf8", timeout: 5_000 });
  const attrOutput = `${attrs.stdout || ""}${attrs.stderr || ""}`.trim();
  if (/com\.apple\.quarantine/i.test(attrOutput) && /Homebrew Cask|quarantine/i.test(attrOutput)) {
    return "macOS quarantine attributes are present on the LibreOffice app bundle";
  }

  return undefined;
}

function officeBundlePath(commandPath: string): string | undefined {
  const marker = "/Contents/MacOS/";
  const index = commandPath.indexOf(marker);
  if (index === -1) return undefined;
  return commandPath.slice(0, index);
}

function keynoteAvailable(): boolean {
  return existsSync("/Applications/Keynote.app");
}

function quickLookPreviewAvailable(): boolean {
  return process.platform === "darwin" && Boolean(findCommand(["qlmanage"]));
}

function windowsOfficeBackendForExtension(ext: string): Extract<OfficeConversionBackend, "windows-powerpoint" | "windows-word" | "windows-excel"> | undefined {
  if (ext === ".ppt" || ext === ".pptx") return "windows-powerpoint";
  if (ext === ".doc" || ext === ".docx") return "windows-word";
  if (ext === ".xls" || ext === ".xlsx") return "windows-excel";
  return undefined;
}

function describeTriedOfficeBackends(ext: string): string {
  const backends = ["LibreOffice"];
  if (process.platform === "darwin" && [".ppt", ".pptx", ".key"].includes(ext)) backends.push("Keynote");
  if (process.platform === "darwin" && [".doc", ".docx", ".xls", ".xlsx"].includes(ext)) backends.push("Quick Look preview");
  if (process.platform === "win32") {
    const backend = windowsOfficeBackendForExtension(ext);
    if (backend === "windows-powerpoint") backends.push("PowerPoint COM");
    if (backend === "windows-word") backends.push("Word COM");
    if (backend === "windows-excel") backends.push("Excel COM");
  }
  return backends.join(", ");
}

function powershellLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function pageNumber(file: string): number {
  return Number(file.match(/-(\d+)\.png$/i)?.[1] ?? 0);
}

function slugifyLocal(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "deck";
}

async function exportWithPlaywright(
  build: BuildResult,
  outDir: string,
  wanted: { pdf: boolean; png: boolean; longImage: boolean; grid9: boolean; socialPack: boolean },
): Promise<void> {
  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const url = pathToFileURL(build.htmlPath).toString();
  let freshCounter = 0;
  const freshUrl = (hash = "") => `${url}?agentdeck-export=${freshCounter += 1}${hash}`;

  try {
    await page.goto(freshUrl(), { waitUntil: "networkidle" });
    if (wanted.pdf) {
      await page.pdf({
        path: join(outDir, `${build.deck.meta.filenameStem}.pdf`),
        width: "1920px",
        height: "1080px",
        printBackground: true,
        landscape: true,
      });
      console.log(`Exported ${join(outDir, `${build.deck.meta.filenameStem}.pdf`)}`);
    }
    if (wanted.png) {
      const pngDir = join(outDir, "png");
      mkdirSync(pngDir, { recursive: true });
      for (let index = 0; index < build.deck.slides.length; index += 1) {
        await page.goto(freshUrl(`#/${index + 1}`), { waitUntil: "networkidle" });
        await page.locator(".ad-slide:not([hidden])").screenshot({ path: join(pngDir, `${String(index + 1).padStart(2, "0")}.png`) });
      }
      console.log(`Exported PNG slides to ${pngDir}`);
    }
    if (wanted.longImage) {
      await page.goto(freshUrl(), { waitUntil: "networkidle" });
      await page.evaluate(() => {
        document.querySelectorAll(".ad-slide").forEach((slide) => {
          (slide as HTMLElement).hidden = false;
          Object.assign((slide as HTMLElement).style, { position: "relative", display: "block" });
        });
        const scaled = document.querySelector("[data-scaled]") as HTMLElement | null;
        if (scaled) Object.assign(scaled.style, { transform: "none", height: "auto" });
        const stage = document.querySelector(".ad-stage") as HTMLElement | null;
        if (stage) Object.assign(stage.style, { position: "static", display: "block" });
        document.body.style.overflow = "visible";
      });
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.screenshot({ path: join(outDir, `${build.deck.meta.filenameStem}-long.png`), fullPage: true });
      console.log(`Exported ${join(outDir, `${build.deck.meta.filenameStem}-long.png`)}`);
    }
    if (wanted.grid9 || wanted.socialPack) {
      await page.goto(freshUrl(), { waitUntil: "networkidle" });
      await page.evaluate(() => {
        const slides = [...document.querySelectorAll(".ad-slide")].slice(0, 9) as HTMLElement[];
        const scaled = document.querySelector("[data-scaled]") as HTMLElement | null;
        if (!scaled) return;
        scaled.style.transform = "none";
        scaled.style.display = "grid";
        scaled.style.gridTemplateColumns = "repeat(3, 640px)";
        scaled.style.gridAutoRows = "360px";
        scaled.style.width = "1920px";
        scaled.style.height = "1080px";
        slides.forEach((slide) => {
          slide.hidden = false;
          Object.assign(slide.style, { position: "relative", width: "1920px", height: "1080px", transform: "scale(.333333)", transformOrigin: "top left" });
        });
      });
      const gridPath = join(outDir, wanted.socialPack ? "social-grid9.png" : `${build.deck.meta.filenameStem}-grid9.png`);
      await page.locator("[data-scaled]").screenshot({ path: gridPath });
      console.log(`Exported ${gridPath}`);
    }
    if (wanted.socialPack) {
      const socialDir = join(outDir, "social-pack");
      mkdirSync(socialDir, { recursive: true });
      await page.goto(freshUrl("#/1"), { waitUntil: "networkidle" });
      await page.locator(".ad-slide:not([hidden])").screenshot({ path: join(socialDir, "cover.png") });
      await page.goto(freshUrl(), { waitUntil: "networkidle" });
      await page.evaluate(() => {
        document.querySelectorAll(".ad-slide").forEach((slide) => {
          (slide as HTMLElement).hidden = false;
          Object.assign((slide as HTMLElement).style, { position: "relative", display: "block" });
        });
        const scaled = document.querySelector("[data-scaled]") as HTMLElement | null;
        if (scaled) Object.assign(scaled.style, { transform: "none", height: "auto" });
        const stage = document.querySelector(".ad-stage") as HTMLElement | null;
        if (stage) Object.assign(stage.style, { position: "static", display: "block" });
        document.body.style.overflow = "visible";
      });
      await page.screenshot({ path: join(socialDir, "long-image.png"), fullPage: true });
      console.log(`Exported social pack to ${socialDir}`);
    }
  } finally {
    await browser.close();
  }
}

async function loadPlaywright(): Promise<any> {
  try {
    return await import("playwright");
  } catch {
    throw new Error("Playwright is required for export, verify, HTML raster wrapping, and image compression. Install it with: npm install -D playwright && npx playwright install chromium");
  }
}

function loadDeck(deckPathInput: string): DeckDocument {
  const deckPath = resolve(deckPathInput);
  if (!existsSync(deckPath)) throw new Error(`Deck file not found: ${deckPath}`);
  return parseDeckMarkdown(readFileSync(deckPath, "utf8"), deckPath);
}

function parseArgs(args: string[]): { positionals: string[]; flags: Record<string, string | boolean> } {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[index + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        index += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

function stringFlag(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function printDiagnostics(diagnostics: Diagnostic[]): void {
  console.log(formatDiagnostics(diagnostics));
}

function mimeFor(file: string): string {
  const ext = extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".woff2") return "font/woff2";
  return "application/octet-stream";
}

function resolveHtmlAsset(src: string, sourceDir: string, assetReport: Array<{ src: string; resolved?: string; bytes?: number; inlined: boolean; warning?: string }>): string {
  if (isExternalOrSpecialUrl(src)) return src;
  const [pathname, suffix = ""] = src.split(/(?=[?#])/);
  if (!pathname) return src;
  const source = resolve(sourceDir, pathname);
  if (!existsSync(source) || !statSync(source).isFile()) {
    assetReport.push({ src, inlined: false, warning: "missing" });
    return src;
  }
  const bytes = statSync(source).size;
  const data = readFileSync(source);
  assetReport.push({
    src,
    resolved: source,
    bytes,
    inlined: true,
    warning: bytes > 2_000_000 ? "large asset inlined; consider resizing" : undefined,
  });
  return `data:${mimeFor(source)};base64,${data.toString("base64")}${suffix}`;
}

function isExternalOrSpecialUrl(src: string): boolean {
  return /^(?:https?:|data:|blob:|mailto:|tel:|javascript:|#|about:)/i.test(src) || src.startsWith("//");
}

function hasNodeModule(name: string): boolean {
  const roots = [process.cwd(), dirname(process.execPath)];
  return roots.some((root) => existsSync(join(root, "node_modules", name)));
}

function starterDeck(theme: string): string {
  return `---
title: AgentDeck 单文件演示
subtitle: 给任意来源的 deck 加上可传播的 HTML 播放器
author: AgentDeck
lang: zh-CN
theme: ${theme}
aspect: 16:9
outputs: [html, pdf, png, long-image, grid9]
audience: creator
mode: audience
compatibility: agentdeck
---

# AgentDeck 单文件演示
layout: cover
note: 开场说明 AgentDeck 只负责封装与演示增强

已有 PPT、PDF、HTML 负责内容，AgentDeck 负责单文件 HTML 播放器

# 核心边界
layout: statement
note: 明确 AgentDeck 的产品哲学

不重排、不改编、不替用户做 PPT，只把已有演示文件变成可播放、可分享、可导出的单 HTML

# 两种入口
layout: steps
note: 用户可以从 Markdown 或已有 HTML 进入

- agentdeck build deck.md
- agentdeck wrap deck.pdf
- agentdeck wrap deck.pptx
- agentdeck wrap deck.html
- 获得同一套增强播放能力

# 收束
layout: closing

- 原样兼容
- 增强播放
- 单文件交付
`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli().then((result) => {
    process.exitCode = result.code;
  });
}
