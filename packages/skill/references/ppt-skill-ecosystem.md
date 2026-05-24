# PPT Skill Ecosystem Routing

AgentDeck is the packaging and playback layer. Third-party PPT skills generate the deck's content and visual system.

The known-skill directory is based on public repositories, public skill indexes, and the user-provided roundup article: https://mp.weixin.qq.com/s/--NKyWIKfdmXXR7dSRMzpA. Treat the article as discovery context only; always defer to upstream README and LICENSE files before installing or using a third-party skill.

## Input Routing

Use this order:

1. Existing HTML deck: run `agentdeck wrap-html path/to/index.html --out dist`.
2. Markdown / text / PDF / Word / PPTX / brief: run `agentdeck skills detect`.
3. One known skill installed: name it, credit the author, state the license boundary, then use it.
4. Multiple known skills installed: ask the user to choose.
5. No known skill installed: run `agentdeck skills recommend path/to/input --agent codex|claude`, explain the recommendation, then ask before installing.

## Known Third-Party Skills

| Need | Skill | Author / Source | Install hint |
| --- | --- | --- | --- |
| Claude Code + editable PPTX | Anthropic official PPTX Skill | Anthropic / `anthropics/skills` | `npx skills add https://github.com/anthropics/skills --skill pptx` |
| Codex / OpenAI + editable PPTX | OpenAI official Slides Skill | OpenAI / `openai/skills` | Prefer bundled OpenAI/Codex skill when available |
| Chinese social / portfolio HTML deck | `guizang-ppt-skill` | 归藏 / `@op7418` | `npx skills add https://github.com/op7418/guizang-ppt-skill` |
| Live talk HTML deck | `html-ppt-skill` | `lewislulu` | `npx skills add https://github.com/lewislulu/html-ppt-skill` |
| Browser-native web slides | `frontend-slides` | `zarazhangrui` | Claude plugin flow or upstream clone |
| Academic / research PPT | `PPTAgent` | `icip-cas` | Clone upstream and follow README |
| Batch edit existing PPTX | `Office-PowerPoint-MCP-Server` | `GongRzhe` | Clone upstream and configure as MCP |
| Image-first visual deck | `ppt-image-first` | `NyxTides` | `npx skills add https://github.com/NyxTides/ppt-image-first` |
| Reviewable enterprise workflow | `ppt-agent-skills` | `sunbigfly` | `npx skills add https://github.com/sunbigfly/ppt-agent-skills` |
| General design harness | `open-design` | `nexu-io` | Clone upstream and follow README |

## Attribution Template

Use this before invoking or installing a third-party skill:

```text
I recommend <skill name> for this deck because <reason>.
It is a third-party project by <author/source>, not part of AgentDeck.
AgentDeck will only use it to generate or prepare the deck, then wrap the resulting HTML into an enhanced single-file player.
Please confirm you are comfortable with the upstream license and install command before I install or use it.
```

## Do Not

- Do not claim the third-party visual style is AgentDeck's style.
- Do not copy third-party templates into AgentDeck.
- Do not install a third-party skill without explicit user confirmation.
- Do not pick between multiple installed PPT skills silently.
