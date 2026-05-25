import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { findCommand } from "../process/find-command.js";
import { pythonModuleAvailable } from "../process/python.js";
import { commandErrorMessage, runCommand } from "../process/run-command.js";
import { pipelineAttempt } from "../reports.js";
import type { PdfRenderResult, PipelineAttempt, RenderedPage } from "../types.js";
import { pageNumber, pngDimensions } from "../utils/images.js";

export function renderPdfToPngPages(pdfPath: string, outDir: string, dpi: number, options: { timeoutMs?: number; maxPages?: number } = {}): PdfRenderResult {
  const failures: string[] = [];
  const pipeline: PipelineAttempt[] = [];
  const timeoutMs = options.timeoutMs ?? 120_000;

  const pdftoppm = findCommand(["pdftoppm"]);
  if (pdftoppm) {
    try {
      clearRenderedPageFiles(outDir);
      const prefix = join(outDir, "page");
      const args = ["-png", "-r", String(dpi), ...(options.maxPages ? ["-f", "1", "-l", String(options.maxPages)] : []), pdfPath, prefix];
      const result = runCommand(pdftoppm, args, { timeoutMs });
      if (result.status !== 0) {
        throw new Error(commandErrorMessage(result, "unknown pdftoppm error"));
      }
      const pages = collectRenderedPageFiles(outDir);
      pipeline.push(pipelineAttempt({ step: "pdf-to-pages", backend: "pdftoppm", status: "success", durationMs: result.durationMs, message: `${pages.length} page(s)` }));
      return { backend: "pdftoppm", pages, pipeline };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pipeline.push(pipelineAttempt({ step: "pdf-to-pages", backend: "pdftoppm", status: "failed", errorCode: "pdf.renderer_failed", message }));
      failures.push(`pdftoppm: ${message}`);
    }
  }

  const pdftocairo = findCommand(["pdftocairo"]);
  if (pdftocairo) {
    try {
      clearRenderedPageFiles(outDir);
      const prefix = join(outDir, "page");
      const args = ["-png", "-r", String(dpi), ...(options.maxPages ? ["-f", "1", "-l", String(options.maxPages)] : []), pdfPath, prefix];
      const result = runCommand(pdftocairo, args, { timeoutMs });
      if (result.status !== 0) {
        throw new Error(commandErrorMessage(result, "unknown pdftocairo error"));
      }
      const pages = collectRenderedPageFiles(outDir);
      pipeline.push(pipelineAttempt({ step: "pdf-to-pages", backend: "pdftocairo", status: "success", durationMs: result.durationMs, message: `${pages.length} page(s)` }));
      return { backend: "pdftocairo", pages, pipeline };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pipeline.push(pipelineAttempt({ step: "pdf-to-pages", backend: "pdftocairo", status: "failed", errorCode: "pdf.renderer_failed", message }));
      failures.push(`pdftocairo: ${message}`);
    }
  }

  const python = findCommand(["python3"]);
  if (python && pythonModuleAvailable(python, "pypdfium2")) {
    try {
      clearRenderedPageFiles(outDir);
      const attempt = renderPdfWithPythonModule(python, "pypdfium2", pdfPath, outDir, dpi, { timeoutMs, maxPages: options.maxPages });
      const pages = collectRenderedPageFiles(outDir);
      pipeline.push(pipelineAttempt({ step: "pdf-to-pages", backend: "pypdfium2", status: "success", durationMs: attempt.durationMs, message: `${pages.length} page(s)` }));
      return { backend: "pypdfium2", pages, pipeline };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pipeline.push(pipelineAttempt({ step: "pdf-to-pages", backend: "pypdfium2", status: "failed", errorCode: "pdf.renderer_failed", message }));
      failures.push(`pypdfium2: ${message}`);
    }
  }

  if (python && pythonModuleAvailable(python, "pdf2image")) {
    try {
      clearRenderedPageFiles(outDir);
      const attempt = renderPdfWithPythonModule(python, "pdf2image", pdfPath, outDir, dpi, { timeoutMs, maxPages: options.maxPages });
      const pages = collectRenderedPageFiles(outDir);
      pipeline.push(pipelineAttempt({ step: "pdf-to-pages", backend: "pdf2image", status: "success", durationMs: attempt.durationMs, message: `${pages.length} page(s)` }));
      return { backend: "pdf2image", pages, pipeline };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pipeline.push(pipelineAttempt({ step: "pdf-to-pages", backend: "pdf2image", status: "failed", errorCode: "pdf.renderer_failed", message }));
      failures.push(`pdf2image: ${message}`);
    }
  }

  throw new Error(
    [
      "PDF rendering failed.",
      "Tried backends: pdftoppm, pdftocairo, pypdfium2, pdf2image.",
      failures.length ? failures.join("\n") : "No usable PDF renderer was found.",
    ].join("\n"),
  );
}

export function collectRenderedPageFiles(outDir: string): RenderedPage[] {
  const files = readdirSync(outDir)
    .filter((file) => /^page-\d+\.png$/i.test(file))
    .sort((a, b) => pageNumber(a) - pageNumber(b));
  if (!files.length) throw new Error("PDF rendering produced no pages.");
  return files.map((file, index) => {
    const imagePath = join(outDir, file);
    const data = readFileSync(imagePath);
    const dimensions = pngDimensions(data);
    return {
      index: index + 1,
      src: `data:image/png;base64,${data.toString("base64")}`,
      bytes: data.byteLength,
      sourceWidth: dimensions.width,
      sourceHeight: dimensions.height,
      outputWidth: dimensions.width,
      outputHeight: dimensions.height,
      format: "png",
      mime: "image/png",
    };
  });
}

export function clearRenderedPageFiles(outDir: string): void {
  for (const file of readdirSync(outDir)) {
    if (/^page-\d+\.png$/i.test(file)) rmSync(join(outDir, file), { force: true });
  }
}

export function renderPdfWithPythonModule(
  python: string,
  moduleName: "pypdfium2" | "pdf2image",
  pdfPath: string,
  outDir: string,
  dpi: number,
  options: { timeoutMs?: number; maxPages?: number } = {},
): { durationMs: number } {
  const script = moduleName === "pypdfium2"
    ? `
import sys
from pathlib import Path
import pypdfium2 as pdfium

pdf_path = Path(sys.argv[1])
out_dir = Path(sys.argv[2])
dpi = int(sys.argv[3])
max_pages = int(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] else 0
scale = dpi / 72.0
pdf = pdfium.PdfDocument(str(pdf_path))
for index, page in enumerate(pdf, start=1):
    if max_pages and index > max_pages:
        break
    bitmap = page.render(scale=scale)
    image = bitmap.to_pil()
    image.save(out_dir / f"page-{index}.png", "PNG")
print(len(pdf))
`
    : `
import sys
from pathlib import Path
from pdf2image import convert_from_path

pdf_path = Path(sys.argv[1])
out_dir = Path(sys.argv[2])
dpi = int(sys.argv[3])
max_pages = int(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] else 0
images = convert_from_path(str(pdf_path), dpi=dpi, first_page=1, last_page=max_pages or None)
for index, image in enumerate(images, start=1):
    image.save(out_dir / f"page-{index}.png", "PNG")
print(len(images))
`;
  const result = runCommand(python, ["-c", script, pdfPath, outDir, String(dpi), options.maxPages ? String(options.maxPages) : ""], { timeoutMs: options.timeoutMs ?? 120_000 });
  if (result.error) throw new Error(commandErrorMessage(result, `${moduleName} failed`));
  if (result.status !== 0) {
    throw new Error(commandErrorMessage(result, `${moduleName} failed`));
  }
  return { durationMs: result.durationMs };
}
