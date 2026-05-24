import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "./index.js";

describe("runCli", () => {
  it("initializes, lints, and builds a deck", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-"));
    await expect(runCli(["init", dir, "--theme", "swiss"])).resolves.toMatchObject({ code: 0 });
    await expect(runCli(["lint", join(dir, "deck.md")])).resolves.toMatchObject({ code: 0 });
    await expect(runCli(["build", join(dir, "deck.md"), "--out", join(dir, "dist"), "--single-html"])).resolves.toMatchObject({ code: 0 });
    expect(readFileSync(join(dir, "dist", "index.html"), "utf8")).toContain("AgentDeck");
  });

  it("builds audience, presenter, creator, and rendered-file profile variants", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-mode-"));
    await runCli(["init", dir, "--theme", "swiss"]);
    await expect(runCli(["build", join(dir, "deck.md"), "--out", join(dir, "audience"), "--mode", "audience", "--profile", "rendered-file"])).resolves.toMatchObject({ code: 0 });
    await expect(runCli(["build", join(dir, "deck.md"), "--out", join(dir, "presenter"), "--mode", "presenter"])).resolves.toMatchObject({ code: 0 });
    await expect(runCli(["build", join(dir, "deck.md"), "--out", join(dir, "creator"), "--mode", "creator"])).resolves.toMatchObject({ code: 0 });

    const audienceHtml = readFileSync(join(dir, "audience", "index.html"), "utf8");
    const presenterHtml = readFileSync(join(dir, "presenter", "index.html"), "utf8");
    const creatorHtml = readFileSync(join(dir, "creator", "index.html"), "utf8");
    expect(audienceHtml).toContain('data-deck-mode="audience"');
    expect(audienceHtml).toContain('data-compat-profile="rendered-file"');
    expect(presenterHtml).toContain('data-deck-mode="presenter"');
    expect(creatorHtml).toContain("Deck Studio");
    expect(creatorHtml).toContain('data-action="overview"');
  });

  it("wraps a generic external HTML deck into the AgentDeck player", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-wrap-"));
    const source = join(dir, "external.html");
    writeFileSync(
      source,
      `<!doctype html>
<html>
      <head><title>Existing Deck</title><style>.slide{width:1920px;height:1080px;background:#111;color:#fff}</style></head>
  <body>
    <section class="slide"><h1>External Cover</h1></section>
    <section class="slide"><h2>External Detail</h2></section>
  </body>
</html>`,
      "utf8",
    );

    await expect(runCli(["wrap-html", source, "--out", join(dir, "dist")])).resolves.toMatchObject({ code: 0 });
    const html = readFileSync(join(dir, "dist", "index.html"), "utf8");
    expect(html).toContain('data-compat-profile="external-html"');
    expect(html).toContain('data-action="compare"');
    expect(html).toContain('data-action="play"');
    expect(html).toContain("External Cover");
    expect(html).toContain("Existing Deck");
  });

  it("supports wrap as the generic compatibility entry for HTML decks", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-wrap-generic-"));
    const source = join(dir, "deck.html");
    writeFileSync(source, `<!doctype html><title>Generic</title><section class="slide"><h1>One</h1></section>`, "utf8");

    await expect(runCli(["wrap", source, "--out", join(dir, "dist")])).resolves.toMatchObject({ code: 0 });
    const html = readFileSync(join(dir, "dist", "index.html"), "utf8");
    expect(html).toContain("Generic");
    expect(html).toContain('data-compat-profile="external-html"');
  });

  it("accepts browser file URLs for HTML wrapping", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-wrap-file-url-"));
    const source = join(dir, "deck.html");
    writeFileSync(source, `<!doctype html><title>File URL</title><section class="slide"><h1>One</h1></section>`, "utf8");

    await expect(runCli(["wrap", `file://${source}`, "--out", join(dir, "dist"), "--html-strategy", "dom"])).resolves.toMatchObject({ code: 0 });
    const html = readFileSync(join(dir, "dist", "index.html"), "utf8");
    expect(html).toContain("File URL");
    expect(html).toContain('data-compat-profile="external-html"');
  });
});
