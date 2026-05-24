# External PPT Skills

AgentDeck can work with third-party PPT skills, but it does not own them.

Before using an external skill, tell the user:

- the skill name and source repository or package
- the author or maintainer when known
- the license and any commercial-use caveats
- that AgentDeck is only wrapping, validating, importing, exporting, or presenting the output

Recommended workflow:

```bash
# 1. Generate HTML with the external PPT skill or another deck tool.
# 2. Wrap the generated HTML with AgentDeck.
agentdeck wrap-html path/to/index.html --out dist
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
