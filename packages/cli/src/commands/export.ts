import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "../flags.js";
import { loadPlaywright } from "../process/playwright.js";
import type { BuildResult, CliResult } from "../types.js";
import { buildDeck } from "./build.js";

export async function commandExport(args: string[]): Promise<CliResult> {
  const options = parseArgs(args);
  const deckPath = options.positionals[0] ?? "deck.md";
  const outDir = resolve(String(options.flags.out ?? "dist"));
  const build = buildDeck(deckPath, outDir, true, {});
  const wanted = {
    pdf: Boolean(options.flags.pdf),
    png: Boolean(options.flags.png),
    longImage: Boolean(options.flags["long-image"]),
    grid9: Boolean(options.flags.grid9),
    socialPack: Boolean(options.flags["social-pack"]),
  };
  if (!wanted.pdf && !wanted.png && !wanted.longImage && !wanted.grid9 && !wanted.socialPack) {
    wanted.pdf = true;
    wanted.png = true;
  }

  await exportWithPlaywright(build, outDir, wanted);
  return { code: 0 };
}

export async function exportWithPlaywright(
  build: BuildResult,
  outDir: string,
  wanted: { pdf: boolean; png: boolean; longImage: boolean; grid9: boolean; socialPack: boolean },
): Promise<void> {
  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const url = pathToFileURL(build.htmlPath).toString();
  let freshCounter = 0;
  const freshUrl = (hash = "") => `${url}?agentdeck-export=${freshCounter += 1}${hash}`;

  try {
    await page.goto(freshUrl(), { waitUntil: "networkidle" });
    if (wanted.pdf) {
      await page.pdf({
        path: join(outDir, `${build.deck.meta.filenameStem}.pdf`),
        width: "1920px",
        height: "1080px",
        printBackground: true,
        landscape: true,
      });
      console.log(`Exported ${join(outDir, `${build.deck.meta.filenameStem}.pdf`)}`);
    }
    if (wanted.png) {
      const pngDir = join(outDir, "png");
      mkdirSync(pngDir, { recursive: true });
      for (let index = 0; index < build.deck.slides.length; index += 1) {
        await page.goto(freshUrl(`#/${index + 1}`), { waitUntil: "networkidle" });
        await page.locator(".ad-slide:not([hidden])").screenshot({ path: join(pngDir, `${String(index + 1).padStart(2, "0")}.png`) });
      }
      console.log(`Exported PNG slides to ${pngDir}`);
    }
    if (wanted.longImage) {
      await page.goto(freshUrl(), { waitUntil: "networkidle" });
      await page.evaluate(() => {
        document.querySelectorAll(".ad-slide").forEach((slide) => {
          (slide as HTMLElement).hidden = false;
          Object.assign((slide as HTMLElement).style, { position: "relative", display: "block" });
        });
        const scaled = document.querySelector("[data-scaled]") as HTMLElement | null;
        if (scaled) Object.assign(scaled.style, { transform: "none", height: "auto" });
        const stage = document.querySelector(".ad-stage") as HTMLElement | null;
        if (stage) Object.assign(stage.style, { position: "static", display: "block" });
        document.body.style.overflow = "visible";
      });
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.screenshot({ path: join(outDir, `${build.deck.meta.filenameStem}-long.png`), fullPage: true });
      console.log(`Exported ${join(outDir, `${build.deck.meta.filenameStem}-long.png`)}`);
    }
    if (wanted.grid9 || wanted.socialPack) {
      await page.goto(freshUrl(), { waitUntil: "networkidle" });
      await page.evaluate(() => {
        const slides = [...document.querySelectorAll(".ad-slide")].slice(0, 9) as HTMLElement[];
        const scaled = document.querySelector("[data-scaled]") as HTMLElement | null;
        if (!scaled) return;
        scaled.style.transform = "none";
        scaled.style.display = "grid";
        scaled.style.gridTemplateColumns = "repeat(3, 640px)";
        scaled.style.gridAutoRows = "360px";
        scaled.style.width = "1920px";
        scaled.style.height = "1080px";
        slides.forEach((slide) => {
          slide.hidden = false;
          Object.assign(slide.style, { position: "relative", width: "1920px", height: "1080px", transform: "scale(.333333)", transformOrigin: "top left" });
        });
      });
      const gridPath = join(outDir, wanted.socialPack ? "social-grid9.png" : `${build.deck.meta.filenameStem}-grid9.png`);
      await page.locator("[data-scaled]").screenshot({ path: gridPath });
      console.log(`Exported ${gridPath}`);
    }
    if (wanted.socialPack) {
      const socialDir = join(outDir, "social-pack");
      mkdirSync(socialDir, { recursive: true });
      await page.goto(freshUrl("#/1"), { waitUntil: "networkidle" });
      await page.locator(".ad-slide:not([hidden])").screenshot({ path: join(socialDir, "cover.png") });
      await page.goto(freshUrl(), { waitUntil: "networkidle" });
      await page.evaluate(() => {
        document.querySelectorAll(".ad-slide").forEach((slide) => {
          (slide as HTMLElement).hidden = false;
          Object.assign((slide as HTMLElement).style, { position: "relative", display: "block" });
        });
        const scaled = document.querySelector("[data-scaled]") as HTMLElement | null;
        if (scaled) Object.assign(scaled.style, { transform: "none", height: "auto" });
        const stage = document.querySelector(".ad-stage") as HTMLElement | null;
        if (stage) Object.assign(stage.style, { position: "static", display: "block" });
        document.body.style.overflow = "visible";
      });
      await page.screenshot({ path: join(socialDir, "long-image.png"), fullPage: true });
      console.log(`Exported social pack to ${socialDir}`);
    }
  } finally {
    await browser.close();
  }
}
