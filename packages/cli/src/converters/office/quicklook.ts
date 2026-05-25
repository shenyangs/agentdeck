import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, parse } from "node:path";
import { pathToFileURL } from "node:url";
import { findCommand } from "../../process/find-command.js";
import { loadPlaywright } from "../../process/playwright.js";
import { commandErrorMessage, commandOutput, runCommand } from "../../process/run-command.js";

export async function convertOfficeToPdfWithQuickLookPreview(sourcePath: string, outDir: string, timeoutMs = 120_000): Promise<string> {
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

export function findQuickLookPreviewHtml(rootDir: string): string | undefined {
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
