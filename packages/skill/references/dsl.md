# AgentDeck DSL

`deck.md` is a lightweight authoring option. It is not required when the user already has an HTML deck from a third-party PPT skill or another tool. In that case, prefer:

```bash
agentdeck wrap-html path/to/index.html --out dist
```

Use frontmatter for deck metadata:

```md
---
title: AgentDeck 单文件演示
subtitle: 给任意来源的 deck 加上可传播的 HTML 播放器
author: AgentDeck
lang: zh-CN
theme: swiss
aspect: 16:9
outputs: [html, pdf, png, long-image, grid9]
---
```

Each slide starts with `#`. Put directives directly under the heading:

```md
# 核心边界
layout: statement
note: 开场用一个强观点建立注意力

第三方 Skill 负责内容与视觉，AgentDeck 负责封装、播放和导出。
```

Supported directives:

- `layout`: one AgentDeck layout ID
- `note`: speaker note
- `image`: local or remote image path
- `alt`: image alt text
- `image-slot`: named slot such as `s22-hero-21x9`
- `data-layout`: original Swiss locked layout ID when importing
- `social`: export hint such as `cover`, `grid9`, or `long-image`

Supported Markdown blocks: paragraphs, lists, quotes, tables, fenced code, mermaid fences, images, `::kpi label | value | detail`, and `::formula expression`.
