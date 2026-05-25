import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveInputPath(input: string): string {
  if (input.startsWith("file://")) return fileURLToPath(input);
  return resolve(input);
}

export function mimeFor(file: string): string {
  const ext = extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".woff2") return "font/woff2";
  return "application/octet-stream";
}

export function resolveHtmlAsset(src: string, sourceDir: string, assetReport: Array<{ src: string; resolved?: string; bytes?: number; inlined: boolean; warning?: string }>): string {
  if (isExternalOrSpecialUrl(src)) return src;
  const [pathname, suffix = ""] = src.split(/(?=[?#])/);
  if (!pathname) return src;
  const source = resolve(sourceDir, pathname);
  if (!existsSync(source) || !statSync(source).isFile()) {
    assetReport.push({ src, inlined: false, warning: "missing" });
    return src;
  }
  const bytes = statSync(source).size;
  const data = readFileSync(source);
  assetReport.push({
    src,
    resolved: source,
    bytes,
    inlined: true,
    warning: bytes > 2_000_000 ? "large asset inlined; consider resizing" : undefined,
  });
  return `data:${mimeFor(source)};base64,${data.toString("base64")}${suffix}`;
}

export function isExternalOrSpecialUrl(src: string): boolean {
  return /^(?:https?:|data:|blob:|mailto:|tel:|javascript:|#|about:)/i.test(src) || src.startsWith("//");
}

export function hasNodeModule(name: string): boolean {
  const roots = [process.cwd(), dirname(process.execPath)];
  return roots.some((root) => existsSync(join(root, "node_modules", name)));
}

export function slugifyLocal(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "deck";
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
