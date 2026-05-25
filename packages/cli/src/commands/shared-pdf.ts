import { findCommand } from "../process/find-command.js";
import { pythonModuleAvailable } from "../process/python.js";
import type { PdfRenderBackend } from "../types.js";
import { describeCommandVersion } from "../converters/office.js";

export function availablePdfRenderBackends(): PdfRenderBackend[] {
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

export function describePdfRenderers(availableBackends = availablePdfRenderBackends()): string {
  const backends = availableBackends.map((backend) => {
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
