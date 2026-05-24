import { describe, expect, it } from "vitest";
import { adaptDeckMarkdownToScenario } from "./adapt.js";
import { parseDeckMarkdown } from "./markdown.js";

const source = `---
title: 系统级发布，不是常规活动
subtitle: 发布策略公开示例
theme: swiss
---

# 系统级发布，不是常规活动
layout: cover

发布不只是把产品讲完，而是要让市场记住这次能力升级的主判断。

# 主发布先定调，展会再体验
layout: statement

主发布完成战略发布和产品定调，行业展会组织媒体、客户、产品经理到展区体验。

# 传播不能只看数量
layout: statement

传播 KPI 要从稿件数量转向权威媒体、头部 KOL、真实体验评测和用户自发讨论。
`;

describe("adaptDeckMarkdownToScenario", () => {
  it("rewrites frontmatter and outline for a media pack", () => {
    const result = adaptDeckMarkdownToScenario(source, "media");
    const deck = parseDeckMarkdown(result.markdown);
    expect(deck.meta.scenario).toBe("media");
    expect(deck.meta.outputs).toContain("social-pack");
    expect(deck.slides.map((slide) => slide.title)).toContain("九宫格发布顺序");
    expect(result.markdown).toContain("金句页");
  });

  it("rewrites the same source into a bid deck", () => {
    const result = adaptDeckMarkdownToScenario(source, "bid");
    const deck = parseDeckMarkdown(result.markdown);
    expect(deck.meta.scenario).toBe("bid");
    expect(deck.meta.compatibility).toBe("swiss-locked");
    expect(deck.slides.map((slide) => slide.title)).toContain("评分点映射");
    expect(result.markdown).toContain("响应矩阵");
  });
});
