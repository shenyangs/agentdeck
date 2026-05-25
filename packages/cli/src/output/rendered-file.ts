import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { DeckDocument } from "@agentdeck/schema";
import { loadPlaywright } from "../process/playwright.js";
import type { FitMode, ImageFormat, ImageOutputOptions, PackMode, RenderedPage } from "../types.js";
import { dataUrlBytes, imageFormatFromMime } from "../utils/images.js";
import { slugifyLocal } from "../utils/files.js";

export function renderedFileDeck(title: string, sourcePath: string, pages: Array<{ index: number; src: string }>, origin: "rendered-file" | "html-raster", fit: FitMode): DeckDocument {
  return {
    meta: {
      title,
      subtitle: `${origin === "html-raster" ? "Rasterized HTML" : "Rendered"} from ${basename(sourcePath)}`,
      author: "Source file",
      lang: "zh-CN",
      theme: "swiss",
      aspect: "16:9",
      outputs: ["html", "pdf", "png"],
      mode: "audience",
      variants: [],
      compatibility: "rendered-file",
      filenameStem: slugifyLocal(title),
      sourceStyles: renderedFileSourceStyles(fit),
    },
    slides: pages.map((page) => ({
      id: `page-${page.index}`,
      title: `Page ${page.index}`,
      layout: "html-import",
      blocks: [{ type: "html" as const, html: `<img class="ad-imported-page" src="${page.src}" alt="Page ${page.index}">`, source: sourcePath }],
      raw: "",
    })),
  };
}

export function renderedFileSourceStyles(fit: FitMode): string {
  const base = ".layout-html-import .ad-html-block{display:grid;place-items:center;background:#fff}.layout-html-import .ad-html-block img.ad-imported-page{display:block;background:#fff}";
  if (fit === "cover") return `${base}.layout-html-import .ad-html-block img.ad-imported-page{width:100%;height:100%;object-fit:cover}`;
  if (fit === "width") return `${base}.layout-html-import .ad-html-block img.ad-imported-page{width:100%;height:auto;max-height:none;object-fit:contain}`;
  if (fit === "height") return `${base}.layout-html-import .ad-html-block img.ad-imported-page{width:auto;height:100%;max-width:none;object-fit:contain}`;
  return `${base}.layout-html-import .ad-html-block img.ad-imported-page{width:100%;height:100%;object-fit:contain}`;
}

export function writeRenderedPageAssets(pages: RenderedPage[], outDir: string, pack: PackMode): RenderedPage[] {
  if (pack === "single-html") return pages;
  const assetsDir = join(outDir, "assets");
  mkdirSync(assetsDir, { recursive: true });
  return pages.map((page) => {
    const extension = page.format === "jpeg" ? "jpg" : page.format;
    const fileName = `page-${String(page.index).padStart(3, "0")}.${extension}`;
    const filePath = join(assetsDir, fileName);
    writeDataUrlFile(page.src, filePath);
    return {
      ...page,
      src: `assets/${fileName}`,
      fileName,
    };
  });
}

export function writeDataUrlFile(dataUrl: string, filePath: string): void {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) {
    writeFileSync(filePath, dataUrl, "utf8");
    return;
  }
  const header = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  const data = /;base64/i.test(header) ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload));
  writeFileSync(filePath, data);
}

export async function applyImageOutputOptions(pages: RenderedPage[], options: ImageOutputOptions): Promise<RenderedPage[]> {
  const needsCanvas = options.format !== "png" || Boolean(options.maxWidth);
  if (!needsCanvas) return pages;

  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  try {
    const converted: RenderedPage[] = [];
    for (const renderedPage of pages) {
      const result = await page.evaluate(
        async ({ src, format, quality, maxWidth }: { src: string; format: ImageFormat; quality: number; maxWidth?: number }) => {
          const image = new Image();
          image.decoding = "async";
          image.src = src;
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error("Image failed to load in canvas"));
          });
          const sourceWidth = image.naturalWidth || image.width;
          const sourceHeight = image.naturalHeight || image.height;
          const scale = maxWidth && sourceWidth > maxWidth ? maxWidth / sourceWidth : 1;
          const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
          const outputHeight = Math.max(1, Math.round(sourceHeight * scale));
          const canvas = document.createElement("canvas");
          canvas.width = outputWidth;
          canvas.height = outputHeight;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas 2D context unavailable");
          context.drawImage(image, 0, 0, outputWidth, outputHeight);
          const requestedMime = `image/${format}`;
          const dataUrl = canvas.toDataURL(requestedMime, format === "png" ? undefined : quality / 100);
          const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
          return { dataUrl, sourceWidth, sourceHeight, outputWidth, outputHeight, mime };
        },
        {
          src: renderedPage.src,
          format: options.format,
          quality: options.quality,
          maxWidth: options.maxWidth,
        },
      );
      converted.push({
        ...renderedPage,
        src: result.dataUrl,
        bytes: dataUrlBytes(result.dataUrl),
        sourceWidth: renderedPage.sourceWidth || result.sourceWidth,
        sourceHeight: renderedPage.sourceHeight || result.sourceHeight,
        outputWidth: result.outputWidth,
        outputHeight: result.outputHeight,
        format: imageFormatFromMime(result.mime),
        mime: result.mime,
      });
    }
    return converted;
  } finally {
    await browser.close();
  }
}
