---
title: AgentDeck 单文件演示
subtitle: 给任意来源的 deck 加上可传播的 HTML 播放器
author: AgentDeck
lang: zh-CN
theme: swiss
aspect: 16:9
outputs: [html, pdf, png, long-image, grid9]
---

# AgentDeck 单文件演示
layout: cover
note: 开场说明 AgentDeck 的边界

第三方 Skill 负责内容与视觉，AgentDeck 负责封装和演示增强

# 核心边界
layout: statement
note: 明确产品哲学

不替代 PPT Skill，不抢美化工作，只把各种 deck 变成可演示、可分享、可导出的单 HTML

# 两种入口
layout: steps
note: 用户可以从已有 HTML 或 Markdown 进入

- agentdeck wrap-html path/to/index.html
- agentdeck build deck.md
- 获得同一套增强播放能力

# 收束
layout: closing

- 尊重外部作者
- 兼容多种来源
- 一个 HTML 走天下
