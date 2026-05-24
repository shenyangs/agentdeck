import { describe, expect, it } from "vitest";
import { importExternalHtmlDeck } from "./index.js";

describe("importExternalHtmlDeck", () => {
  it("wraps generic HTML slides without requiring a branded profile", () => {
    const result = importExternalHtmlDeck(`
      <title>External HTML Output</title>
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

  it("falls back to wrapping the body when no slide containers are found", () => {
    const result = importExternalHtmlDeck(`<html><body><main><h1>One Page</h1></main></body></html>`);

    expect(result.slideCount).toBe(1);
    expect(result.warnings.map((warning) => warning.code)).toContain("compat.external_html.slides.fallback");
  });
});
