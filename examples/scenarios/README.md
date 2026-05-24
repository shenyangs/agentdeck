# AgentDeck Optional Scenario Gallery

这是一个可选的结构重排示例，不是 AgentDeck 的核心产品心智。

AgentDeck 的主能力是把已有 HTML deck 或 `deck.md` 封装成增强型单文件 HTML。`agentdeck adapt` 只是给 Agent 在没有外部 PPT Skill 时使用的辅助工具。

同一份 `source.md` 已被 `agentdeck adapt` 重排成 6 种场景。每个目录都有 `deck.md`，构建后会生成 audience 和 creator 两个入口。

| Scenario | Audience deck | Creator workbench |
| --- | --- | --- |
| media | `media/dist/index.html` | `media/dist-creator/index.html` |
| pitch | `pitch/dist/index.html` | `pitch/dist-creator/index.html` |
| keynote | `keynote/dist/index.html` | `keynote/dist-creator/index.html` |
| course | `course/dist/index.html` | `course/dist-creator/index.html` |
| bid | `bid/dist/index.html` | `bid/dist-creator/index.html` |
| launch-campaign | `launch-campaign/dist/index.html` | `launch-campaign/dist-creator/index.html` |

Regenerate one scenario:

```bash
agentdeck adapt examples/scenarios/source.md --scenario pitch --out examples/scenarios/pitch/deck.md
agentdeck build examples/scenarios/pitch/deck.md --mode creator --out examples/scenarios/pitch/dist-creator
```
