import { describe, expect, it } from "vitest";
import { parseDeckMarkdown } from "./markdown.js";
import { validateDeck } from "./validate.js";

describe("parseDeckMarkdown", () => {
  it("parses frontmatter, directives, notes, and markdown blocks", () => {
    const deck = parseDeckMarkdown(`---
title: AI Agent 内容生产新工作流
theme: swiss
outputs: [html, pdf, grid9, social-pack]
mode: creator
variants: [executive-briefing, social-pack]
compatibility: rendered-file
---

# 为什么现在需要新的 slides 工具
layout: statement
note: 开场用一个强观点建立注意力

AI Agent 不缺写作能力，缺的是可验证的视觉生产协议

# 三步走

- 写 brief
- 生成 deck.md
- 通过 lint
`);

    expect(deck.meta.theme).toBe("swiss");
    expect(deck.meta.outputs).toEqual(["html", "pdf", "grid9", "social-pack"]);
    expect(deck.meta.mode).toBe("creator");
    expect(deck.meta.variants).toEqual(["executive-briefing", "social-pack"]);
    expect(deck.meta.compatibility).toBe("rendered-file");
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides[0].layout).toBe("statement");
    expect(deck.slides[0].note).toContain("开场");
    expect(deck.slides[1].blocks[0]).toMatchObject({ type: "list" });
  });
});

describe("validateDeck", () => {
  it("reports unknown layouts when a registry is provided", () => {
    const diagnostics = validateDeck(parseDeckMarkdown("---\ntitle: Test\n---\n\n# Bad\nlayout: nope\n"), [
      {
        id: "cover",
        theme: "all",
        title: "Cover",
        purpose: "Cover",
        slots: [],
        contentLimits: {},
        exportSafe: { pdf: true, png: true, singleHtml: true },
        agentHints: [],
        compatibleWith: [],
      },
    ]);
    expect(diagnostics.some((diagnostic) => diagnostic.code === "slide.layout")).toBe(true);
  });
});
