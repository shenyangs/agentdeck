---
name: agentdeck
description: Wrap existing PPT, PPTX, PDF, HTML, or Markdown decks into enhanced single-file HTML with AgentDeck. Use when the user wants maximum playback compatibility and does not want redesign, re-layout, or PPT skill routing.
---

# AgentDeck

AgentDeck is a single-file HTML presentation player and delivery layer.

It does not help users choose PPT skills, imitate template systems, or redesign slides. Its job is to take an existing presentation artifact and make it playable, shareable, and exportable in one HTML file.

## Workflow

1. If the user provides `.ppt`, `.pptx`, `.pdf`, `.html`, or `.htm`, run `agentdeck wrap path/to/file --out dist`.
2. If the user provides a Markdown deck, run `agentdeck lint deck.md`, then `agentdeck build deck.md --single-html --out dist`.
3. Review `dist/index.html`: navigation, overview, next-slide preview, autoplay, blank screen, spotlight, fullscreen, and print/PDF.
4. If Office/PDF conversion fails, report the converter issue and the source file path. Do not rewrite the deck as a workaround unless the user asks.

## Commands

```bash
agentdeck wrap deck.pptx --out dist
agentdeck wrap deck.pdf --out dist
agentdeck wrap deck.html --out dist
agentdeck wrap-html deck.html --out dist
agentdeck init my-deck --theme swiss
agentdeck lint my-deck/deck.md
agentdeck build my-deck/deck.md --single-html --out my-deck/dist
agentdeck export my-deck/deck.md --pdf --png --long-image --grid9 --out my-deck/dist
agentdeck doctor
```

## References

- Read `references/file-compat.md` when wrapping PPT, PPTX, PDF, or HTML files.
- Read `references/dsl.md` when creating or editing `deck.md`.
- Read `references/layouts.md` when choosing layouts or fixing overflow in Markdown decks.

## Hard Rules

- Do not route users to PPT skills. AgentDeck is a wrapper/player, not a PPT generation router.
- Do not re-layout Office or PDF input. Render it as pages and wrap the pages.
- Treat the source file as the source of truth.
- Prefer raster fidelity for maximum compatibility.
- Keep the output self-contained whenever possible.
- Always distinguish "source deck" from "wrapped by AgentDeck".
