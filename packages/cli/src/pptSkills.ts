import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export type SkillAgent = "any" | "codex" | "claude";

export interface PptSkillInstall {
  label: string;
  command: string[];
  note?: string;
}

export interface PptSkillRegistryItem {
  id: string;
  name: string;
  author: string;
  repo: string;
  license: string;
  output: "html" | "pptx" | "image-first-pptx" | "mcp" | "design-harness";
  bestFor: string[];
  cautions: string[];
  keywords: string[];
  install: PptSkillInstall[];
  attribution: string;
}

export interface InstalledSkill {
  id?: string;
  name: string;
  path: string;
  registry?: PptSkillRegistryItem;
}

export interface SkillRecommendation {
  route: "wrap-existing-html" | "choose-third-party-skill";
  sourceKind: string;
  installed: InstalledSkill[];
  primary?: PptSkillRegistryItem;
  alternatives: PptSkillRegistryItem[];
  reasons: string[];
  nextSteps: string[];
  needsUserChoice: boolean;
}

export const pptSkillRegistry: PptSkillRegistryItem[] = [
  {
    id: "anthropic-pptx",
    name: "Anthropic 官方 PPTX Skill",
    author: "Anthropic",
    repo: "https://github.com/anthropics/skills",
    license: "See upstream repository",
    output: "pptx",
    bestFor: ["Claude Code / Claude.ai", "需要可编辑 .pptx", "稳妥保守的商务或报告型 PPT"],
    cautions: ["输出重点是 PPTX，不是 HTML deck；如需 AgentDeck 播放器，需要先导出或再生成 HTML"],
    keywords: ["claude", "pptx", "powerpoint", "可编辑", "商务", "报告"],
    install: [
      {
        label: "AgentSkills installer",
        command: ["npx", "skills", "add", "https://github.com/anthropics/skills", "--skill", "pptx"],
      },
    ],
    attribution: "Anthropic owns the PPTX skill and its generation logic. AgentDeck only recommends or wraps downstream output.",
  },
  {
    id: "openai-slides",
    name: "OpenAI 官方 Slides Skill",
    author: "OpenAI",
    repo: "https://github.com/openai/skills/tree/main/skills/.curated/slides",
    license: "See upstream repository",
    output: "pptx",
    bestFor: ["Codex / OpenAI 工具链", "需要可编辑 .pptx", "工程化、可验证的 PPTX 生成"],
    cautions: ["通常由 Codex/OpenAI 运行时提供；本 CLI 只做发现与建议，不把它复制进 AgentDeck"],
    keywords: ["codex", "openai", "pptx", "slides", "工程化", "验证"],
    install: [
      {
        label: "Manual source",
        command: ["open", "https://github.com/openai/skills/tree/main/skills/.curated/slides"],
        note: "Prefer the bundled OpenAI/Codex skill when your runtime already provides it.",
      },
    ],
    attribution: "OpenAI owns the Slides skill and its generation logic. AgentDeck only recommends or wraps downstream output.",
  },
  {
    id: "guizang-ppt-skill",
    name: "guizang-ppt-skill",
    author: "归藏 / @op7418",
    repo: "https://github.com/op7418/guizang-ppt-skill",
    license: "See upstream repository",
    output: "html",
    bestFor: ["中文自媒体 deck", "朋友圈 / 小红书 / 作品集", "横向滑动、杂志感、作品感 HTML"],
    cautions: ["视觉和模板属于归藏 / @op7418；AgentDeck 只做兼容 profile 与演示增强"],
    keywords: ["自媒体", "小红书", "朋友圈", "作品集", "中文", "杂志", "html", "guizang", "归藏"],
    install: [
      {
        label: "AgentSkills installer",
        command: ["npx", "skills", "add", "https://github.com/op7418/guizang-ppt-skill"],
      },
    ],
    attribution: "guizang-ppt-skill is created by 归藏 / @op7418. AgentDeck does not own its visual system.",
  },
  {
    id: "html-ppt-skill",
    name: "html-ppt-skill",
    author: "lewislulu",
    repo: "https://github.com/lewislulu/html-ppt-skill",
    license: "MIT",
    output: "html",
    bestFor: ["现场演讲", "逐字稿、计时器、下一页预览", "需要丰富主题、布局和动效的 HTML PPT"],
    cautions: ["它已有自己的演示模式；AgentDeck 适合作为统一封装、分发和额外播放增强层"],
    keywords: ["演讲", "presenter", "speaker", "逐字稿", "计时", "动效", "html", "现场"],
    install: [
      {
        label: "AgentSkills installer",
        command: ["npx", "skills", "add", "https://github.com/lewislulu/html-ppt-skill"],
      },
    ],
    attribution: "html-ppt-skill is created by lewislulu. AgentDeck only wraps or validates output when requested.",
  },
  {
    id: "frontend-slides",
    name: "frontend-slides",
    author: "zarazhangrui",
    repo: "https://github.com/zarazhangrui/frontend-slides",
    license: "See upstream repository",
    output: "html",
    bestFor: ["网页 slides", "不需要 PPTX 文件", "希望用前端能力直接做可演讲网页幻灯片"],
    cautions: ["安装方式可能取决于 Claude Code plugin/marketplace；使用前先看 upstream README"],
    keywords: ["网页", "前端", "slides", "html", "browser", "frontend"],
    install: [
      {
        label: "Claude Code plugin flow",
        command: ["/plugin", "marketplace", "add", "zarazhangrui/frontend-slides"],
        note: "Then run /plugin install frontend-slides@frontend-slides in Claude Code.",
      },
      {
        label: "Git clone",
        command: ["git", "clone", "https://github.com/zarazhangrui/frontend-slides.git"],
      },
    ],
    attribution: "frontend-slides is created by zarazhangrui. AgentDeck only wraps or validates output when requested.",
  },
  {
    id: "pptagent",
    name: "PPTAgent",
    author: "icip-cas",
    repo: "https://github.com/icip-cas/PPTAgent",
    license: "See upstream repository",
    output: "pptx",
    bestFor: ["学术答辩", "科研报告", "需要反思式生成框架的长材料"],
    cautions: ["偏研究和框架型；如需 HTML 播放器，先产出或转换为 HTML 再 wrap"],
    keywords: ["学术", "科研", "论文", "答辩", "研究", "PPTAgent"],
    install: [
      {
        label: "Git clone",
        command: ["git", "clone", "https://github.com/icip-cas/PPTAgent.git"],
      },
    ],
    attribution: "PPTAgent is created by icip-cas. AgentDeck does not own its generation framework.",
  },
  {
    id: "office-powerpoint-mcp",
    name: "Office-PowerPoint-MCP-Server",
    author: "GongRzhe",
    repo: "https://github.com/GongRzhe/Office-PowerPoint-MCP-Server",
    license: "See upstream repository",
    output: "mcp",
    bestFor: ["批量修改 PPT 模板", "已有 PPTX 的细粒度编辑", "替换 logo、placeholder、局部内容"],
    cautions: ["这是 MCP Server，不是端到端 HTML deck 生成 Skill"],
    keywords: ["批量", "模板", "logo", "placeholder", "编辑", "mcp", "pptx"],
    install: [
      {
        label: "Git clone",
        command: ["git", "clone", "https://github.com/GongRzhe/Office-PowerPoint-MCP-Server.git"],
      },
    ],
    attribution: "Office-PowerPoint-MCP-Server is created by GongRzhe. AgentDeck only routes users to it when appropriate.",
  },
  {
    id: "ppt-image-first",
    name: "ppt-image-first",
    author: "NyxTides",
    repo: "https://github.com/NyxTides/ppt-image-first",
    license: "See upstream repository",
    output: "image-first-pptx",
    bestFor: ["发布会", "营销页", "视觉密度高、内容少", "先看风格预览再定稿"],
    cautions: ["image-first 输出通常不是完全可编辑 PPT；适合展示型页面"],
    keywords: ["发布会", "营销", "视觉", "预览", "image-first", "风格"],
    install: [
      {
        label: "AgentSkills installer",
        command: ["npx", "skills", "add", "https://github.com/NyxTides/ppt-image-first"],
      },
    ],
    attribution: "ppt-image-first is created by NyxTides. AgentDeck does not own its image-first workflow.",
  },
  {
    id: "ppt-agent-skills",
    name: "ppt-agent-skills",
    author: "sunbigfly",
    repo: "https://github.com/sunbigfly/ppt-agent-skills",
    license: "See upstream repository",
    output: "pptx",
    bestFor: ["企业培训", "SOP deck", "需要流程化、分阶段、可审查生成"],
    cautions: ["偏工作流框架；如需 HTML 播放器，需要后续 HTML 化或 wrap 输出"],
    keywords: ["培训", "SOP", "流程", "审查", "企业", "workflow"],
    install: [
      {
        label: "AgentSkills installer",
        command: ["npx", "skills", "add", "https://github.com/sunbigfly/ppt-agent-skills"],
      },
    ],
    attribution: "ppt-agent-skills is created by sunbigfly. AgentDeck only recommends it as an external workflow.",
  },
  {
    id: "open-design",
    name: "open-design",
    author: "nexu-io",
    repo: "https://github.com/nexu-io/open-design",
    license: "See upstream repository",
    output: "design-harness",
    bestFor: ["主要做设计系统和多格式视觉资产", "PPT 只是整体设计工作流的一部分"],
    cautions: ["不是纯 PPT Skill；只为了做 PPT 时可能过重"],
    keywords: ["设计", "design", "prototype", "品牌", "视觉系统", "open-design"],
    install: [
      {
        label: "Git clone",
        command: ["git", "clone", "https://github.com/nexu-io/open-design.git"],
      },
    ],
    attribution: "open-design is created by nexu-io. AgentDeck does not absorb its design systems.",
  },
];

export function listPptSkills(): PptSkillRegistryItem[] {
  return pptSkillRegistry;
}

export function detectInstalledPptSkills(cwd = process.cwd()): InstalledSkill[] {
  const roots = skillRoots(cwd);
  const results: InstalledSkill[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    if (!existsSync(root) || !statSync(root).isDirectory()) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = join(root, entry.name);
      const skillPath = join(dir, "SKILL.md");
      if (!existsSync(skillPath)) continue;
      const registry = matchRegistrySkill(entry.name, safeRead(skillPath));
      const key = `${registry?.id ?? entry.name}:${dir}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        id: registry?.id,
        name: registry?.name ?? entry.name,
        path: dir,
        registry,
      });
    }
  }
  return results;
}

export function recommendPptSkill(input: string | undefined, options: { agent?: string; cwd?: string } = {}): SkillRecommendation {
  const cwd = options.cwd ?? process.cwd();
  const inputPath = input ? resolve(cwd, input) : undefined;
  const sourceKind = inputPath ? sourceKindFor(inputPath) : "brief";
  const installed = detectInstalledPptSkills(cwd).filter((skill) => skill.registry);
  const text = inputPath && existsSync(inputPath) && isReadableText(inputPath) ? safeRead(inputPath).slice(0, 20_000) : [input ?? "", sourceKind].join(" ");

  if (sourceKind === "html") {
    return {
      route: "wrap-existing-html",
      sourceKind,
      installed,
      alternatives: [],
      reasons: ["输入已经是 HTML deck，不需要先调用第三方 PPT Skill。"],
      nextSteps: [`agentdeck wrap-html ${input ?? "path/to/index.html"} --out dist`],
      needsUserChoice: false,
    };
  }

  const installedKnown = installed.map((skill) => skill.registry).filter(Boolean) as PptSkillRegistryItem[];
  const ranked = rankSkills(text, sourceKind, options.agent);
  const primary = installedKnown.length === 1 ? installedKnown[0] : ranked[0];
  const alternatives = ranked.filter((skill) => skill.id !== primary?.id).slice(0, 4);
  const reasons = reasonsFor(primary, sourceKind, text, installedKnown.length);
  const nextSteps = nextStepsFor(input, sourceKind, primary, installedKnown.length);

  return {
    route: "choose-third-party-skill",
    sourceKind,
    installed,
    primary,
    alternatives,
    reasons,
    nextSteps,
    needsUserChoice: installedKnown.length > 1 || !primary,
  };
}

export function installPptSkill(id: string, options: { yes?: boolean; method?: string } = {}): { code: number; message: string } {
  const skill = pptSkillRegistry.find((item) => item.id === id);
  if (!skill) return { code: 2, message: `Unknown PPT skill: ${id}` };
  const install = options.method ? skill.install.find((item) => item.label.toLowerCase().includes(options.method!.toLowerCase())) : skill.install[0];
  if (!install) return { code: 2, message: `No install method "${options.method}" for ${skill.name}` };
  const command = shellCommand(install.command);
  if (!options.yes) {
    return {
      code: 3,
      message: [
        `${skill.name} 是第三方 Skill，不属于 AgentDeck。`,
        `作者/维护者：${skill.author}`,
        `仓库：${skill.repo}`,
        `许可证：${skill.license}`,
        `安装命令：${command}`,
        "确认来源和许可证后，使用 --yes 才会执行安装命令。",
      ].join("\n"),
    };
  }
  const [bin, ...args] = install.command;
  const result = spawnSync(bin, args, { stdio: "inherit", shell: false });
  return {
    code: result.status ?? 1,
    message: result.status === 0 ? `Installed ${skill.name}` : `Install failed for ${skill.name}`,
  };
}

function skillRoots(cwd: string): string[] {
  const envRoots = process.env.AGENTDECK_SKILL_DIRS?.split(delimiter).filter(Boolean) ?? [];
  if (process.env.AGENTDECK_SKILL_DIRS) return envRoots.map((root) => resolve(cwd, root));
  return [
    join(cwd, ".agents", "skills"),
    join(cwd, ".claude", "skills"),
    join(homedir(), ".agents", "skills"),
    join(homedir(), ".codex", "skills"),
    join(homedir(), ".claude", "skills"),
  ];
}

function matchRegistrySkill(dirName: string, content: string): PptSkillRegistryItem | undefined {
  const source = normalize(`${dirName}\n${content.slice(0, 5000)}`);
  return pptSkillRegistry.find((skill) => {
    const repoName = skill.repo.split("/").pop() ?? skill.id;
    const candidates = [skill.id, skill.name, repoName].filter((value) => {
      const normalized = normalize(value).trim();
      return normalized.length > 8 && !["skills", "slides"].includes(normalized);
    });
    return candidates.some((value) => source.includes(normalize(value)));
  });
}

function rankSkills(text: string, sourceKind: string, agent?: string): PptSkillRegistryItem[] {
  const source = normalize(`${text} ${sourceKind} ${agent ?? ""}`);
  return [...pptSkillRegistry]
    .map((skill) => ({
      skill,
      score:
        skill.keywords.reduce((sum, keyword) => sum + (source.includes(normalize(keyword)) ? 3 : 0), 0) +
        sourceKindScore(skill, sourceKind) +
        agentScore(skill, agent),
    }))
    .sort((a, b) => b.score - a.score || preferredOrder(a.skill.id) - preferredOrder(b.skill.id))
    .map((item) => item.skill);
}

function sourceKindScore(skill: PptSkillRegistryItem, sourceKind: string): number {
  if (sourceKind === "markdown" && skill.output === "html") return 2;
  if (sourceKind === "pdf" && ["pptagent", "ppt-agent-skills", "ppt-image-first"].includes(skill.id)) return 3;
  if (sourceKind === "ppt" && ["office-powerpoint-mcp", "anthropic-pptx", "openai-slides"].includes(skill.id)) return 4;
  if (sourceKind === "document" && ["ppt-agent-skills", "pptagent", "anthropic-pptx", "openai-slides"].includes(skill.id)) return 3;
  return 0;
}

function agentScore(skill: PptSkillRegistryItem, agent?: string): number {
  if (agent === "claude" && skill.id === "anthropic-pptx") return 6;
  if (agent === "codex" && skill.id === "openai-slides") return 6;
  return 0;
}

function preferredOrder(id: string): number {
  return [
    "guizang-ppt-skill",
    "html-ppt-skill",
    "openai-slides",
    "anthropic-pptx",
    "frontend-slides",
    "pptagent",
    "ppt-image-first",
    "ppt-agent-skills",
    "office-powerpoint-mcp",
    "open-design",
  ].indexOf(id);
}

function reasonsFor(primary: PptSkillRegistryItem | undefined, sourceKind: string, text: string, installedCount: number): string[] {
  const reasons: string[] = [];
  if (installedCount === 1) reasons.push("本机只发现 1 个已安装的已知 PPT Skill，优先直接使用它。");
  if (installedCount > 1) reasons.push("本机发现多个已安装 PPT Skill，需要用户先选择，Agent 不应擅自切换视觉系统。");
  if (sourceKind !== "html") reasons.push(`${sourceKind} 输入需要先由第三方 PPT Skill 或 Agent 工作流生成 HTML deck，再交给 AgentDeck 包装。`);
  if (primary) reasons.push(`${primary.name} 适合：${primary.bestFor.join("；")}。`);
  if (/小红书|公众号|朋友圈|自媒体|作品集/.test(text)) reasons.push("内容命中自媒体/传播场景。");
  if (/演讲|逐字稿|计时|presenter|speaker/i.test(text)) reasons.push("内容命中现场演讲或演讲者辅助场景。");
  if (/学术|科研|论文|答辩/.test(text)) reasons.push("内容命中学术/科研报告场景。");
  return reasons;
}

function nextStepsFor(input: string | undefined, sourceKind: string, primary: PptSkillRegistryItem | undefined, installedCount: number): string[] {
  if (!primary) return ["先选择或配置一个第三方 PPT Skill。", "生成 HTML deck 后运行 agentdeck wrap-html path/to/index.html --out dist。"];
  const steps = [];
  if (installedCount === 0) steps.push(`确认第三方来源和许可证后，可运行：agentdeck skills install ${primary.id} --yes`);
  if (installedCount > 1) steps.push("从已安装 Skill 中选择一个；AgentDeck 不自动替你决定最终视觉系统。");
  steps.push(`用 ${primary.name} 把 ${input ?? "brief"} 生成 HTML deck 或可转换的演示文件。`);
  steps.push("生成 HTML 后运行：agentdeck wrap-html path/to/index.html --out dist");
  return steps;
}

function sourceKindFor(file: string): string {
  const ext = extname(file).toLowerCase();
  if ([".html", ".htm"].includes(ext)) return "html";
  if ([".md", ".markdown", ".txt"].includes(ext)) return "markdown";
  if ([".ppt", ".pptx"].includes(ext)) return "ppt";
  if (ext === ".pdf") return "pdf";
  if ([".doc", ".docx", ".rtf"].includes(ext)) return "document";
  return ext ? ext.slice(1) : "brief";
}

function isReadableText(file: string): boolean {
  return [".html", ".htm", ".md", ".markdown", ".txt"].includes(extname(file).toLowerCase());
}

function safeRead(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ");
}

export function shellCommand(command: string[]): string {
  return command.map((part) => (/[^\w@%+=:,./-]/.test(part) ? JSON.stringify(part) : part)).join(" ");
}
