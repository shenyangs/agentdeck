# AgentDeck

[English README](./README.en.md)

AgentDeck 是一个面向人类和 AI Agent 的单文件 HTML 演示工具链。

它的核心定位只有一句话：

**把任意来源的演示内容，封装成一个可传播、可播放、可导出的增强型单文件 HTML。**

## 产品边界

AgentDeck 不想替代任何 PPT Skill，也不想把别人的美化能力搬进自己项目里。

它做的是更底层、更中性的事：

- 给已有 deck 加一个统一的浏览器演示播放器
- 把外部 Skill 生成的 HTML 包装成单文件 HTML
- 为普通 Markdown deck 提供一个基础入口
- 提供翻页、总览、下一页预览、自动播放、Blank、Spotlight、全屏、打印 / PDF 等演示能力
- 提供导出链路和兼容检查，让 Agent 产物更容易交付

外部 PPT Skill 负责风格、美学、模板和内容生成。AgentDeck 负责封装、播放、导出和兼容。

## 第三方 Skill 与版权意识

AgentDeck 可以配合不同作者的 PPT Skill 使用。这里可以、也应该实名写清楚作者和来源，因为这是在帮生态里的作者夯实版权边界，而不是把他们的工作包装成 AgentDeck 自己的能力。

当前内置的推荐目录会提到这些第三方项目：

- Anthropic 官方 PPTX Skill：`anthropics/skills`，`skills/pptx`
- OpenAI 官方 Slides Skill：`openai/skills`，`skills/.curated/slides`
- `guizang-ppt-skill`：归藏 / `@op7418`
- `html-ppt-skill`：`lewislulu`
- `frontend-slides`：`zarazhangrui`
- `open-design`：`nexu-io`
- `PPTAgent`：`icip-cas`
- `Office-PowerPoint-MCP-Server`：`GongRzhe`
- `ppt-image-first`：`NyxTides`
- `gpt_image_2_skill`：`wuyoscar`
- `ppt-agent-skills`：`sunbigfly`
- `docsagent`：`docsagent`

但这些 Skill 不是 AgentDeck 的一部分。使用时应该明确提示用户：

- 该 Skill 的作者是谁
- 许可证是什么
- 是否允许商用、修改、再分发
- AgentDeck 只是调用、下载、校验或包装它的输出
- 不要把第三方 Skill 的视觉风格、模板设计或生成逻辑表述成 AgentDeck 自己的能力

这个边界很重要。AgentDeck 希望成为 PPT Skill 生态的基础设施，而不是去抢走其他作者正在做的美化和模板工作。

## 三种入口

### 1. 包装已有 HTML deck

适合已经由任意 PPT Skill、网页 PPT 工具、手写 HTML 或其他 Agent 生成出的 HTML deck。

```bash
agentdeck wrap-html path/to/index.html --out dist
open dist/index.html
```

`wrap-html` 会尽量识别常见 slide 容器，例如 `.slide`、`.page`、`.ppt-slide`、`.swiper-slide`、`section`，并把它们放进 AgentDeck 的增强播放器里。找不到明确页面时，会把整个 `<body>` 当作一页处理。

### 2. 给文档或想法推荐第三方 PPT Skill

适合用户只有有内容的 `.md`、`.txt`、`.pdf`、`.docx`、`.pptx`，或者只有一个 brief，还没有满意的 HTML deck。

AgentDeck 这一步不直接抢第三方 Skill 的美化工作，而是帮 Agent 做选择：

```bash
agentdeck skills detect
agentdeck skills recommend path/to/content.md --agent codex
agentdeck skills recommend path/to/report.pdf --agent claude
```

推荐规则：

- 如果本机只发现 1 个已安装 PPT Skill，Agent 先告诉用户“发现了哪个 Skill、作者是谁、许可证边界是什么”，然后直接使用。
- 如果本机发现多个 PPT Skill，Agent 必须让用户先选一个，不擅自切换视觉系统。
- 如果本机没有 PPT Skill，AgentDeck 根据输入类型、内容场景和目标输出推荐第三方 Skill。
- 安装第三方 Skill 前，只展示来源、作者、许可证和安装命令；用户确认后才执行。
- 第三方 Skill 生成 HTML deck 后，再运行 `agentdeck wrap-html` 加上 AgentDeck 的增强演示框架。

安装命令示例：

```bash
agentdeck skills list
agentdeck skills install guizang-ppt-skill
agentdeck skills install guizang-ppt-skill --yes
```

不带 `--yes` 时只会说明来源和安装命令，不会真的安装。

### 3. 从 Markdown 生成基础 deck

适合没有外部 PPT Skill 时，用一个轻量源文件快速生成可演示 HTML。

```bash
agentdeck init my-deck --theme swiss
agentdeck build my-deck/deck.md --single-html --mode audience --out my-deck/dist
open my-deck/dist/index.html
```

这条路径只是基础兜底能力，不是 AgentDeck 的全部定位。

## 安装

### 从 GitHub 拉取

```bash
git clone https://github.com/shenyangs/agentdeck.git
cd agentdeck
npm install
npm run build
```

### 用 Homebrew 安装

```bash
brew tap shenyangs/agentdeck
brew install agentdeck
```

Homebrew tap 仓库：

```text
https://github.com/shenyangs/homebrew-agentdeck
```

## CLI 命令

```bash
agentdeck wrap-html path/to/index.html --out dist
agentdeck init my-deck --theme swiss
agentdeck lint my-deck/deck.md
agentdeck build my-deck/deck.md --single-html --mode audience --out my-deck/dist
agentdeck export my-deck/deck.md --pdf --png --long-image --grid9 --social-pack --out my-deck/export
agentdeck compat swiss-locked path/to/index.html
agentdeck import-swiss-locked path/to/index.html --out deck.md
agentdeck skills list
agentdeck skills detect
agentdeck skills recommend path/to/content.md --agent codex
agentdeck skills install html-ppt-skill
```

`classify` 和 `adapt` 仍然保留，但它们是可选的结构辅助，不是主产品心智：

```bash
agentdeck classify my-deck/deck.md
agentdeck adapt my-deck/deck.md --scenario pitch --out my-deck/deck.pitch.md
```

## 单文件 HTML 自带什么能力

生成或包装出来的 audience HTML 自带演示能力：

- 上一页 / 下一页
- 重播
- 自动播放
- 自动播放时长切换
- 自动循环播放
- 进度条与拖动跳页
- 缩略总览，点击缩略图跳页
- 右下角下一页小预览
- Blank 屏
- Spotlight
- 全屏
- 浏览器打印 / PDF

常用快捷键：

- `ArrowLeft` / `ArrowRight`
- `O` 打开总览
- `C` 打开下一页预览
- `B` Blank 屏
- `L` Spotlight
- `P` 自动播放
- `F` 全屏
- `Esc` 关闭当前浮层

## 给 Agent 怎么用

推荐把 AgentDeck 当作最后一公里交付工具：

1. 如果用户已经有满意的 HTML deck，直接运行 `agentdeck wrap-html path/to/index.html --out dist`。
2. 如果用户给的是 Markdown、PDF、Office PPT、Word、资料包或 brief，先运行 `agentdeck skills detect`。
3. 如果只发现 1 个已安装 PPT Skill，明确告诉用户发现了哪个、作者是谁、许可证边界是什么，然后使用它。
4. 如果发现多个 PPT Skill，让用户选择。Agent 不要擅自决定最终视觉系统。
5. 如果没有发现 PPT Skill，运行 `agentdeck skills recommend path/to/input --agent codex|claude`，向用户说明推荐理由和第三方来源。
6. 用户确认后再安装或调用第三方 Skill。
7. 第三方 Skill 生成 HTML deck 后，运行 `agentdeck wrap-html path/to/index.html --out dist`。
8. 打开 `dist/index.html` 检查播放器、总览、下一页预览、自动播放、Blank、Spotlight、全屏和 PDF。
9. 如果第三方 deck 存在兼容风险，只报告风险，不把对方模板归为 AgentDeck 自有能力。

AgentDeck 的 Agent 提示原则：

- 尊重第三方作者署名
- 不复制未授权模板
- 不把外部 Skill 的风格包装成 AgentDeck 原创
- 优先把外部产物包装成单文件 HTML，而不是重写它的美学系统
- 当用户要求下载或使用某个 Skill 时，先提示来源和许可证

## 兼容能力

兼容层使用中性 profile：

- 通用外部 HTML：`external-html`
- 锁定式 Swiss HTML：`swiss-locked`
- package：`@agentdeck/compat-profiles`

相关命令：

```bash
agentdeck wrap-html path/to/index.html --out dist
agentdeck compat swiss-locked path/to/index.html
agentdeck import-swiss-locked path/to/index.html --out deck.md
```

`swiss-locked` 是一种结构兼容 profile，用来校验和导入特定风格的锁定式 HTML deck。它不是 AgentDeck 的品牌，也不代表 AgentDeck 拥有第三方 Skill 的模板设计。

## 第三方 Skill 推荐目录

AgentDeck 内置的是推荐目录，不是捆绑模板。目录用于帮助 Agent 做“用哪个外部 Skill”的判断。

| 场景 | 推荐 Skill | 作者 / 来源 | 说明 |
| --- | --- | --- | --- |
| Claude Code 里要 `.pptx` | Anthropic 官方 PPTX Skill | Anthropic / `anthropics/skills` | 稳妥兜底，可编辑 PPTX |
| Codex / OpenAI 工具链里要 `.pptx` | OpenAI 官方 Slides Skill | OpenAI / `openai/skills` | 工程化、可验证的 PPTX 生成 |
| 自媒体、朋友圈、小红书、中文作品感 | `guizang-ppt-skill` | 归藏 / `@op7418` | HTML deck，视觉自洽 |
| 现场演讲、逐字稿、计时器、下一页预览 | `html-ppt-skill` | `lewislulu` | HTML PPT Studio，演讲模式丰富 |
| 纯网页 slides | `frontend-slides` | `zarazhangrui` | 前端 slides 生态 |
| 学术答辩、科研报告 | `PPTAgent` | `icip-cas` | 反思式生成框架 |
| 批量修改 PPT 模板 | `Office-PowerPoint-MCP-Server` | `GongRzhe` | MCP，细粒度编辑 PowerPoint |
| 发布会、营销视觉、先看风格预览 | `ppt-image-first` | `NyxTides` | image-first 工作流 |
| PPT 配图、海报、封面和视觉素材 | `gpt_image_2_skill` | `wuyoscar` | 非纯 PPT，适合作为图像生成辅助 |
| 企业培训、SOP、流程化审查 | `ppt-agent-skills` | `sunbigfly` | 分阶段、可审查 |
| 大量本地文档要先消化再做 PPT | `docsagent` | `docsagent` | 非纯 PPT，适合作为文档检索和提炼前置大脑 |
| 设计系统、多格式资产，PPT 只是其中一部分 | `open-design` | `nexu-io` | 通用设计 harness，做 PPT 时可能偏重 |

这些条目来自公开仓库、公开 Skill 目录，以及用户提供的 PPT Skill 盘点文章：[2026 PPT Skill 排行榜：10 个必装 + 2 个官方答案（附场景速查）](https://mp.weixin.qq.com/s/--NKyWIKfdmXXR7dSRMzpA)。文中数据来源包括 GitHub 仓库 stars、Agent Skills Hub 2026 PPT 分类榜单和 GitHub 直接搜索补漏，时间点为 2026-05-13。这里把文章作为发现线索；真正使用前始终以每个上游项目自己的 README 和 LICENSE 为准。

注意：`gpt_image_2_skill`、`docsagent`、`open-design` 这类条目不是纯 PPT Skill。AgentDeck 可以把它们放在工作流里，分别用于“出图”“消化资料”“通用设计”，但不会把它们包装成 AgentDeck 自己的 PPT 生成能力。

## `deck.md` 最小示例

```md
---
title: AgentDeck 单文件演示
subtitle: 给任意来源的 deck 加上可传播的 HTML 播放器
theme: swiss
outputs: [html, pdf, png]
mode: audience
---

# AgentDeck 单文件演示
layout: cover

第三方 Skill 负责内容与视觉，AgentDeck 负责单文件 HTML 播放器。

# 核心边界
layout: statement

不替代 PPT Skill，不抢美化工作，只把各种 deck 变成可演示、可分享、可导出的单 HTML。
```

## 仓库结构

- `packages/runtime`：单文件 HTML 播放器和静态渲染器
- `packages/cli`：`agentdeck` 命令行
- `packages/compat-profiles`：外部 HTML 与兼容 profile
- `packages/schema`：Markdown DSL、类型和校验
- `packages/themes`：基础主题和 layout manifest
- `packages/skill`：给 Agent 使用的工作流说明
- `examples/`：公开示例

## 开发

```bash
npm install
npm run build
npm test
npm run verify
```

构建 Markdown deck：

```bash
npm run agentdeck -- build examples/demo/deck.md --mode audience --out examples/demo/dist
```

包装外部 HTML deck：

```bash
npm run agentdeck -- wrap-html examples/external-html/source.html --out examples/external-html/dist
```

## 当前状态

当前公开版本已经具备：

- 任意外部 HTML deck -> 增强型单文件 HTML
- Markdown -> 单文件 HTML
- audience 播放控制
- 图片与导出链路
- 中性兼容 profile
- Homebrew 安装链路

下一层重点会继续放在外部 Skill 生态接口、授权提示、兼容 profile 扩展和导出质量上。
