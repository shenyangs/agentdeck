import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDeckMarkdown } from "@agentdeck/schema";
import { renderStandaloneHtml, writeStandaloneHtmlFile } from "./static.js";

describe("renderStandaloneHtml", () => {
  it("renders a self-contained deck shell", () => {
    const deck = parseDeckMarkdown(`---
title: Demo
theme: swiss
---

# Cover

Hello
`);
    const html = renderStandaloneHtml(deck);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("data-export-page");
    expect(html).toContain('data-action="overview"');
    expect(html).toContain('data-action="play"');
    expect(html).toContain('aria-label="Start autoplay"');
    expect(html).toContain('data-play-icon="play"');
    expect(html).toContain('data-play-icon="pause" hidden');
    expect(html).toContain("Pause autoplay");
    expect(html).toContain('data-action="interval"');
    expect(html).not.toContain('data-action="seek"');
    expect(html).toContain('data-action="dock-autohide"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain(".ad-dock [aria-pressed=true]");
    expect(html).toContain(".ad-dock-zone{position:absolute;left:0;right:0;bottom:0;z-index:69;height:32px;pointer-events:none}");
    expect(html).toContain("body.is-dock-autohide .ad-dock-zone,body.is-fullscreen-toolbar-hidden .ad-dock-zone");
    expect(html).toContain("function revealDock()");
    expect(html).toContain("const dockRevealPx = 32");
    expect(html).toContain("function hideDockIfPointerLeft(event)");
    expect(html).toContain("cubic-bezier(.22,1,.36,1)");
    expect(html).toContain(".ad-dock button{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:32px;min-width:32px;padding:0 11px;border:0;border-radius:6px;outline:0");
    expect(html).toContain(".ad-dock button:hover,.ad-dock button:focus-visible,.ad-dock button.is-active");
    expect(html).toContain("dock?.addEventListener('pointerleave', () => scheduleDockHide(0, true))");
    expect(html).toContain("if (next) scheduleDockHide(0, true)");
    expect(html).toContain("dockZone?.addEventListener('pointermove'");
    expect(html).toContain("if (!document.body.classList.contains('is-dock-hidden')) return");
    expect(html).toContain("if (event.clientY < window.innerHeight - dockRevealPx) return");
    expect(html).toContain("if (event.clientY >= window.innerHeight - dockRevealPx) return");
    expect(html).toContain("hideDockIfPointerLeft(event)");
    expect(html).toContain("scheduleDockHide(isFullscreen() ? 1200 : 1600, true)");
    expect(html).toContain("if (shouldAutoHideDock()) scheduleDockHide(isFullscreen() ? 700 : 1200, true)");
    expect(html).not.toContain("document.addEventListener('keydown', (event) => {\n    activateDock();");
    expect(html).not.toContain("document.addEventListener('wheel', (event) => {\n    activateDock();");
    expect(html).toContain("document.addEventListener('fullscreenchange', syncFullscreenToolbar)");
    expect(html).toContain("is-fullscreen-toolbar-hidden");
    expect(html).toContain('data-color-mode="light"');
    expect(html).toContain('data-theme-value="light" class="is-active"');
    expect(html).toContain('data-action="compare"');
    expect(html).toContain('data-overlay="blackout"');
    expect(html).toContain('data-overlay="compare"');
    expect(html).toContain('data-overlay="print-help"');
    expect(html).toContain("Print / PDF");
    expect(html).toContain("Click a thumbnail to jump");
    expect(html).toContain('class="ad-overview-close"');
    expect(html).toContain('data-action="overview-close"');
    expect(html).toContain("Deck Studio");
    expect(html).toContain("@page{size:20in 11.25in;margin:0}");
    expect(html).toContain("print-color-adjust:exact");
    expect(html).toContain(".ad-dock,.ad-dock-zone,.ad-progress,.ad-overview,.ad-compare,.ad-print-help,.ad-blackout,.ad-spotlight,.ad-presenter-panel,.ad-creator-panel{display:none!important}");
    expect(html).toContain("break-after:page!important");
    expect(html).toContain("window.addEventListener('resize'");
  });

  it("can render imported raw HTML slides inside the same player", () => {
    const deck = parseDeckMarkdown(`---
title: Wrapped
theme: swiss
compatibility: external-html
---`);
    deck.meta.sourceStyles = ".external-slide{background:#123;color:white}";
    deck.slides = [
      {
        id: "external",
        title: "External",
        layout: "html-import",
        blocks: [{ type: "html", html: '<section class="external-slide"><h1>External deck</h1></section>' }],
        raw: "",
      },
    ];

    const html = renderStandaloneHtml(deck, { profile: "external-html" });
    expect(html).toContain('data-compat-profile="external-html"');
    expect(html).toContain("data-agentdeck-source-styles");
    expect(html).toContain("layout-html-import");
    expect(html).toContain("External deck");
  });

  it("can stream a single HTML file with embedded asset records", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-runtime-stream-"));
    const outputPath = join(dir, "index.html");
    const deck = parseDeckMarkdown(`---
title: Streamed
theme: swiss
compatibility: rendered-file
---`);
    deck.slides = [
      {
        id: "page-1",
        title: "Page 1",
        layout: "html-import",
        blocks: [{ type: "html", html: '<img class="ad-imported-page" data-agentdeck-asset="page-001" alt="Page 1">' }],
        raw: "",
      },
    ];

    await writeStandaloneHtmlFile(deck, outputPath, {
      embeddedAssets: [{ id: "page-001", mime: "image/png", payload: "ZmFrZQ==" }],
      includeSourceJson: false,
      profile: "rendered-file",
    });

    const html = readFileSync(outputPath, "utf8");
    expect(html).toContain('data-agentdeck-asset="page-001"');
    expect(html).toContain('type="application/octet-stream"');
    expect(html).toContain("data-agentdeck-asset-runtime");
    expect(html).toContain("asset.mime + ';base64,'");
    expect((html.match(/ZmFrZQ==/g) ?? []).length).toBe(1);
  });
});
