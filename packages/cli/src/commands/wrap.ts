import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { convertOfficeToPdf } from "../converters/office.js";
import { officeBackendPreference, parseArgs, timeoutMsFlag } from "../flags.js";
import type { CliResult } from "../types.js";
import { resolveInputPath } from "../utils/files.js";
import { commandWrapHtml } from "./wrap-html.js";
import { commandWrapRenderedFile } from "./wrap-rendered.js";

export { commandWrapHtml } from "./wrap-html.js";

export async function commandWrap(args: string[]): Promise<CliResult> {
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
