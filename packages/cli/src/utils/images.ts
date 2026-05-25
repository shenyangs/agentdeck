import type { ImageFormat, ImageOutputOptions, RenderedPage } from "../types.js";

export function pngDimensions(data: Buffer): { width: number; height: number } {
  if (data.length >= 24 && data.toString("ascii", 1, 4) === "PNG") {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  return { width: 0, height: 0 };
}

export function pageNumber(file: string): number {
  return Number(file.match(/-(\d+)\.png$/i)?.[1] ?? 0);
}

export function imageFormatFromMime(mime: string): ImageFormat {
  if (mime === "image/jpeg") return "jpeg";
  if (mime === "image/webp") return "webp";
  return "png";
}

export function dataUrlBytes(src: string): number {
  const comma = src.indexOf(",");
  if (comma === -1) return Buffer.byteLength(src);
  const header = src.slice(0, comma);
  const payload = src.slice(comma + 1);
  if (/;base64/i.test(header)) return Buffer.from(payload, "base64").byteLength;
  return Buffer.byteLength(decodeURIComponent(payload));
}

export function pageReportEntry(page: RenderedPage): Record<string, string | number> {
  return {
    index: page.index,
    bytes: page.bytes,
    sourceWidth: page.sourceWidth,
    sourceHeight: page.sourceHeight,
    outputWidth: page.outputWidth,
    outputHeight: page.outputHeight,
    format: page.format,
    mime: page.mime,
    ...(page.fileName ? { fileName: page.fileName } : {}),
  };
}

export function sizeBudgetWarnings(totalBytes: number, options: ImageOutputOptions): string[] {
  if (!options.sizeBudgetBytes || totalBytes <= options.sizeBudgetBytes) return [];
  return [`single HTML embedded images exceed size budget (${formatBytes(totalBytes)} > ${formatBytes(options.sizeBudgetBytes)})`];
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}mb`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}kb`;
  return `${bytes}b`;
}
