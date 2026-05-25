---
name: agentdeck
description: Wrap existing PPT, PPTX, Keynote, Office, PDF, HTML, or Markdown decks into enhanced single-file HTML with AgentDeck. Use when the user wants maximum playback compatibility and does not want redesign, re-layout, or PPT skill routing.
---

# AgentDeck

AgentDeck is a single-file HTML presentation player and delivery layer.

It does not help users choose PPT skills, imitate template systems, or redesign slides. Its job is to take an existing presentation artifact and make it playable, shareable, and exportable in one HTML file.

## Workflow

0. Run the CLI preflight below. Do not assume `agentdeck` is installed.
1. If the user provides `.ppt`, `.pptx`, `.key`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.pdf`, `.html`, or `.htm`, run `agentdeck probe path/to/file`, then `agentdeck wrap path/to/file --out dist`.
2. If the user provides a Markdown deck, run `agentdeck lint deck.md`, then `agentdeck build deck.md --single-html --out dist`.
3. Read `dist/asset-report.json` and, for HTML input, `dist/compat-report.json`.
4. Run `agentdeck verify dist/index.html --json --out dist/verify-report.json`.
5. Review `dist/index.html`: navigation, overview, next-slide preview, autoplay, blank screen, spotlight, fullscreen, toolbar auto-hide, and print/PDF.
6. If pages are tiny, blank, clipped, duplicated, or the page count is wrong, use the reports to retry the higher-fidelity route before asking the user.
7. If Office/PDF conversion fails, report the converter issue and the source file path. Do not rewrite the deck as a workaround unless the user asks.

## CLI Preflight

Before wrapping or building, check that the AgentDeck CLI exists:

```bash
command -v agentdeck
```

If it is missing on macOS and Homebrew is available, install it directly:

```bash
brew tap shenyangs/agentdeck
brew install agentdeck
```

If Homebrew is not available, use the repository checkout when the workspace is the AgentDeck repo, and run the CLI through npm:

```bash
npm install
npm run build
npm run agentdeck -- --help
npm run agentdeck -- doctor --json
```

If a global CLI was installed, then run:

```bash
agentdeck doctor --json
```

If `doctor` reports missing Office/PDF converters, install the missing converter when the platform route is obvious, or tell the user exactly which dependency is missing. The skill is a companion workflow; it does not bundle the CLI, LibreOffice, Poppler, Keynote, Quick Look, Microsoft Office, or Python PDF renderers.

## Commands

```bash
agentdeck wrap deck.pptx --out dist
agentdeck wrap deck.pdf --out dist
agentdeck wrap deck.html --out dist
agentdeck wrap deck.html --out dist --html-strategy raster # debug/override only
agentdeck wrap-html deck.html --out dist
agentdeck probe deck.pptx
agentdeck verify dist/index.html --json --out dist/verify-report.json
agentdeck init my-deck --theme swiss
agentdeck template init my-deck/templates/acme --base-theme swiss
agentdeck lint my-deck/deck.md
agentdeck build my-deck/deck.md --single-html --out my-deck/dist
agentdeck export my-deck/deck.md --pdf --png --long-image --grid9 --out my-deck/dist
agentdeck doctor --json
```

## References

- Read `references/file-compat.md` when wrapping PPT, PPTX, PDF, or HTML files.
- Read `references/dsl.md` when creating or editing `deck.md`.
- Read `references/authoring-kit.md` when the user wants to start from Markdown and needs common slide page types.
- Read `references/layouts.md` when choosing layouts or fixing overflow in Markdown decks.

## Hard Rules

- Do not route users to PPT skills. AgentDeck is a wrapper/player, not a PPT generation router.
- Do not re-layout Office or PDF input. Render it as pages and wrap the pages.
- Let `agentdeck wrap` choose the HTML strategy first. Override with `--html-strategy raster` only after the automatic report or visual review shows DOM wrapping is unsafe.
- Treat the source file as the source of truth.
- Prefer raster fidelity for maximum compatibility.
- Keep the output self-contained whenever possible.
- Always distinguish "source deck" from "wrapped by AgentDeck".
