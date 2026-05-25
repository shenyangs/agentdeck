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
    expect(html).toContain('data-action="interval"');
    expect(html).not.toContain('data-action="seek"');
    expect(html).toContain('data-action="dock-autohide"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('data-color-mode="dark"');
    expect(html).toContain('data-theme-value="dark" class="is-active"');
    expect(html).toContain('data-action="compare"');
    expect(html).toContain('data-overlay="blackout"');
    expect(html).toContain('data-overlay="compare"');
    expect(html).toContain('data-overlay="print-help"');
    expect(html).toContain("Print / PDF");
    expect(html).toContain("Click a thumbnail to jump");
    expect(html).toContain('class="ad-overview-close"');
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
