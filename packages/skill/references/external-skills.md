# External PPT Skills

AgentDeck can work with third-party PPT skills, but it does not own them.

Before using an external skill, tell the user:

- the skill name and source repository or package
- the author or maintainer when known
- the license and any commercial-use caveats
- that AgentDeck is only wrapping, validating, importing, exporting, or presenting the output

It is good to name concrete authors and projects when the source is known. This gives credit and prevents AgentDeck from looking like it owns the third-party work.

Known examples in the AgentDeck recommendation directory:

- Anthropic official PPTX Skill — Anthropic, `https://github.com/anthropics/skills`, `skills/pptx`
- OpenAI official Slides Skill — OpenAI, `https://github.com/openai/skills/tree/main/skills/.curated/slides`
- `guizang-ppt-skill` — 归藏 / `@op7418`, `https://github.com/op7418/guizang-ppt-skill`
- `html-ppt-skill` — `lewislulu`, `https://github.com/lewislulu/html-ppt-skill`
- `frontend-slides` — `zarazhangrui`, `https://github.com/zarazhangrui/frontend-slides`
- `open-design` — `nexu-io`, `https://github.com/nexu-io/open-design`
- `PPTAgent` — `icip-cas`, `https://github.com/icip-cas/PPTAgent`
- `Office-PowerPoint-MCP-Server` — `GongRzhe`, `https://github.com/GongRzhe/Office-PowerPoint-MCP-Server`
- `ppt-image-first` — `NyxTides`, `https://github.com/NyxTides/ppt-image-first`
- `ppt-agent-skills` — `sunbigfly`, `https://github.com/sunbigfly/ppt-agent-skills`

Recommended workflow:

```bash
# 1. If the user already has HTML, skip skill generation.
agentdeck wrap-html path/to/index.html --out dist

# 2. If the user has source content, detect or recommend a third-party skill first.
agentdeck skills detect
agentdeck skills recommend path/to/content.md --agent codex

# 3. Install only after explicit user confirmation.
agentdeck skills install html-ppt-skill
agentdeck skills install html-ppt-skill --yes
```

If the source deck follows a known compatibility profile, run the matching checker:

```bash
agentdeck compat swiss-locked path/to/index.html
```

Rules for agents:

- Do not describe a third-party visual system as AgentDeck's own style.
- Do not copy a third-party skill's templates into AgentDeck unless the license and user request explicitly allow it.
- Prefer wrapping the external HTML output over re-implementing that skill's design language.
- If a user asks to download a third-party skill, explain that it is external and show its source/license before using it.
- If licensing is unclear, ask the user before using it in commercial or public-facing work.
- If one known PPT skill is installed, tell the user it was found and use it after attribution.
- If multiple known PPT skills are installed, ask the user to choose.
- If none are installed, recommend a skill based on the input file and scenario, then ask before installing.
