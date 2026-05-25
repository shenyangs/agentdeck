import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CliResult } from "../types.js";
import { escapeHtml } from "../utils/files.js";
import { loadDeck } from "./build.js";
import { parseArgs } from "../flags.js";

export function commandInit(args: string[]): CliResult {
  const options = parseArgs(args);
  const dir = resolve(options.positionals[0] ?? ".");
  const theme = String(options.flags.theme ?? "editorial");
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "assets"), { recursive: true });
  const deckPath = join(dir, "deck.md");
  if (existsSync(deckPath) && !options.flags.force) {
    throw new Error(`${deckPath} already exists. Pass --force to overwrite.`);
  }
  writeFileSync(deckPath, starterDeck(theme), "utf8");
  console.log(`Created ${deckPath}`);
  return { code: 0 };
}

export function commandDev(args: string[]): CliResult {
  const deckPath = resolve(args[0] ?? "deck.md");
  const deck = loadDeck(deckPath);
  const cacheDir = resolve(".agentdeck/dev");
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(join(cacheDir, "deck.json"), JSON.stringify(deck, null, 2), "utf8");
  writeFileSync(
    join(cacheDir, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(deck.meta.title)}</title></head><body><div id="root"></div><script>window.__AGENTDECK_DECK__=${JSON.stringify(deck)}</script><script type="module" src="/main.tsx"></script></body></html>`,
    "utf8",
  );
  writeFileSync(
    join(cacheDir, "main.tsx"),
    `import "@agentdeck/runtime/styles.css";\nimport "@agentdeck/runtime/render";\n`,
    "utf8",
  );
  console.log("Starting Vite preview for AgentDeck...");
  const child = spawn("npx", ["vite", "--host", "0.0.0.0", cacheDir], { stdio: "inherit" });
  child.on("exit", (code) => {
    process.exitCode = code ?? 0;
  });
  return { code: 0 };
}

function starterDeck(theme: string): string {
  return `---
title: AgentDeck 单文件演示
subtitle: 给任意来源的 deck 加上可传播的 HTML 播放器
author: AgentDeck
lang: zh-CN
theme: ${theme}
aspect: 16:9
outputs: [html, pdf, png, long-image, grid9]
audience: creator
mode: audience
compatibility: agentdeck
---

# AgentDeck 单文件演示
layout: cover
note: 开场说明 AgentDeck 只负责封装与演示增强

已有 PPT、PDF、HTML 负责内容，AgentDeck 负责单文件 HTML 播放器

# 核心边界
layout: statement
note: 明确 AgentDeck 的产品哲学

不重排、不改编、不替用户做 PPT，只把已有演示文件变成可播放、可分享、可导出的单 HTML

# 两种入口
layout: steps
note: 用户可以从 Markdown 或已有 HTML 进入

- agentdeck build deck.md
- agentdeck wrap deck.pdf
- agentdeck wrap deck.pptx
- agentdeck wrap deck.html
- 获得同一套增强播放能力

# 收束
layout: closing

- 原样兼容
- 增强播放
- 单文件交付
`;
}
