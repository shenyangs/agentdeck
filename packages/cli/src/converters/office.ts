import { extname } from "node:path";
import { findCommand } from "../process/find-command.js";
import { pipelineAttempt } from "../reports.js";
import type { OfficeBackendPreference, OfficeConversionBackend, OfficeConversionResult, PipelineAttempt } from "../types.js";
import { convertPresentationToPdfWithKeynote } from "./office/keynote.js";
import { convertOfficeToPdfWithLibreOffice } from "./office/libreoffice.js";
import {
  availableOfficeBackends,
  describeCommandVersion,
  describeNativeOfficeFallbacks,
  describeOfficeConverter,
  describeTriedOfficeBackends,
  inspectOfficeInstallation,
  keynoteAvailable,
  quickLookPreviewAvailable,
  recommendedOfficeBackend,
  windowsOfficeBackendForExtension,
} from "./office/inspect.js";
import { convertOfficeToPdfWithQuickLookPreview } from "./office/quicklook.js";
import { convertOfficeToPdfWithWindowsOffice } from "./office/windows.js";

export {
  availableOfficeBackends,
  describeCommandVersion,
  describeNativeOfficeFallbacks,
  describeOfficeConverter,
  describeTriedOfficeBackends,
  inspectOfficeInstallation,
  keynoteAvailable,
  quickLookPreviewAvailable,
  recommendedOfficeBackend,
  windowsOfficeBackendForExtension,
};

export async function convertOfficeToPdf(
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
          recordFailure(pipeline, failures, "libreoffice", error);
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
        recordFailure(pipeline, failures, "keynote", error);
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
        recordFailure(pipeline, failures, "quicklook-preview", error);
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
          recordFailure(pipeline, failures, windowsBackend, error);
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

function recordFailure(pipeline: PipelineAttempt[], failures: string[], backend: OfficeConversionBackend, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  pipeline.push(pipelineAttempt({ step: "office-to-pdf", backend, status: "failed", errorCode: "office.converter_failed", message }));
  failures.push(`${backend}: ${message}`);
}
