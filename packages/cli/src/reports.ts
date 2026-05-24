import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname } from "node:path";
import type { PackMode, PipelineAttempt, QualitySignals, ReportEnvironment, ReportOutput, ReportSource } from "./types.js";

export const REPORT_SCHEMA_VERSION = "1.0";
export const AGENTDECK_VERSION = "0.1.0";

export function reportSource(filePath: string, options: { debug?: boolean } = {}): ReportSource {
  const exists = existsSync(filePath);
  const bytes = exists ? statSync(filePath).size : 0;
  const data = exists ? readFileSync(filePath) : Buffer.alloc(0);
  return {
    path: options.debug ? filePath : basename(filePath),
    redacted: !options.debug,
    extension: extname(filePath).toLowerCase(),
    bytes,
    sha256: createHash("sha256").update(data).digest("hex"),
    detectedMime: mimeForPath(filePath),
  };
}

export function reportEnvironment(availableBackends: string[] = []): ReportEnvironment {
  return {
    os: process.platform,
    arch: process.arch,
    node: process.version,
    availableBackends,
  };
}

export function pipelineAttempt(input: {
  step: string;
  backend: string;
  status: PipelineAttempt["status"];
  durationMs?: number;
  errorCode?: string;
  message?: string;
}): PipelineAttempt {
  return {
    step: input.step,
    backend: input.backend,
    status: input.status,
    durationMs: input.durationMs ?? 0,
    errorCode: input.errorCode,
    message: input.message,
  };
}

export function defaultQualitySignals(warnings: string[] = []): QualitySignals {
  return {
    blankPages: [],
    pageCountMismatch: false,
    oversizedOutput: false,
    warnings,
  };
}

export function reportOutput(input: Partial<ReportOutput> & { packMode?: PackMode }): ReportOutput {
  return {
    htmlPath: input.htmlPath,
    bytes: input.bytes ?? 0,
    pageCount: input.pageCount ?? 0,
    packMode: input.packMode ?? "single-html",
    fidelity: input.fidelity ?? "unknown",
  };
}

export function writeJsonReport(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function mimeForPath(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".html" || ext === ".htm") return "text/html";
  if (ext === ".md") return "text/markdown";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".ppt") return "application/vnd.ms-powerpoint";
  if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".xls") return "application/vnd.ms-excel";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".key") return "application/vnd.apple.keynote";
  return "application/octet-stream";
}
