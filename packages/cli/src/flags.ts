import type { FitMode, HtmlWrapStrategy, ImageFormat, ImageOutputOptions, OfficeBackendPreference, PackMode, ParsedArgs } from "./types.js";

export function parseArgs(args: string[]): ParsedArgs {
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

export function stringFlag(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function imageOutputOptions(flags: Record<string, string | boolean>): ImageOutputOptions {
  const maxOutputBytes = maxOutputBytesFlag(flags["max-output-mb"]);
  const sizeBudgetBytes = sizeBudgetFlag(flags["size-budget"]);
  return {
    fit: fitMode(flags.fit),
    format: imageFormat(flags["image-format"]),
    quality: qualityFlag(flags.quality),
    maxWidth: positiveIntegerFlag(flags["max-width"]),
    sizeBudgetBytes: sizeBudgetBytes ?? maxOutputBytes,
    maxOutputBytes,
    maxPages: positiveIntegerFlag(flags["max-pages"]),
    pack: packMode(flags.pack),
    thumbnailDpi: positiveIntegerFlag(flags["thumbnail-dpi"]) ?? 40,
  };
}

export function fitMode(value: string | boolean | undefined): FitMode {
  if (value === "width" || value === "height" || value === "cover" || value === "contain") return value;
  return "contain";
}

export function imageFormat(value: string | boolean | undefined): ImageFormat {
  if (value === "jpeg" || value === "webp" || value === "png") return value;
  if (value === "jpg") return "jpeg";
  return "png";
}

export function qualityFlag(value: string | boolean | undefined): number {
  if (typeof value !== "string") return 82;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 82;
  return Math.max(1, Math.min(100, Math.round(parsed)));
}

export function positiveIntegerFlag(value: string | boolean | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

export function sizeBudgetFlag(value: string | boolean | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(b|kb|mb)?$/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "b").toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  if (unit === "mb") return Math.round(amount * 1024 * 1024);
  if (unit === "kb") return Math.round(amount * 1024);
  return Math.round(amount);
}

export function maxOutputBytesFlag(value: string | boolean | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.round(parsed * 1024 * 1024);
}

export function packMode(value: string | boolean | undefined): PackMode {
  if (value === "folder" || value === "single-html") return value;
  return "single-html";
}

export function timeoutMsFlag(value: string | boolean | undefined, fallback = 120_000): number {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

export function htmlStrategy(value: string | boolean | undefined): HtmlWrapStrategy {
  if (value === "dom" || value === "raster" || value === "auto") return value;
  return "auto";
}

export function officeBackendPreference(value: string | boolean | undefined): OfficeBackendPreference {
  if (
    value === "auto" ||
    value === "libreoffice" ||
    value === "keynote" ||
    value === "quicklook-preview" ||
    value === "windows-powerpoint" ||
    value === "windows-word" ||
    value === "windows-excel"
  ) return value;
  return "auto";
}
