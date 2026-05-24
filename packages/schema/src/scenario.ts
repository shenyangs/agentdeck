import type {
  DeckDocument,
  OutputFormat,
  ScenarioClassification,
  ScenarioDefinition,
  ScenarioId,
  ScenarioScore,
} from "./types.js";

export const scenarioDefinitions: Record<ScenarioId, ScenarioDefinition> = {
  media: {
    id: "media",
    title: "自媒体发布",
    purpose: "把观点拆成封面、观点卡、长图、九宫格与公众号头图。",
    keywords: ["自媒体", "小红书", "公众号", "长图", "九宫格", "观点卡", "金句", "传播", "爆点", "标题"],
    recommendedTheme: "editorial",
    recommendedOutputs: ["html", "png", "long-image", "grid9", "social-pack"],
    variants: ["social-pack", "article-deck"],
    requiredBeats: ["封面观点", "核心金句", "证据页", "传播引导"],
    layoutBias: ["cover", "statement", "quote", "evidence-grid", "closing"],
  },
  pitch: {
    id: "pitch",
    title: "创业者路演",
    purpose: "面向投资人讲清问题、方案、增长、商业模式与融资用途。",
    keywords: ["融资", "投资人", "路演", "市场", "商业模式", "增长", "竞品", "团队", "融资用途", "估值"],
    recommendedTheme: "launch",
    recommendedOutputs: ["html", "pdf", "png"],
    variants: ["investor-main", "appendix", "one-pager"],
    requiredBeats: ["问题", "方案", "市场", "产品", "增长", "商业模式", "团队", "融资用途"],
    layoutBias: ["cover", "statement", "kpi", "comparison", "timeline", "closing"],
  },
  keynote: {
    id: "keynote",
    title: "演说家演讲",
    purpose: "围绕钩子、故事弧和舞台节奏生成可讲的演讲 deck。",
    keywords: ["演讲", "演说", "舞台", "观众", "故事", "开场", "结尾", "Q&A", "演讲稿", "节奏"],
    recommendedTheme: "editorial",
    recommendedOutputs: ["html", "pdf", "png"],
    variants: ["stage-deck", "speaker-script", "qa-backup"],
    requiredBeats: ["开场钩子", "背景", "转折", "核心观点", "行动呼吁"],
    layoutBias: ["cover", "statement", "quote", "section", "closing"],
  },
  course: {
    id: "course",
    title: "教师讲课",
    purpose: "生成课堂讲授、练习、互动题和学生讲义。",
    keywords: ["课程", "教学", "老师", "学生", "知识点", "例题", "练习", "互动题", "讲义", "课后"],
    recommendedTheme: "course",
    recommendedOutputs: ["html", "pdf", "png"],
    variants: ["lecture", "handout", "quiz"],
    requiredBeats: ["教学目标", "知识点", "例题", "互动题", "练习"],
    layoutBias: ["cover", "section", "steps", "code", "checklist", "closing"],
  },
  bid: {
    id: "bid",
    title: "供应商讲标",
    purpose: "把招标要求、评分点、响应矩阵、方案和证据串成讲标材料。",
    keywords: ["讲标", "投标", "招标", "评分", "响应", "供应商", "实施计划", "风险", "案例", "需求矩阵"],
    recommendedTheme: "swiss",
    recommendedOutputs: ["html", "pdf", "png"],
    variants: ["bid-presentation", "judge-brief", "appendix"],
    requiredBeats: ["评分点", "响应矩阵", "方案架构", "实施计划", "风险假设", "案例证明"],
    layoutBias: ["cover", "table", "diagram", "timeline", "evidence-grid", "closing"],
  },
  "launch-campaign": {
    id: "launch-campaign",
    title: "发布会战役",
    purpose: "围绕战略定调、发布会/展会分工、传播背书、视觉记忆点与周节奏共创。",
    keywords: ["发布会", "发布", "展会", "媒体", "KOL", "传播", "背书", "品牌", "场地", "视觉", "产品定调", "共创", "PPT", "战役", "展区", "体验"],
    recommendedTheme: "swiss",
    recommendedOutputs: ["html", "pdf", "png", "long-image", "grid9", "social-pack"],
    variants: ["executive-briefing", "launch-plan", "social-pack"],
    requiredBeats: ["战略定调", "发布会/展会分工", "有效背书", "视觉记忆点", "品牌架构", "周节奏"],
    layoutBias: ["cover", "statement", "comparison", "kpi", "timeline", "evidence-grid", "closing"],
  },
};

export function classifyDeckScenario(deck: DeckDocument): ScenarioClassification {
  const source = deckToSearchText(deck);
  const scores = Object.values(scenarioDefinitions)
    .map((definition) => scoreScenario(definition, source))
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  const primary = scores[0];
  const alternatives = scores.slice(1, 4);
  const second = alternatives[0];
  const needsConfirmation = primary.confidence < 0.72 || (second ? primary.confidence - second.confidence < 0.12 : false);

  return {
    primary,
    alternatives,
    needsConfirmation,
    reason: needsConfirmation
      ? "场景信号接近或置信度不足，需要用户确认后再重排。"
      : `命中 ${primary.matched.slice(0, 5).join("、")}，建议使用 ${primary.title}。`,
  };
}

export function getScenarioDefinition(id: ScenarioId): ScenarioDefinition {
  return scenarioDefinitions[id];
}

function scoreScenario(definition: ScenarioDefinition, source: string): ScenarioScore {
  const matched = definition.keywords.filter((keyword) => source.includes(keyword.toLowerCase()));
  const score = matched.reduce((sum, keyword) => sum + Math.min(3, Math.max(1, Math.ceil(keyword.length / 3))), 0);
  const normalized = Math.min(1, score / 12);
  const confidence = Number((0.15 + normalized * 0.85).toFixed(2));
  return {
    id: definition.id,
    title: definition.title,
    score,
    confidence,
    matched,
    requiredBeats: definition.requiredBeats,
    variants: definition.variants,
  };
}

function deckToSearchText(deck: DeckDocument): string {
  const meta = [deck.meta.title, deck.meta.subtitle, deck.meta.audience, deck.meta.scenario].filter(Boolean).join(" ");
  const slides = deck.slides
    .map((slide) => [slide.title, slide.note, slide.blocks.map((block) => ("text" in block ? block.text : "items" in block ? block.items.join(" ") : "")).join(" ")].filter(Boolean).join(" "))
    .join(" ");
  return `${meta} ${slides}`.toLowerCase();
}
