import { describe, expect, it } from "vitest";
import { parseDeckMarkdown } from "./markdown.js";
import { classifyDeckScenario, getScenarioDefinition } from "./scenario.js";

describe("classifyDeckScenario", () => {
  it("detects launch campaign decks from product-event signals", () => {
    const deck = parseDeckMarkdown(`---
title: 系统级发布，不是常规活动
theme: swiss
---

# 主发布先定调，展会再体验
layout: statement

主发布负责战略定调和产品定调，行业展会负责展区体验、媒体传播、KOL 背书、视觉记忆点和每周共创。
`);

    const result = classifyDeckScenario(deck);
    expect(result.primary.id).toBe("launch-campaign");
    expect(result.needsConfirmation).toBe(false);
    expect(result.primary.variants).toContain("executive-briefing");
  });

  it("asks for confirmation when two scenarios are close", () => {
    const deck = parseDeckMarkdown(`---
title: 课程发布演讲
---

# 开场

这是一场面向老师和学生的课程演讲，需要教学目标、互动题、故事节奏和舞台讲稿。
`);

    const result = classifyDeckScenario(deck);
    expect(result.needsConfirmation).toBe(true);
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it("exposes scene packs for CLI adaptation", () => {
    const definition = getScenarioDefinition("bid");
    expect(definition.requiredBeats).toContain("响应矩阵");
    expect(definition.recommendedTheme).toBe("swiss");
  });
});
