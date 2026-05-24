#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { importExternalHtmlDeck, importSwissLockedHtml, inspectSwissLockedHtml } from "@agentdeck/compat-profiles";
import { renderStandaloneHtml } from "@agentdeck/runtime";
import {
  detectInstalledPptSkills,
  installPptSkill,
  listPptSkills,
  recommendPptSkill,
  shellCommand,
} from "./pptSkills.js";
import {
  adaptDeckMarkdownToScenario,
  classifyDeckScenario,
  formatDiagnostics,
  getScenarioDefinition,
  hasErrors,
  parseDeckMarkdown,
  validateDeck,
  type DeckDocument,
  type Diagnostic,
  type ScenarioId,
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
  agentdeck build [deck.md] [--out dist] [--single-html] [--mode audience|presenter|creator] [--profile agentdeck|swiss-locked]
  agentdeck export [deck.md] [--pdf] [--png] [--long-image] [--grid9] [--social-pack] [--out dist]
  agentdeck wrap-html <index.html> [--out dist] [--title "Deck title"]
  agentdeck skills list
  agentdeck skills detect
  agentdeck skills recommend <file|brief> [--agent codex|claude|any]
  agentdeck skills install <skill-id> [--yes]
  agentdeck classify [deck.md]
  agentdeck adapt [deck.md] --scenario media|pitch|keynote|course|bid|launch-campaign [--out deck.md]
  agentdeck lint [deck.md]
  agentdeck doctor
  agentdeck compat swiss-locked <index.html> [--strict] [--visual]
  agentdeck import-swiss-locked <index.html> [--out deck.md]
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
    if (command === "wrap-html") return commandWrapHtml(rest);
    if (command === "skills") return commandSkills(rest);
    if (command === "classify") return commandClassify(rest);
    if (command === "adapt") return commandAdapt(rest);
    if (command === "dev") return commandDev(rest);
    if (command === "doctor") return commandDoctor();
    if (command === "compat") return commandCompat(rest);
    if (command === "import-swiss-locked") return commandImportSwissLocked(rest);

    console.error(`Unknown command: ${command}\n`);
    console.error(help);
    return { code: 2 };
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return { code: 1 };
  }
}

function commandWrapHtml(args: string[]): CliResult {
  const options = parseArgs(args);
  const file = options.positionals[0];
  if (!file) {
    console.error('Usage: agentdeck wrap-html <index.html> [--out dist] [--title "Deck title"]');
    return { code: 2 };
  }
  const htmlPath = resolve(file);
  const outDir = resolve(String(options.flags.out ?? "dist"));
  const sourceDir = dirname(htmlPath);
  const assetReport: Array<{ src: string; resolved?: string; bytes?: number; inlined: boolean; warning?: string }> = [];
  const imported = importExternalHtmlDeck(readFileSync(htmlPath, "utf8"), {
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

function commandSkills(args: string[]): CliResult {
  const [subcommand, ...rest] = args;
  const options = parseArgs(rest);
  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    console.log(`AgentDeck third-party PPT skill helpers

Usage:
  agentdeck skills list
  agentdeck skills detect
  agentdeck skills recommend <file|brief> [--agent codex|claude|any]
  agentdeck skills install <skill-id> [--yes]

These commands only recommend, detect, or install external skills after user confirmation.
AgentDeck does not own the third-party skill's visual system, templates, or generation logic.`);
    return { code: 0 };
  }

  if (subcommand === "list") {
    for (const skill of listPptSkills()) {
      console.log(`${skill.id}`);
      console.log(`  name: ${skill.name}`);
      console.log(`  author: ${skill.author}`);
      console.log(`  repo: ${skill.repo}`);
      console.log(`  license: ${skill.license}`);
      console.log(`  output: ${skill.output}`);
      console.log(`  best for: ${skill.bestFor.join(" / ")}`);
      console.log(`  install: ${skill.install.map((install) => shellCommand(install.command)).join(" OR ")}`);
      console.log("");
    }
    return { code: 0 };
  }

  if (subcommand === "detect") {
    const installed = detectInstalledPptSkills();
    const known = installed.filter((skill) => skill.registry);
    if (!known.length) {
      console.log(`Found ${installed.length} installed skill folder(s), but no known PPT skills.`);
      console.log("Searched .agents/skills, .claude/skills, ~/.agents/skills, ~/.codex/skills, and ~/.claude/skills.");
      return { code: 3 };
    }
    console.log(`Found ${known.length} known PPT skill(s) out of ${installed.length} installed skill folder(s):`);
    for (const skill of known) {
      console.log(`- ${skill.name} (${skill.path}) by ${skill.registry?.author}`);
    }
    if (known.length > 1) {
      console.log("Multiple known PPT skills are installed. Ask the user to choose before generating the deck.");
      return { code: 3 };
    }
    console.log("One known PPT skill is installed. It can be used directly after confirming the source and license boundary.");
    return { code: 0 };
  }

  if (subcommand === "recommend") {
    const input = options.positionals.join(" ") || undefined;
    const recommendation = recommendPptSkill(input, { agent: stringFlag(options.flags.agent) });
    console.log(`Route: ${recommendation.route}`);
    console.log(`Source kind: ${recommendation.sourceKind}`);
    if (recommendation.installed.length) {
      console.log("Installed PPT skills:");
      recommendation.installed.forEach((skill) => console.log(`- ${skill.name} (${skill.path})`));
    } else {
      console.log("Installed PPT skills: none detected");
    }
    if (recommendation.primary) {
      console.log(`Recommended: ${recommendation.primary.name}`);
      console.log(`Author: ${recommendation.primary.author}`);
      console.log(`Repo: ${recommendation.primary.repo}`);
      console.log(`License: ${recommendation.primary.license}`);
      console.log(`Attribution: ${recommendation.primary.attribution}`);
    }
    if (recommendation.alternatives.length) {
      console.log("Alternatives:");
      recommendation.alternatives.forEach((skill) => console.log(`- ${skill.name} by ${skill.author}`));
    }
    console.log("Reasons:");
    recommendation.reasons.forEach((reason) => console.log(`- ${reason}`));
    console.log("Next steps:");
    recommendation.nextSteps.forEach((step) => console.log(`- ${step}`));
    if (recommendation.needsUserChoice) console.log("User choice required before generation.");
    return { code: recommendation.needsUserChoice ? 3 : 0 };
  }

  if (subcommand === "install") {
    const id = options.positionals[0];
    if (!id) {
      console.error("Usage: agentdeck skills install <skill-id> [--yes]");
      return { code: 2 };
    }
    const result = installPptSkill(id, { yes: Boolean(options.flags.yes), method: stringFlag(options.flags.method) });
    console.log(result.message);
    return { code: result.code };
  }

  console.error(`Unknown skills command: ${subcommand}`);
  return { code: 2 };
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

function commandClassify(args: string[]): CliResult {
  const deck = loadDeck(args[0] ?? "deck.md");
  const result = classifyDeckScenario(deck);
  console.log(JSON.stringify(result, null, 2));
  return { code: result.needsConfirmation ? 3 : 0 };
}

function commandAdapt(args: string[]): CliResult {
  const options = parseArgs(args);
  const deckPath = resolve(options.positionals[0] ?? "deck.md");
  const scenario = stringFlag(options.flags.scenario) as ScenarioId | undefined;
  if (!scenario) {
    throw new Error("Usage: agentdeck adapt <deck.md> --scenario media|pitch|keynote|course|bid|launch-campaign [--out deck.md]");
  }
  const definition = getScenarioDefinition(scenario);
  const source = readFileSync(deckPath, "utf8");
  const out = resolve(String(options.flags.out ?? deckPath));
  const adaptation = adaptDeckMarkdownToScenario(source, scenario, deckPath);
  writeFileSync(out, adaptation.markdown, "utf8");
  console.log(`Adapted ${deckPath} to scenario ${definition.id} (${definition.title})`);
  console.log(`Generated ${adaptation.slideCount} slide(s): ${adaptation.insertedBeats.join(" / ")}`);
  console.log(`Wrote ${out}`);
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
  const checks = [
    ["Node", process.version],
    ["Working directory", process.cwd()],
    ["Playwright", hasNodeModule("playwright") ? "available" : "not installed; export will ask for it"],
  ];
  for (const [name, value] of checks) console.log(`${name}: ${value}`);
  return { code: 0 };
}

function commandCompat(args: string[]): CliResult {
  const options = parseArgs(args);
  const [target, file] = options.positionals;
  if (target !== "swiss-locked" || !file) {
    console.error("Usage: agentdeck compat swiss-locked <index.html> [--strict] [--visual]");
    return { code: 2 };
  }
  const html = readFileSync(resolve(file), "utf8");
  const report = inspectSwissLockedHtml(html, { visual: Boolean(options.flags.visual) });
  printDiagnostics(report.diagnostics);
  console.log(`Slides: ${report.slideCount}`);
  console.log(`Layouts: ${Object.entries(report.layoutCounts).map(([layout, count]) => `${layout}=${count}`).join(", ") || "none"}`);
  console.log(`Compatibility levels: ${report.levels.join(", ")}`);
  const hasWarnings = report.diagnostics.some((diagnostic) => diagnostic.level === "warning");
  return { code: hasErrors(report.diagnostics) || (Boolean(options.flags.strict) && hasWarnings) ? 1 : 0 };
}

function commandImportSwissLocked(args: string[]): CliResult {
  const options = parseArgs(args);
  const file = options.positionals[0];
  if (!file) {
    console.error("Usage: agentdeck import-swiss-locked <index.html> [--out deck.md]");
    return { code: 2 };
  }
  const html = readFileSync(resolve(file), "utf8");
  const result = importSwissLockedHtml(html, file);
  const out = resolve(String(options.flags.out ?? "deck.md"));
  writeFileSync(out, result.markdown, "utf8");
  console.log(`Imported ${result.slideCount} slide(s) into ${out}`);
  if (result.warnings.length) printDiagnostics(result.warnings);
  return { code: 0 };
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

第三方 Skill 负责内容与视觉，AgentDeck 负责单文件 HTML 播放器

# 核心边界
layout: statement
note: 明确 AgentDeck 的产品哲学

不替代 PPT Skill，不抢美化工作，只把各种 deck 变成可演示、可分享、可导出的单 HTML

# 两种入口
layout: steps
note: 用户可以从 Markdown 或已有 HTML 进入

- agentdeck build deck.md
- agentdeck wrap-html path/to/index.html
- 获得同一套增强播放能力

# 收束
layout: closing

- 尊重外部作者
- 兼容多种来源
- 一个 HTML 走天下
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
