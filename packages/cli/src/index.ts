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

interface CliResult {
  code: number;
}

interface BuildResult {
  deck: DeckDocument;
  htmlPath: string;
  assetReportPath: string;
}

const help = `AgentDeck

Usage:
  agentdeck init [dir] [--theme editorial|swiss|launch|course]
  agentdeck dev [deck.md]
  agentdeck build [deck.md] [--out dist] [--single-html] [--mode audience|presenter|creator] [--profile agentdeck|external-html|rendered-file]
  agentdeck export [deck.md] [--pdf] [--png] [--long-image] [--grid9] [--social-pack] [--out dist]
  agentdeck wrap <deck.html|deck.pdf|deck.ppt|deck.pptx> [--out dist] [--title "Deck title"] [--dpi 180] [--html-strategy auto|dom|raster]
  agentdeck wrap-html <index.html> [--out dist] [--title "Deck title"] [--html-strategy auto|dom|raster]
  agentdeck lint [deck.md]
  agentdeck doctor
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
    if (command === "wrap") return commandWrap(rest);
    if (command === "wrap-html") return commandWrapHtml(rest);
    if (command === "dev") return commandDev(rest);
    if (command === "doctor") return commandDoctor();

    console.error(`Unknown command: ${command}\n`);
    console.error(help);
    return { code: 2 };
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return { code: 1 };
  }
}

async function commandWrap(args: string[]): Promise<CliResult> {
  const options = parseArgs(args);
  const file = options.positionals[0];
  if (!file) {
    console.error('Usage: agentdeck wrap <deck.html|deck.pdf|deck.ppt|deck.pptx> [--out dist] [--title "Deck title"] [--dpi 180] [--html-strategy auto|dom|raster]');
    return { code: 2 };
  }
  const sourcePath = resolveInputPath(file);
  const ext = extname(sourcePath).toLowerCase();
  if (ext === ".html" || ext === ".htm") return commandWrapHtml(args);
  if (ext === ".pdf") return commandWrapRenderedFile(sourcePath, options);
  if (ext === ".ppt" || ext === ".pptx") {
    const tempDir = mkdtempSync(join(tmpdir(), "agentdeck-office-"));
    try {
      const pdfPath = convertOfficeToPdf(sourcePath, tempDir);
      return commandWrapRenderedFile(pdfPath, options, sourcePath);
    } finally {
      if (!options.flags["keep-temp"]) rmSync(tempDir, { recursive: true, force: true });
    }
  }
  console.error(`Unsupported input for wrap: ${ext || basename(sourcePath)}. Use HTML, PDF, PPT, or PPTX.`);
  return { code: 2 };
}

async function commandWrapHtml(args: string[]): Promise<CliResult> {
  const options = parseArgs(args);
  const file = options.positionals[0];
  if (!file) {
    console.error('Usage: agentdeck wrap-html <index.html> [--out dist] [--title "Deck title"] [--html-strategy auto|dom|raster]');
    return { code: 2 };
  }
  const htmlPath = resolveInputPath(file);
  const htmlSource = readFileSync(htmlPath, "utf8");
  const strategy = htmlStrategy(options.flags["html-strategy"] ?? options.flags.strategy);
  if (strategy === "raster" || (strategy === "auto" && shouldRasterizeHtml(htmlSource))) {
    return commandWrapHtmlRaster(htmlPath, htmlSource, options);
  }

  const outDir = resolve(String(options.flags.out ?? "dist"));
  const sourceDir = dirname(htmlPath);
  const assetReport: Array<{ src: string; resolved?: string; bytes?: number; inlined: boolean; warning?: string }> = [];
  const imported = importExternalHtmlDeck(htmlSource, {
    sourceName: file,
    title: stringFlag(options.flags.title),
    assetResolver: (src) => resolveHtmlAsset(src, sourceDir, assetReport),
  });

  mkdirSync(outDir, { recursive: true });
  const outputHtml = renderStandaloneHtml(imported.deck, {
    includeSourceJson: false,
    mode: "audience",
    profile: "external-html",
  });
  const outputPath = join(outDir, "index.html");
  const assetReportPath = join(outDir, "asset-report.json");
  writeFileSync(outputPath, outputHtml, "utf8");
  writeFileSync(assetReportPath, JSON.stringify(assetReport, null, 2), "utf8");
  console.log(`Wrapped ${imported.slideCount} slide(s) into ${outputPath}`);
  console.log(`Wrote ${assetReportPath}`);
  if (imported.warnings.length) printDiagnostics(imported.warnings);
  return { code: imported.warnings.some((diagnostic) => diagnostic.level === "error") ? 1 : 0 };
}

async function commandWrapHtmlRaster(
  htmlPath: string,
  htmlSource: string,
  options: { positionals: string[]; flags: Record<string, string | boolean> },
): Promise<CliResult> {
  const outDir = resolve(String(options.flags.out ?? "dist"));
  const title = stringFlag(options.flags.title) ?? htmlTitle(htmlSource) ?? parse(htmlPath).name;
  const viewport = viewportFlag(options.flags.viewport);
  const settleMs = Number(options.flags["settle-ms"] ?? 900);
  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const pages: Array<{ index: number; src: string; bytes: number }> = [];
  const sourceUrl = pathToFileURL(htmlPath).toString();

  try {
    await page.goto(sourceUrl, { waitUntil: "load" });
    const count = await page.evaluate(() => {
      const selectors = ["#deck .slide", ".slide", "[data-slide]", "section"];
      for (const selector of selectors) {
        const found = document.querySelectorAll(selector).length;
        if (found > 1) return found;
      }
      return 1;
    });

    for (let index = 0; index < count; index += 1) {
      const url = new URL(sourceUrl);
      url.searchParams.set("slide", String(index + 1));
      url.searchParams.set("agentdeck-raster", "1");
      await page.goto(url.toString(), { waitUntil: "load" });
      await page.addStyleTag({
        content: `body.agentdeck-raster-capture #nav,
body.agentdeck-raster-capture #hint,
body.agentdeck-raster-capture #overview,
body.agentdeck-raster-capture .deck-controls,
body.agentdeck-raster-capture .presenter-controls{display:none!important}`,
      });
      await page.evaluate((slideIndex: number) => {
        document.body.classList.add("agentdeck-raster-capture");
        const deck = document.querySelector<HTMLElement>("#deck");
        const slides = [...document.querySelectorAll<HTMLElement>("#deck .slide, .slide")];
        if (deck && slides.length > slideIndex) {
          deck.style.transition = "none";
          deck.style.transform = `translateX(${-slideIndex * 100}vw)`;
          (window as any).__currentSlideIndex = slideIndex;
          document.querySelectorAll("#nav .dot").forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === slideIndex));
        }
      }, index);
      await page.waitForTimeout(settleMs);
      const png = await page.screenshot({ type: "png", fullPage: false });
      pages.push({
        index: index + 1,
        src: `data:image/png;base64,${Buffer.from(png).toString("base64")}`,
        bytes: png.byteLength,
      });
    }
  } finally {
    await browser.close();
  }

  const deck = renderedFileDeck(title, htmlPath, pages, "html-raster");
  mkdirSync(outDir, { recursive: true });
  const outputHtml = renderStandaloneHtml(deck, {
    includeSourceJson: false,
    mode: "audience",
    profile: "rendered-file",
  });
  const outputPath = join(outDir, "index.html");
  const assetReportPath = join(outDir, "asset-report.json");
  writeFileSync(outputPath, outputHtml, "utf8");
  writeFileSync(
    assetReportPath,
    JSON.stringify(
      {
        source: htmlPath,
        fidelity: "raster-html",
        viewport,
        pages: pages.map((page) => ({ index: page.index, bytes: page.bytes })),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Raster-wrapped ${pages.length} HTML page(s) into ${outputPath}`);
  console.log(`Wrote ${assetReportPath}`);
  return { code: 0 };
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

function commandDoctor(): CliResult {
  const office = findCommand(["/Applications/LibreOffice.app/Contents/MacOS/soffice", "soffice", "libreoffice"]);
  const pdfRenderer = findCommand(["pdftoppm"]);
  const checks = [
    ["Node", process.version],
    ["Working directory", process.cwd()],
    ["Office converter", office ? describeOfficeConverter(office) : "not found; PPT/PPTX wrap needs LibreOffice/soffice"],
    ["PDF renderer", pdfRenderer ? describePdfRenderer(pdfRenderer) : "not found; PDF/PPT wrap needs poppler pdftoppm"],
    ["Playwright", hasNodeModule("playwright") ? "available" : "not installed; export will ask for it"],
  ];
  for (const [name, value] of checks) console.log(`${name}: ${value}`);
  return { code: 0 };
}

function describeOfficeConverter(commandPath: string): string {
  const probe = spawnSync(commandPath, ["--version"], { encoding: "utf8", timeout: 5_000 });
  if (probe.error) return `${commandPath} (${probe.error.message.includes("ETIMEDOUT") ? "version check timed out" : `version check failed: ${probe.error.message}`})`;
  const output = `${probe.stdout || ""}${probe.stderr || ""}`.trim();
  return output ? `${commandPath} (${output.split(/\r?\n/)[0]})` : `${commandPath} (found; version output unavailable)`;
}

function describePdfRenderer(commandPath: string): string {
  const probe = spawnSync(commandPath, ["-v"], { encoding: "utf8", timeout: 5_000 });
  if (probe.error) return `${commandPath} (${probe.error.message.includes("ETIMEDOUT") ? "version check timed out" : `version check failed: ${probe.error.message}`})`;
  const output = `${probe.stdout || ""}${probe.stderr || ""}`.trim();
  return output ? `${commandPath} (${output.split(/\r?\n/)[0]})` : `${commandPath} (found; version output unavailable)`;
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
  const assetReport: Array<{ src: string; resolved?: string; bytes?: number; inlined: boolean; warning?: string }> = [];
  const html = renderStandaloneHtml(deck, {
    mode: renderOptions.mode as any,
    profile: renderOptions.profile,
    assetResolver: (src) => {
      if (/^(?:https?:|data:|\/)/i.test(src)) return src;
      const source = resolve(dirname(deckPath), src);
      if (!existsSync(source)) {
        assetReport.push({ src, inlined: false, warning: "missing" });
        return src;
      }
      const bytes = statSync(source).size;
      if (!singleHtml) {
        assetReport.push({ src, resolved: source, bytes, inlined: false });
        return src;
      }
      const data = readFileSync(source);
      assetReport.push({
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
  writeFileSync(assetReportPath, JSON.stringify(assetReport, null, 2), "utf8");
  return { deck, htmlPath, assetReportPath };
}

function commandWrapRenderedFile(pdfPath: string, options: { positionals: string[]; flags: Record<string, string | boolean> }, originalSourcePath = pdfPath): CliResult {
  const outDir = resolve(String(options.flags.out ?? "dist"));
  const title = stringFlag(options.flags.title) ?? parse(originalSourcePath).name;
  const dpi = Number(options.flags.dpi ?? 180);
  const tempDir = mkdtempSync(join(tmpdir(), "agentdeck-pages-"));
  try {
    const pages = renderPdfToPngPages(pdfPath, tempDir, dpi);
    const deck = renderedFileDeck(title, originalSourcePath, pages, "rendered-file");
    mkdirSync(outDir, { recursive: true });
    const outputHtml = renderStandaloneHtml(deck, {
      includeSourceJson: false,
      mode: "audience",
      profile: "rendered-file",
    });
    const outputPath = join(outDir, "index.html");
    const assetReportPath = join(outDir, "asset-report.json");
    writeFileSync(outputPath, outputHtml, "utf8");
    writeFileSync(
      assetReportPath,
      JSON.stringify(
        {
          source: originalSourcePath,
          renderedFrom: pdfPath,
          fidelity: "raster",
          dpi,
          pages: pages.map((page) => ({ index: page.index, bytes: page.bytes })),
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`Wrapped ${pages.length} rendered page(s) into ${outputPath}`);
    console.log(`Wrote ${assetReportPath}`);
    return { code: 0 };
  } finally {
    if (!options.flags["keep-temp"]) rmSync(tempDir, { recursive: true, force: true });
  }
}

function convertOfficeToPdf(sourcePath: string, outDir: string): string {
  const converter = findCommand(["/Applications/LibreOffice.app/Contents/MacOS/soffice", "soffice", "libreoffice"]);
  if (!converter) throw new Error("PPT/PPTX wrapping requires LibreOffice/soffice. Install LibreOffice and retry.");
  const userProfile = join(outDir, "libreoffice-profile");
  mkdirSync(userProfile, { recursive: true });
  const result = spawnSync(
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
    { encoding: "utf8", timeout: 120_000 },
  );
  if (result.error) {
    const timedOut = result.error.message.includes("ETIMEDOUT") || result.signal === "SIGTERM";
    throw new Error(timedOut ? "Office to PDF conversion timed out after 120 seconds." : `Office to PDF conversion failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Office to PDF conversion failed.\n${result.stderr || result.stdout || ""}`.trim());
  }
  const expected = join(outDir, `${parse(sourcePath).name}.pdf`);
  if (existsSync(expected)) return expected;
  const pdf = readdirSync(outDir).find((file) => file.toLowerCase().endsWith(".pdf"));
  if (!pdf) throw new Error("Office to PDF conversion did not produce a PDF.");
  return join(outDir, pdf);
}

function renderPdfToPngPages(pdfPath: string, outDir: string, dpi: number): Array<{ index: number; src: string; bytes: number }> {
  const renderer = findCommand(["pdftoppm"]);
  if (!renderer) throw new Error("PDF wrapping requires pdftoppm from poppler. Install poppler and retry.");
  const prefix = join(outDir, "page");
  const result = spawnSync(renderer, ["-png", "-r", String(dpi), pdfPath, prefix], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`PDF rendering failed.\n${result.stderr || result.stdout || ""}`.trim());
  }
  const files = readdirSync(outDir)
    .filter((file) => /^page-\d+\.png$/i.test(file))
    .sort((a, b) => pageNumber(a) - pageNumber(b));
  if (!files.length) throw new Error("PDF rendering produced no pages.");
  return files.map((file, index) => {
    const imagePath = join(outDir, file);
    const data = readFileSync(imagePath);
    return {
      index: index + 1,
      src: `data:image/png;base64,${data.toString("base64")}`,
      bytes: data.byteLength,
    };
  });
}

function renderedFileDeck(title: string, sourcePath: string, pages: Array<{ index: number; src: string }>, origin: "rendered-file" | "html-raster"): DeckDocument {
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
      sourceStyles: ".layout-html-import .ad-html-block img.ad-imported-page{display:block;width:100%;height:100%;object-fit:contain;background:#fff}",
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

function resolveInputPath(input: string): string {
  if (input.startsWith("file://")) return fileURLToPath(input);
  return resolve(input);
}

function htmlStrategy(value: string | boolean | undefined): "auto" | "dom" | "raster" {
  if (value === "dom" || value === "raster" || value === "auto") return value;
  return "auto";
}

function shouldRasterizeHtml(html: string): boolean {
  const styleSignals = [
    /position\s*:\s*fixed/i,
    /100vw/i,
    /100vh/i,
    /translateX\s*\(/i,
  ].filter((pattern) => pattern.test(html)).length;
  const deckSignals = [
    /id=["']deck["']/i,
    /querySelectorAll\(["'][^"']*\.slide/i,
    /class=["'][^"']*\bslide\b/i,
    /keydown/i,
    /wheel/i,
    /touchstart/i,
  ].filter((pattern) => pattern.test(html)).length;
  return styleSignals >= 3 && deckSignals >= 2;
}

function htmlTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return undefined;
  return match[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim() || undefined;
}

function viewportFlag(value: string | boolean | undefined): { width: number; height: number } {
  if (typeof value === "string") {
    const match = value.match(/^(\d+)x(\d+)$/i);
    if (match) return { width: Number(match[1]), height: Number(match[2]) };
  }
  return { width: 1920, height: 1080 };
}

function findCommand(candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    if (candidate.includes("/") && existsSync(candidate)) return candidate;
    const result = spawnSync("sh", ["-lc", `command -v ${shellQuote(candidate)}`], { encoding: "utf8" });
    const found = result.stdout.trim();
    if (result.status === 0 && found) return found;
  }
  return undefined;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
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
    const importer = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;
    return await importer("playwright");
  } catch {
    throw new Error("Playwright is required for export. Install it with: npm install -D playwright && npx playwright install chromium");
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
