# File Compatibility

AgentDeck's core route is playback compatibility, not PPT generation.

Use `agentdeck wrap` whenever the user gives an existing presentation artifact:

```bash
agentdeck wrap deck.pptx --out dist
agentdeck wrap deck.ppt --out dist
agentdeck wrap deck.pdf --out dist
agentdeck wrap deck.html --out dist
agentdeck wrap deck.html --out dist --html-strategy raster
```

Compatibility model:

- HTML input: preserve detected slide containers and add the AgentDeck player.
- Full-screen HTML player input: rasterize the original pages and add the AgentDeck player.
- PDF input: render every page to a high-resolution PNG and inline those pages in one HTML file.
- PPT/PPTX input: convert through LibreOffice/soffice to PDF, then render every page to PNG.
- No layout rewriting, no content interpretation, no template migration.

This is playback-level compatibility. It does not preserve editable PowerPoint objects, macros, original animation timelines, or Office-only interactive features.

Default stance:

- Prefer fidelity over editability.
- Prefer a single self-contained HTML over external assets.
- Report converter failures as source-file compatibility issues.
- Do not suggest external PPT skills. AgentDeck is responsible for wrapping and playback, not generating decks.
- For Office input, AgentDeck still depends on the local Office rendering chain. It improves routing and diagnostics, but it does not replace LibreOffice, PowerPoint, or the native Office layout engine.
- On macOS, `.ppt` and `.pptx` can fall back to `Keynote.app -> PDF -> page images` when LibreOffice is unavailable.
- On macOS, `.key` follows the same `Keynote.app -> PDF -> page images` route.
- On macOS, `.doc`, `.docx`, `.xls`, and `.xlsx` can fall back to `Quick Look Preview.html -> Chromium PDF print -> page images`.
- On Windows, `.ppt/.pptx`, `.doc/.docx`, and `.xls/.xlsx` can fall back to Microsoft Office COM automation when Office is installed.

PDF render backends:

- Try `pdftoppm` first.
- Fall back to `pdftocairo` when available.
- Fall back to `pypdfium2` through local Python when available.
- Fall back to `pdf2image` through local Python when available.

The agent should read `asset-report.json` to see which backend actually rendered the pages.

Adaptive HTML handling:

- Start with `agentdeck wrap deck.html --out dist`.
- Read `dist/compat-report.json`.
- If `selectedStrategy` is `raster`, the CLI already detected a full-screen player or DOM extraction risk.
- If `selectedStrategy` is `dom` but the visual result is tiny, blank, clipped, or page counts are wrong, retry with `--html-strategy raster`.
- If `selectedStrategy` is `raster` but the user needs selectable DOM text more than visual fidelity, retry with `--html-strategy dom` and explain the tradeoff.

The agent should make these retries itself. Ask the user only when both strategies fail or when preserving animation/DOM interactivity is more important than visual fidelity.

`raster` is usually right when:

- the source HTML has its own `position: fixed` full-screen deck
- slides are sized with `100vw` and `100vh`
- source slides become tiny after DOM wrapping
- the source already has its own navigation, scaling, WebGL, canvas, or animation system

`dom` is usually right when:

- the source HTML is simple static slide markup
- users need selectable text or embedded DOM content more than visual fidelity
