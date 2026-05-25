import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { formatDiagnostics, hasErrors, parseDeckMarkdown, validateDeck, type DeckDocument, type Diagnostic } from "@agentdeck/schema";
import { renderStandaloneHtml } from "@agentdeck/runtime";
import { parseArgs, stringFlag } from "../flags.js";
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
import { createDeckLock, resolveTemplateContext } from "../templates.js";
import type { BuildResult, CliResult } from "../types.js";
import { mimeFor } from "../utils/files.js";

export function commandBuild(args: string[]): CliResult {
  const options = parseArgs(args);
  const deckPath = options.positionals[0] ?? "deck.md";
  const outDir = resolve(String(options.flags.out ?? "dist"));
  const result = buildDeck(deckPath, outDir, Boolean(options.flags["single-html"] ?? true), {
    mode: stringFlag(options.flags.mode),
    profile: stringFlag(options.flags.profile),
  });
  console.log(`Built ${result.htmlPath}`);
  console.log(`Wrote ${result.assetReportPath}`);
  console.log(`Wrote ${result.deckLockPath}`);
  return { code: 0 };
}

export function commandLint(args: string[]): CliResult {
  const deckPath = resolve(args[0] ?? "deck.md");
  const deck = loadDeck(deckPath);
  const template = resolveTemplateContext(deck, deckPath);
  const diagnostics = [...template.diagnostics, ...validateDeck(deck, template.layouts, { template: template.pack })];
  printDiagnostics(diagnostics);
  return { code: hasErrors(diagnostics) ? 1 : 0 };
}

export function buildDeck(deckPathInput: string, outDir: string, singleHtml: boolean, renderOptions: { mode?: string; profile?: string }): BuildResult {
  const deckPath = resolve(deckPathInput);
  const deck = loadDeck(deckPath);
  const template = resolveTemplateContext(deck, deckPath);
  const diagnostics = [...template.diagnostics, ...validateDeck(deck, template.layouts, { template: template.pack })];
  if (hasErrors(diagnostics)) {
    printDiagnostics(diagnostics);
    throw new Error("Build stopped because deck validation failed.");
  }

  mkdirSync(outDir, { recursive: true });
  const assetEntries: Array<{ src: string; resolved?: string; bytes?: number; inlined: boolean; warning?: string }> = [];
  const html = renderStandaloneHtml(deck, {
    mode: renderOptions.mode as any,
    profile: renderOptions.profile,
    themeTokens: template.themeTokens,
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
  const deckLockPath = join(outDir, "deck.lock.json");
  writeFileSync(htmlPath, html, "utf8");
  writeJsonReport(deckLockPath, createDeckLock(deck, deckPath, template));
  writeJsonReport(assetReportPath, {
    schemaVersion: REPORT_SCHEMA_VERSION,
    agentdeckVersion: AGENTDECK_VERSION,
    source: reportSource(deckPath),
    environment: reportEnvironment(["markdown"]),
    pipeline: [
      pipelineAttempt({
        step: "template-contract",
        backend: template.pack ? "agentdeck-template-pack" : "built-in-theme",
        status: "success",
        message: template.pack ? `${template.pack.id} (${template.pack.layouts?.length ?? 0} layout(s))` : deck.meta.theme,
      }),
      pipelineAttempt({ step: "markdown-to-html", backend: "agentdeck-markdown", status: "success", message: `${deck.slides.length} slide(s)` }),
    ],
    output: reportOutput({
      htmlPath: "index.html",
      bytes: statSync(htmlPath).size,
      pageCount: deck.slides.length,
      packMode: singleHtml ? "single-html" : "folder",
      fidelity: "markdown",
    }),
    qualitySignals: defaultQualitySignals(assetEntries.flatMap((entry) => entry.warning ? [`${entry.src}: ${entry.warning}`] : [])),
    assets: assetEntries,
    deckLockPath: "deck.lock.json",
    template: template.pack ? {
      id: template.pack.id,
      name: template.pack.name,
      path: template.templatePath,
      strict: Boolean(template.pack.quality?.strict),
    } : undefined,
  });
  return { deck, htmlPath, assetReportPath, deckLockPath };
}

export function loadDeck(deckPathInput: string): DeckDocument {
  const deckPath = resolve(deckPathInput);
  if (!existsSync(deckPath)) throw new Error(`Deck file not found: ${deckPath}`);
  return parseDeckMarkdown(readFileSync(deckPath, "utf8"), deckPath);
}

export function printDiagnostics(diagnostics: Diagnostic[]): void {
  console.log(formatDiagnostics(diagnostics));
}
