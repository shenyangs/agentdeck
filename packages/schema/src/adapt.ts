import { parseDeckMarkdown } from "./markdown.js";
import { getScenarioDefinition } from "./scenario.js";
import type { DeckDocument, ScenarioDefinition, ScenarioId } from "./types.js";

interface AdaptedSlide {
  title: string;
  layout: string;
  note?: string;
  body?: string;
}

export interface ScenarioAdaptation {
  scenario: ScenarioId;
  markdown: string;
  slideCount: number;
  insertedBeats: string[];
}

export function adaptDeckMarkdownToScenario(source: string, scenario: ScenarioId, sourcePath?: string): ScenarioAdaptation {
  const deck = parseDeckMarkdown(source, sourcePath);
  const definition = getScenarioDefinition(scenario);
  const context = buildContext(deck);
  const slides = slidesForScenario(deck, definition, context);
  const markdown = renderAdaptedMarkdown(deck, definition, slides);

  return {
    scenario,
    markdown,
    slideCount: slides.length,
    insertedBeats: definition.requiredBeats,
  };
}

function slidesForScenario(deck: DeckDocument, definition: ScenarioDefinition, context: SourceContext): AdaptedSlide[] {
  switch (definition.id) {
    case "media":
      return mediaSlides(deck, context);
    case "pitch":
      return pitchSlides(deck, context);
    case "keynote":
      return keynoteSlides(deck, context);
    case "course":
      return courseSlides(deck, context);
    case "bid":
      return bidSlides(deck, context);
    case "launch-campaign":
      return launchCampaignSlides(deck, context);
  }
}

function mediaSlides(deck: DeckDocument, context: SourceContext): AdaptedSlide[] {
  const claim = pick(context, ["不等于", "不是", "需要", "缺", "判断"], fallbackClaim(deck));
  return [
    cover(deck, "自媒体传播版", "把一份复杂材料拆成封面、观点卡、长图和九宫格。"),
    {
      title: "封面观点",
      layout: "statement",
      note: "社媒首屏只保留一个强判断。",
      body: claim,
    },
    {
      title: "三张观点卡",
      layout: "cards",
      note: "用于小红书、朋友圈和公众号正文插图。",
      body: bullets([
        `观点 01：${shorten(claim, 42)}`,
        `观点 02：${shorten(pick(context, ["传播", "背书", "市场"], context.lines[1] ?? claim), 42)}`,
        `观点 03：${shorten(pick(context, ["节奏", "执行", "复盘"], context.lines[2] ?? claim), 42)}`,
      ]),
    },
    {
      title: "金句页",
      layout: "quote",
      note: "把长内容压成可截图转发的一句话。",
      body: `> ${shorten(claim, 64)}`,
    },
    {
      title: "证据与讨论切口",
      layout: "table",
      note: "让传播不只停留在态度，而是有证据和评论入口。",
      body: table(["切口", "素材", "转化动作"], [
        ["真实变化", shorten(pick(context, ["体验", "评测", "用户"], context.lines[0]), 34), "评论区提问"],
        ["权威判断", shorten(pick(context, ["媒体", "权威", "定调"], context.lines[1] ?? context.lines[0]), 34), "文章引用"],
        ["行动清单", shorten(pick(context, ["节奏", "每周", "执行"], context.lines[2] ?? context.lines[0]), 34), "收藏转发"],
      ]),
    },
    {
      title: "九宫格发布顺序",
      layout: "steps",
      note: "社媒包导出时按这个顺序裁切。",
      body: bullets(["封面强观点", "问题背景", "关键判断", "证据矩阵", "反常识金句", "行动清单", "评论引导", "长图承接", "收束 CTA"]),
    },
    closing(["封面负责停留", "观点卡负责转发", "长图负责讲透"]),
  ];
}

function pitchSlides(deck: DeckDocument, context: SourceContext): AdaptedSlide[] {
  return [
    cover(deck, "路演版", "把材料重排成投资人能快速判断的问题、方案、市场和增长叙事。"),
    {
      title: "问题：为什么现在必须解决",
      layout: "statement",
      note: "投资人首先听问题强度。",
      body: pick(context, ["问题", "不能", "缺", "痛点", "需要"], fallbackClaim(deck)),
    },
    {
      title: "方案：我们提供什么新解法",
      layout: "cards",
      note: "只保留三到四个可理解能力点。",
      body: bullets(preferredBullets(context, ["方案", "产品", "能力", "工具", "体验"], 4)),
    },
    {
      title: "市场窗口",
      layout: "kpi",
      note: "没有真实数字时，用待验证指标占位，后续由 Agent 补证据。",
      body: "::kpi Market Window | 待验证 | 用行业规模、预算迁移或用户行为变化补齐",
    },
    {
      title: "增长与商业化假设",
      layout: "comparison",
      note: "把增长路径和收费路径分开讲。",
      body: table(["增长路径", "商业化路径"], [
        [shorten(pick(context, ["传播", "用户", "客户"], context.lines[0]), 36), "订阅 / 服务 / 企业采购"],
        ["内容触达 -> 体验 -> 转化", "试点 -> 复购 -> 扩容"],
      ]),
    },
    {
      title: "竞争取舍",
      layout: "comparison",
      note: "不做全景竞品表，讲清取舍。",
      body: table(["我们坚持", "我们不做"], [
        ["自有品牌心智", "借友商短期话题"],
        ["真实体验背书", "堆数量型稿件"],
      ]),
    },
    {
      title: "融资用途 / 下一步资源",
      layout: "checklist",
      note: "如果不是融资 deck，也可用作资源申请页。",
      body: bullets(["产品验证", "渠道增长", "品牌传播", "关键岗位", "数据与视觉资产"]),
    },
    closing(["问题足够真", "方案足够聚焦", "资源使用可复盘"]),
  ];
}

function keynoteSlides(deck: DeckDocument, context: SourceContext): AdaptedSlide[] {
  const claim = pick(context, ["不是", "不能", "需要", "缺"], fallbackClaim(deck));
  return [
    cover(deck, "演讲版", "为舞台节奏重排：钩子、故事、转折、行动。"),
    {
      title: "开场钩子",
      layout: "statement",
      note: "开场 30 秒，用冲突句抓住观众。",
      body: claim,
    },
    {
      title: "故事背景",
      layout: "section",
      note: "交代为什么这件事现在变重要。",
      body: pick(context, ["过去", "现在", "发布", "重复"], context.lines[0]),
    },
    {
      title: "转折：真正的问题变了",
      layout: "quote",
      note: "用一句话制造舞台转折。",
      body: `> ${shorten(pick(context, ["可信", "记住", "风险", "变化"], claim), 70)}`,
    },
    {
      title: "三个核心观点",
      layout: "cards",
      note: "演讲中段只讲三件事。",
      body: bullets(preferredBullets(context, ["定调", "背书", "视觉", "品牌", "节奏"], 3)),
    },
    {
      title: "观众行动",
      layout: "steps",
      note: "把演讲收束到下一步动作。",
      body: bullets(["先确认一个主判断", "再设计真实体验", "最后用证据反复打磨"]),
    },
    {
      title: "Q&A 备用页",
      layout: "checklist",
      note: "演讲者模式下可作为备用页。",
      body: bullets(["为什么不是常规活动？", "为什么发布和展会要分工？", "传播效果如何衡量？", "品牌迁移如何避免认知割裂？"]),
    },
    closing(["一个判断", "一个故事", "一个行动"]),
  ];
}

function courseSlides(deck: DeckDocument, context: SourceContext): AdaptedSlide[] {
  return [
    cover(deck, "教学版", "把材料改写成课堂目标、知识点、例题、互动题和练习。"),
    {
      title: "教学目标",
      layout: "checklist",
      note: "教师开场先告诉学生学完能做什么。",
      body: bullets(["识别材料中的核心判断", "区分目标、策略和执行动作", "把复杂讨论改写成可复盘计划"]),
    },
    {
      title: "知识点 01：场景分工",
      layout: "section",
      note: "用原文中的双节点关系解释策略分工。",
      body: pick(context, ["分工", "发布", "展会", "体验"], context.lines[0]),
    },
    {
      title: "知识点 02：指标设计",
      layout: "table",
      note: "把传播指标讲成课堂可分析对象。",
      body: table(["旧指标", "新指标", "为什么"], [
        ["稿件篇数", "权威定调", "更能形成认知"],
        ["自媒体数量", "真实体验", "更能建立信任"],
        ["曝光汇总", "自发讨论", "更能验证传播质量"],
      ]),
    },
    {
      title: "课堂例题",
      layout: "steps",
      note: "让学生按步骤重排一段会议纪要。",
      body: bullets(["圈出强判断", "标出关键证据", "找出待决策事项", "改写成 5 页演示结构"]),
    },
    {
      title: "互动题",
      layout: "cards",
      note: "课堂现场投票或分组讨论。",
      body: bullets(["如果发布会和展会重复，应该删哪一段？", "传播 KPI 应该保留数量指标吗？", "品牌改名什么时候最危险？", "每周打磨 PPT 要看哪些材料？"]),
    },
    {
      title: "课后练习",
      layout: "checklist",
      note: "导出为学生讲义时保留。",
      body: bullets(["用自己的项目写一个场景分工表", "设计一组有效背书 KPI", "写出 3 页高管汇报大纲"]),
    },
    closing(["会拆判断", "会设指标", "会重排结构"]),
  ];
}

function bidSlides(deck: DeckDocument, context: SourceContext): AdaptedSlide[] {
  return [
    cover(deck, "讲标版", "把材料改写成评分点、响应矩阵、方案架构和实施计划。"),
    {
      title: "评分点映射",
      layout: "table",
      note: "评委先看是否响应关键要求。",
      body: table(["评分点", "响应策略", "证据材料"], [
        ["战略理解", shorten(pick(context, ["战略", "定调", "战役"], context.lines[0]), 32), "方案总览"],
        ["传播质量", shorten(pick(context, ["传播", "背书", "媒体"], context.lines[1] ?? context.lines[0]), 32), "KPI 矩阵"],
        ["执行保障", shorten(pick(context, ["每周", "节奏", "执行"], context.lines[2] ?? context.lines[0]), 32), "项目计划"],
      ]),
    },
    {
      title: "响应矩阵",
      layout: "comparison",
      note: "把客户要求和我们的交付对齐。",
      body: table(["客户要求", "我们的响应"], [
        ["避免重复投入", "发布会定调，展会体验"],
        ["提升传播可信度", "权威媒体、KOL、真实评测组合"],
        ["形成视觉记忆点", "场地、识别、社媒物料一体设计"],
      ]),
    },
    {
      title: "方案架构",
      layout: "diagram",
      note: "讲标时用结构图替代散点描述。",
      body: "```mermaid\ngraph LR\nA[战略定调] --> B[体验设计]\nB --> C[有效背书]\nC --> D[传播复用]\nD --> E[周节奏复盘]\n```",
    },
    {
      title: "实施计划",
      layout: "timeline",
      note: "按周说明项目可控。",
      body: bullets(["第 1 周：叙事和需求确认", "第 2 周：视觉与体验打样", "第 3 周：媒体与 KOL 材料", "第 4 周：讲稿、FAQ、风险复盘"]),
    },
    {
      title: "风险假设",
      layout: "checklist",
      note: "主动暴露风险，提升可信度。",
      body: bullets(["发布会和展会信息重复", "稿件数量掩盖传播质量", "品牌命名造成认知割裂", "视觉资产无法跨渠道复用"]),
    },
    {
      title: "案例证明",
      layout: "evidence-grid",
      note: "等待真实案例和截图补位。",
      body: bullets(["权威报道样例", "KOL 体验样例", "展区动线样例", "社媒长图样例"]),
    },
    closing(["逐项响应", "证据闭环", "风险前置"]),
  ];
}

function launchCampaignSlides(deck: DeckDocument, context: SourceContext): AdaptedSlide[] {
  return [
    cover(deck, "发布会战役版", "围绕战略定调、真实体验、传播背书和周节奏共创重排。"),
    {
      title: "系统级发布，不是常规活动",
      layout: "statement",
      note: "先把会议性质定清楚。",
      body: pick(context, ["战役", "常规", "发布会", "动作"], fallbackClaim(deck)),
    },
    {
      title: "主发布先定调，展会再体验",
      layout: "comparison",
      note: "避免两个节点重复讲同一套内容。",
      body: table(["主发布", "展会体验"], [
        ["战略发布和产品定调", "展区体验和二次发酵"],
        ["讲清主判断", "组织媒体、客户、产品经理体验"],
      ]),
    },
    {
      title: "传播 KPI 从数量转向有效背书",
      layout: "table",
      note: "把传播方案改成可复盘指标。",
      body: table(["背书类型", "判断标准", "交付物"], [
        ["权威媒体", "是否形成定调", "深度报道 / 观点文章"],
        ["头部 KOL", "是否给出可信判断", "真实体验 / 独立评价"],
        ["用户讨论", "是否自发扩散", "评论 / 转发 / 社群讨论"],
      ]),
    },
    {
      title: "视觉记忆点与场地策略",
      layout: "cards",
      note: "从科技感转向可识别、可传播。",
      body: bullets(preferredBullets(context, ["视觉", "场地", "标识", "主视觉", "舞台"], 4)),
    },
    {
      title: "品牌迁移要渐进进行",
      layout: "timeline",
      note: "解释能力品牌到助手品牌的迁移节奏。",
      body: bullets(["短期：保留既有能力品牌作为体系入口。", "中期：强化助手品牌作为核心体验入口。", "长期：逐步承接更多端内智能入口。", "原则：避免突然改名造成认知割裂。"]),
    },
    {
      title: "每周打磨演示稿",
      layout: "timeline",
      note: "把共创机制固定下来。",
      body: bullets(["第 1 周：叙事和产品定位", "第 2 周：Demo、案例和媒体口径", "第 3 周：视觉、场地和展区体验", "第 4 周：讲稿、FAQ 和备用页"]),
    },
    closing(["先定调，再体验", "少算篇数，多做背书", "每周打磨，直到市场记住"]),
  ];
}

interface SourceContext {
  lines: string[];
}

function buildContext(deck: DeckDocument): SourceContext {
  const lines: string[] = [];
  for (const slide of deck.slides) {
    if (slide.title) lines.push(slide.title);
    if (slide.note) lines.push(slide.note);
    for (const block of slide.blocks) {
      if ("text" in block) lines.push(block.text);
      if ("items" in block) lines.push(...block.items);
      if (block.type === "table") {
        lines.push(...block.headers);
        lines.push(...block.rows.flat());
      }
      if (block.type === "kpi") lines.push([block.label, block.value, block.detail].filter(Boolean).join(" "));
    }
  }
  return { lines: unique(lines.map(cleanLine).filter((line) => line.length > 0)).slice(0, 80) };
}

function renderAdaptedMarkdown(deck: DeckDocument, definition: ScenarioDefinition, slides: AdaptedSlide[]): string {
  const compatibility = definition.id === "launch-campaign" || definition.id === "bid" ? "swiss-locked" : "agentdeck";
  const lines = [
    "---",
    `title: ${deck.meta.title}`,
    `subtitle: ${definition.title} · ${definition.purpose}`,
    `author: ${deck.meta.author ?? "AgentDeck"}`,
    `lang: ${deck.meta.lang}`,
    `theme: ${definition.recommendedTheme}`,
    "aspect: 16:9",
    `outputs: [${definition.recommendedOutputs.join(", ")}]`,
    `scenario: ${definition.id}`,
    `audience: ${audienceFor(definition.id)}`,
    "mode: audience",
    `variants: [${definition.variants.join(", ")}]`,
    `compatibility: ${compatibility}`,
    "---",
    "",
  ];

  for (const slide of slides) {
    lines.push(`# ${slide.title}`);
    lines.push(`layout: ${slide.layout}`);
    if (slide.note) lines.push(`note: ${slide.note}`);
    lines.push("");
    if (slide.body) lines.push(slide.body.trim(), "");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function cover(deck: DeckDocument, label: string, note: string): AdaptedSlide {
  return {
    title: `${deck.meta.title} · ${label}`,
    layout: "cover",
    note,
    body: deck.meta.subtitle ?? note,
  };
}

function closing(items: string[]): AdaptedSlide {
  return {
    title: "收束",
    layout: "closing",
    note: "结束页只留下最重要的下一步。",
    body: bullets(items),
  };
}

function fallbackClaim(deck: DeckDocument): string {
  return deck.slides[1]?.title || deck.slides[0]?.title || deck.meta.title;
}

function pick(context: SourceContext, keywords: string[], fallback: string): string {
  return context.lines.find((line) => keywords.some((keyword) => line.toLowerCase().includes(keyword.toLowerCase()))) ?? fallback;
}

function preferredBullets(context: SourceContext, keywords: string[], count: number): string[] {
  const matched = context.lines.filter((line) => keywords.some((keyword) => line.toLowerCase().includes(keyword.toLowerCase())));
  return unique([...matched, ...context.lines]).slice(0, count).map((line) => shorten(line, 42));
}

function bullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function table(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function audienceFor(scenario: ScenarioId): string {
  const audiences: Record<ScenarioId, string> = {
    media: "followers",
    pitch: "investor",
    keynote: "audience",
    course: "students",
    bid: "evaluation-committee",
    "launch-campaign": "executive",
  };
  return audiences[scenario];
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[#>*\-\s]+/, "").trim();
}

function shorten(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
