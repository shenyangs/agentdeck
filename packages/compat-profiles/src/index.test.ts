import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { importExternalHtmlDeck, importSwissLockedHtml, inspectSwissLockedHtml, validateSwissLockedHtml } from "./index.js";

describe("validateSwissLockedHtml", () => {
  it("accepts registered S22 image slots", () => {
    const html = `<section class="slide" data-layout="S22"><div><img src="images/hero.jpg" data-image-slot="s22-hero-21x9" alt="hero"></div></section>`;
    expect(validateSwissLockedHtml(html)).toEqual([]);
  });

  it("rejects missing data-layout and SVG text", () => {
    const html = `<section class="slide"><svg><text>Label</text></svg></section>`;
    const diagnostics = validateSwissLockedHtml(html);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("compat.swiss_locked.layout.missing");
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("compat.swiss_locked.svg.text");
  });
});

describe("importSwissLockedHtml", () => {
  it("maps Swiss layouts into AgentDeck layouts", () => {
    const result = importSwissLockedHtml(`<title>Demo</title><section class="slide" data-layout="S15"><h2>Evidence</h2><p>Proof</p></section>`);
    expect(result.markdown).toContain("theme: swiss");
    expect(result.markdown).toContain("compatibility: swiss-locked");
    expect(result.markdown).toContain("layout: evidence-grid");
    expect(result.slideCount).toBe(1);
  });
});

describe("importExternalHtmlDeck", () => {
  it("wraps generic HTML slides without requiring a branded profile", () => {
    const result = importExternalHtmlDeck(`
      <title>External Skill Output</title>
      <style>.slide{background:#123;color:white}</style>
      <section class="slide"><h1>Opening</h1><p>External visual system</p></section>
      <section class="slide"><h2>Proof</h2><img src="images/proof.png"></section>
    `);

    expect(result.deck.meta.compatibility).toBe("external-html");
    expect(result.deck.meta.sourceStyles).toContain("background:#123");
    expect(result.deck.slides).toHaveLength(2);
    expect(result.deck.slides[0].layout).toBe("html-import");
    expect(result.deck.slides[0].blocks[0]).toMatchObject({ type: "html" });
  });
});

describe("Swiss locked fixtures", () => {
  it("accepts the registered Swiss 22 layout fixture at L3", () => {
    const html = readFileSync(join(import.meta.dirname, "../fixtures/swiss-locked-fixtures/swiss-22.html"), "utf8");
    const report = inspectSwissLockedHtml(html);
    expect(report.slideCount).toBe(24);
    expect(report.levels).toContain("L2-layout");
    expect(report.levels).toContain("L3-slot");
    expect(report.diagnostics.filter((diagnostic) => diagnostic.level === "error")).toEqual([]);
  });

  it("detects common Swiss locked mode violations", () => {
    const html = readFileSync(join(import.meta.dirname, "../fixtures/swiss-locked-fixtures/swiss-violations.html"), "utf8");
    const codes = inspectSwissLockedHtml(html).diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes).toContain("compat.swiss_locked.experimental");
    expect(codes).toContain("compat.swiss_locked.svg.text");
    expect(codes).toContain("compat.swiss_locked.s22.slot");
  });
});
