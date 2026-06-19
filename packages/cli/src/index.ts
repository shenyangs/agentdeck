#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { commandBuild, commandLint } from "./commands/build.js";
import { commandDev, commandInit } from "./commands/basic.js";
import { commandDoctor } from "./commands/doctor.js";
import { commandExport } from "./commands/export.js";
import { commandProbe } from "./commands/probe.js";
import { commandTemplate } from "./commands/template.js";
import { commandVerify } from "./commands/verify.js";
import { commandWrap, commandWrapHtml } from "./commands/wrap.js";
import type { CliResult } from "./types.js";

const help = `AgentDeck

Usage:
  agentdeck init [dir] [--theme editorial|swiss|launch|course]
  agentdeck dev [deck.md]
  agentdeck build [deck.md] [--out dist] [--single-html] [--mode audience|presenter|creator] [--profile agentdeck|external-html|rendered-file]
  agentdeck export [deck.md] [--pdf] [--png] [--long-image] [--grid9] [--social-pack] [--out dist]
  agentdeck template init <dir> [--base-theme editorial|swiss|launch|course] [--force]
  agentdeck probe <input> [--json] [--out probe-report.json]
  agentdeck verify <dist/index.html> [--out verify-report.json] [--contact-sheet [contact-sheet.png]] [--contact-sheet-cols 4] [--contact-sheet-width 240]
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
    if (command === "template") return commandTemplate(rest);
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli().then((result) => {
    process.exitCode = result.code;
  });
}
