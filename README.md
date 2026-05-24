# AgentDeck

[English README](./README.en.md)

AgentDeck 是一个演示文件的 **单 HTML 播放与交付层**。

一句话定位：

**把 PPT、PDF、HTML 或 Markdown 演示内容，原样封装成一个可播放、可分享、可导出的增强型单文件 HTML。**

## 产品边界

AgentDeck 不负责帮用户“做 PPT”、不选择第三方 PPT Skill、不模仿模板系统，也不重排 Office/PDF 里的内容。

它只做一件底层能力：

- 接收已有 `.ppt` / `.pptx` / `.pdf` / `.html` / `.md`
- 尽量保持原始视觉
- 生成一个自包含 `index.html`
- 给这个 HTML 加上统一的演示播放器

也就是说，AgentDeck 的核心不是美化，而是 **兼容、播放、传播、导出**。

## 兼容策略

### Office PPT / PPTX

```bash
agentdeck wrap deck.pptx --out dist
agentdeck wrap deck.ppt --out dist
```

处理方式：

1. 用本机 LibreOffice / `soffice` 把 PPT/PPTX 转为 PDF。
2. 把 PDF 每一页渲染成高分辨率 PNG。
3. 把所有页面内联进单个 HTML。
4. 加上 AgentDeck 播放器。

这是一种播放级兼容，不是 Office 编辑级兼容。它优先保证“看起来像原来的文件”。

### PDF

```bash
agentdeck wrap deck.pdf --out dist
agentdeck wrap deck.pdf --out dist --dpi 220
```

PDF 会逐页渲染成图片，再打包进单 HTML。适合讲标文件、路演稿、培训材料、会议 PDF、方案书。

### HTML

```bash
agentdeck wrap deck.html --out dist
agentdeck wrap-html deck.html --out dist
```

HTML 有两种兼容策略，默认 `auto`：

```bash
agentdeck wrap deck.html --out dist --html-strategy auto
agentdeck wrap deck.html --out dist --html-strategy dom
agentdeck wrap deck.html --out dist --html-strategy raster
```

- `dom`：识别 `.slide`、`.page`、`.ppt-slide`、`.swiper-slide`、`section`，把每页 DOM 放进 AgentDeck 播放器。
- `raster`：用浏览器逐页渲染原 HTML，再把每页截图内联进 AgentDeck 播放器。
- `auto`：普通 HTML 走 `dom`；检测到 `position: fixed`、`100vw/100vh`、横向全屏翻页这类完整播放器 HTML 时，自动改走 `raster`。

如果你手里是浏览器复制出来的 `file:///.../index.html` 地址，也可以直接传给 CLI。

`raster` 更适合已经有完整播放体系的 HTML deck。它优先保证视觉尺寸和排版不被破坏，但会把原 HTML 变成静态页面图片，不保留原始动效和 DOM 交互。

`auto` 不只是默认值。AgentDeck 会先分析源 HTML，再决定走 DOM 还是截图封装；如果 DOM 抽取后发现只抓到一页、slide 数量不匹配、或源文件明显是自带播放器的全屏 deck，会自动降级到 `raster`。输出目录会写入：

- `asset-report.json`：资源、截图页、DPI 等封装信息
- `compat-report.json`：HTML 兼容判断、触发信号、推荐策略、实际策略、是否自动降级

这两个报告是给 Agent 看的。Agent 不需要让用户选择内部策略，默认直接运行 `agentdeck wrap input --out dist`，再根据报告和截图结果继续处理。

### Markdown

```bash
agentdeck init my-deck --theme swiss
agentdeck build my-deck/deck.md --single-html --out my-deck/dist
```

Markdown 是轻量兜底入口，不是主产品心智。主线仍然是“已有演示文件 -> 单 HTML 播放器”。

## 单 HTML 自带能力

生成的 `dist/index.html` 内置：

- 上一页 / 下一页
- 重播
- 自动播放
- 自动播放时长切换
- 自动循环播放
- 进度条与拖动跳页
- 缩略总览，点击缩略图跳页
- 右下角下一页预览
- Blank 屏
- Spotlight
- 全屏
- 浏览器打印 / PDF

常用快捷键：

- `ArrowLeft` / `ArrowRight` 翻页
- `O` 总览
- `C` 下一页预览
- `B` Blank 屏
- `L` Spotlight
- `P` 自动播放
- `F` 全屏
- `Esc` 关闭当前浮层

## 安装

### 从 GitHub 拉取

```bash
git clone https://github.com/shenyangs/agentdeck.git
cd agentdeck
npm install
npm run build
```

### Homebrew

```bash
brew tap shenyangs/agentdeck
brew install agentdeck
```

Homebrew tap 仓库：

```text
https://github.com/shenyangs/homebrew-agentdeck
```

## 依赖检查

```bash
agentdeck doctor
```

PPT/PPTX 封装需要本机有 LibreOffice / `soffice`。PDF 渲染需要 `pdftoppm`。
`doctor` 不只检查路径，也会检查转换器是否能响应；如果看到 `version check timed out`，说明当前 Office 转换器不可用，PPT/PPTX 封装需要先修复 LibreOffice。

macOS 可以用：

```bash
brew install --cask libreoffice
brew install poppler
```

## CLI

```bash
agentdeck wrap deck.pptx --out dist
agentdeck wrap deck.pdf --out dist
agentdeck wrap deck.html --out dist
agentdeck wrap deck.html --out dist --html-strategy raster
agentdeck wrap-html deck.html --out dist
agentdeck init my-deck --theme swiss
agentdeck lint my-deck/deck.md
agentdeck build my-deck/deck.md --single-html --mode audience --out my-deck/dist
agentdeck export my-deck/deck.md --pdf --png --long-image --grid9 --out my-deck/export
agentdeck doctor
```

## 给 Agent 怎么用

推荐工作流：

1. 用户给 `.ppt` / `.pptx` / `.pdf` / `.html`：直接运行 `agentdeck wrap path/to/file --out dist`。
2. 用户给 `.md`：运行 `agentdeck lint` 和 `agentdeck build`。
3. 读取 `dist/asset-report.json` 和 `dist/compat-report.json`，确认实际封装路径。
4. 不要推荐、安装或路由到任何 PPT Skill。
5. 不要重排 Office/PDF 内容。
6. 打开 `dist/index.html` 检查播放器、总览、下一页预览、自动播放、Blank、Spotlight、全屏和 PDF。
7. 如果转换失败，报告转换器问题，而不是改写用户的原稿。

AgentDeck 对 Agent 的要求是：先自己判断，先自己尝试默认兼容路径，发现页面变小、空白、页数不对、导出错乱时，基于报告自动重跑更保真的路径。只有转换器缺失、源文件损坏、或两种 HTML 策略都失败时，才打断用户。

AgentDeck 的原则：

- 源文件就是事实源
- 原样兼容优先
- 播放体验增强
- 单文件交付
- 不替用户做 PPT

## 项目结构

- `packages/cli`：命令行入口
- `packages/runtime`：单 HTML 播放器
- `packages/schema`：Markdown DSL 与校验
- `packages/themes`：Markdown 兜底主题
- `packages/compat-profiles`：通用外部 HTML 导入
- `packages/skill`：给 Agent 使用的说明

## 开发

```bash
npm install
npm run build
npm test
npm run verify
```
