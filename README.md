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

AgentDeck 可以配合不同作者的 PPT Skill 使用，例如某个开源的 PPT 美化 Skill、某个未来派视觉 Skill、某个企业内部模板 Skill。

但这些 Skill 不是 AgentDeck 的一部分。使用时应该明确提示用户：

- 该 Skill 的作者是谁
- 许可证是什么
- 是否允许商用、修改、再分发
- AgentDeck 只是调用、下载、校验或包装它的输出
- 不要把第三方 Skill 的视觉风格、模板设计或生成逻辑表述成 AgentDeck 自己的能力

这个边界很重要。AgentDeck 希望成为 PPT Skill 生态的基础设施，而不是去抢走其他作者正在做的美化和模板工作。

## 两种入口

### 1. 包装已有 HTML deck

适合已经由任意 PPT Skill、网页 PPT 工具、手写 HTML 或其他 Agent 生成出的 HTML deck。

```bash
agentdeck wrap-html path/to/index.html --out dist
open dist/index.html
```

`wrap-html` 会尽量识别常见 slide 容器，例如 `.slide`、`.page`、`.ppt-slide`、`.swiper-slide`、`section`，并把它们放进 AgentDeck 的增强播放器里。找不到明确页面时，会把整个 `<body>` 当作一页处理。

### 2. 从 Markdown 生成基础 deck

适合没有外部 PPT Skill 时，用一个轻量源文件快速生成可演示 HTML。

```bash
agentdeck init my-deck --theme swiss
agentdeck build my-deck/deck.md --single-html --mode audience --out my-deck/dist
open my-deck/dist/index.html
```

这条路径只是基础能力，不是 AgentDeck 的全部定位。

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

1. 用户选择或指定一个 PPT Skill，也可以不用 Skill。
2. Agent 明确告知该 Skill 的来源、作者和许可证边界。
3. Agent 用第三方 Skill、手写 HTML 或 Markdown 生成 deck。
4. 如果已经有 HTML，运行 `agentdeck wrap-html path/to/index.html --out dist`。
5. 如果是 `deck.md`，运行 `agentdeck lint` 和 `agentdeck build`。
6. 打开 `dist/index.html` 检查播放器、总览、下一页预览、Blank、Spotlight 和 PDF。
7. 如果第三方 deck 存在兼容风险，只报告风险，不把对方模板归为 AgentDeck 自有能力。

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
