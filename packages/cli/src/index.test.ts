import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

  it("classifies and adapts scenario metadata", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-scenario-"));
    const deckPath = join(dir, "deck.md");
    writeFileSync(
      deckPath,
      `---
title: 产品发布节奏复盘
theme: editorial
---

# 发布与展会体验分工
layout: statement

主发布负责战略定调，行业展会负责体验、媒体传播、客户反馈和产品共创。
`,
      "utf8",
    );

    await expect(runCli(["classify", deckPath])).resolves.toMatchObject({ code: 3 });
    await expect(runCli(["adapt", deckPath, "--scenario", "launch-campaign"])).resolves.toMatchObject({ code: 0 });
    const adapted = readFileSync(deckPath, "utf8");
    expect(adapted).toContain("scenario: launch-campaign");
    expect(adapted).toContain("compatibility: swiss-locked");
    expect(adapted).toContain("outputs: [html, pdf, png, long-image, grid9, social-pack]");
  });

  it("builds audience, presenter, creator, and swiss locked profile variants", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-mode-"));
    await runCli(["init", dir, "--theme", "swiss"]);
    await expect(runCli(["build", join(dir, "deck.md"), "--out", join(dir, "audience"), "--mode", "audience", "--profile", "swiss-locked"])).resolves.toMatchObject({ code: 0 });
    await expect(runCli(["build", join(dir, "deck.md"), "--out", join(dir, "presenter"), "--mode", "presenter"])).resolves.toMatchObject({ code: 0 });
    await expect(runCli(["build", join(dir, "deck.md"), "--out", join(dir, "creator"), "--mode", "creator"])).resolves.toMatchObject({ code: 0 });

    const audienceHtml = readFileSync(join(dir, "audience", "index.html"), "utf8");
    const presenterHtml = readFileSync(join(dir, "presenter", "index.html"), "utf8");
    const creatorHtml = readFileSync(join(dir, "creator", "index.html"), "utf8");
    expect(audienceHtml).toContain('data-deck-mode="audience"');
    expect(audienceHtml).toContain('data-compat-profile="swiss-locked"');
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
  <head><title>Partner Skill Deck</title><style>.slide{width:1920px;height:1080px;background:#111;color:#fff}</style></head>
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
    expect(html).toContain("Partner Skill Deck");
  });

  it("lists, detects, and recommends third-party PPT skills", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentdeck-skills-"));
    const skillsDir = join(dir, "skills");
    const guizangDir = join(skillsDir, "guizang-ppt-skill");
    mkdirSync(guizangDir, { recursive: true });
    writeFileSync(
      join(guizangDir, "SKILL.md"),
      `---
name: guizang-ppt-skill
---

归藏（@op7418）出品的 HTML PPT skill.
`,
      "utf8",
    );

    const previous = process.env.AGENTDECK_SKILL_DIRS;
    process.env.AGENTDECK_SKILL_DIRS = skillsDir;
    try {
      await expect(runCli(["skills", "list"])).resolves.toMatchObject({ code: 0 });
      await expect(runCli(["skills", "detect"])).resolves.toMatchObject({ code: 0 });
      await expect(runCli(["skills", "recommend", "自媒体 小红书 观点卡 deck"])).resolves.toMatchObject({ code: 0 });
      await expect(runCli(["skills", "install", "guizang-ppt-skill"])).resolves.toMatchObject({ code: 3 });
    } finally {
      if (previous === undefined) delete process.env.AGENTDECK_SKILL_DIRS;
      else process.env.AGENTDECK_SKILL_DIRS = previous;
    }
  });
});
