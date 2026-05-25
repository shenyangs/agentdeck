---
title: AgentDeck
subtitle: 优先把 HTML / PDF 演示材料变成可播放的单文件 HTML
author: AgentDeck
lang: zh-CN
theme: swiss
aspect: 16:9
outputs: [html, pdf, png, long-image, grid9, social-pack]
sourceStyles: ".ad-brand-line{display:none!important}"
---

# 已经有 HTML 或 PDF，怎么直接演示？
layout: cover
note: 现成材料也应该能快速进入演示状态。

最推荐的路径，是把现成 HTML 演示页或 PDF 包成一个增强型 HTML 播放器。PPT 和 Markdown 也能处理，但不是第一优先级。

# AgentDeck 做的事很简单
layout: statement
note: 默认 Light 模式，工具栏不抢内容。

把已有 HTML 或 PDF 包成一个 `index.html`。内容尽量不动，只加一层统一的演示播放器。

# 当前最推荐的两条输入
layout: steps
note: 不做重排，重点是封装、播放和验收。

- 已有 HTML 演示页 -> 增强型单 HTML 播放器
- 已有 PDF -> 增强型单 HTML 播放器
- PPT / Office 文件 -> 先转 PDF，再封装
- Markdown -> 轻量兜底起稿路径
- 交付：发一个 HTML，或者发 `index.html + assets`

# 暗场演示时，切到 Dark
layout: statement
note: 灯光暗、投屏强时，播放器也能低干扰。

投屏、培训、路演时，播放器外壳可以切成深色。观众看的是内容，工具栏不要抢戏。

# 页数一多，Overview 就很有用
layout: cards
note: 用缩略图找页面，比记页码靠谱。

- 先扫一眼整套材料的结构
- 客户问到哪页，直接点缩略图
- 评审时快速回到证据页
- 不需要记住“第几页讲过什么”

# 讲当前页时，也能看到下一页
layout: statement
note: 右下角预览下一页，讲起来更稳。

打开 Compare View，右下角会露出下一页预览。讲培训、路演、复盘时，不用切页也知道接下来要讲什么。

# 需要讨论时，一键 Blank
layout: statement
note: 先把画面收掉，把注意力还给现场。

客户提问、现场讨论、临时停顿时，先把画面收掉。注意力从屏幕回到人。

# 讲重点时，用 Spotlight
layout: steps
note: 让观众只看这一句话、这个数字、这块截图。

- 按 `L` 打开聚光
- 鼠标移到要强调的文字或数字
- 其他区域自动变暗
- 适合讲数据、截图和复杂页面

# 演示工具跟着文件一起走
layout: table
note: 打开 HTML，就有一套完整的演示控制。

| 场景 | 工具 | 快捷键 |
|---|---|---:|
| 快速跳页 | Overview | O |
| 看下一页 | Compare View | C |
| 暂停画面 | Blank | B |
| 聚焦重点 | Spotlight | L |
| 全屏演示 | Fullscreen | F |

# 最后交付的是一个能打开的文件
layout: closing
note: 对方不用装插件，也不用知道你怎么转换的。

- 浏览器直接打开
- 可以发给客户或同事
- 可以打印 / 导出 PDF
