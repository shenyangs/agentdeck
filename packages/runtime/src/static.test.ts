import { describe, expect, it } from "vitest";
import { parseDeckMarkdown } from "@agentdeck/schema";
import { renderStandaloneHtml } from "./static.js";

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
    expect(html).toContain("body.is-dock-autohide .ad-dock-zone,body.is-fullscreen-toolbar-hidden .ad-dock-zone");
    expect(html).toContain("cubic-bezier(.22,1,.36,1)");
    expect(html).toContain(".ad-dock button{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:32px;min-width:32px;padding:0 11px;border:0;border-radius:6px;outline:0");
    expect(html).toContain(".ad-dock button:hover,.ad-dock button:focus-visible,.ad-dock button.is-active");
    expect(html).toContain("scheduleDockHide(2000, true)");
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
});
