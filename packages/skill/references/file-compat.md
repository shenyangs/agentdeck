# File Compatibility

AgentDeck's core route is playback compatibility, not PPT generation.

Use `agentdeck wrap` whenever the user gives an existing presentation artifact:

```bash
command -v agentdeck
agentdeck doctor --json
agentdeck probe deck.pptx
agentdeck wrap deck.pptx --out dist
agentdeck wrap deck.ppt --out dist
agentdeck wrap deck.pdf --out dist
agentdeck wrap deck.pdf --out dist --pack folder
agentdeck wrap deck.html --out dist
agentdeck wrap deck.html --out dist --html-strategy raster
agentdeck verify dist/index.html
```

Compatibility model:

- HTML input: preserve detected slide containers and add the AgentDeck player.
- Full-screen HTML player input: rasterize the original pages and add the AgentDeck player.
- PDF input: render every page to a high-resolution image and inline those pages in one HTML file.
- Office input: convert through LibreOffice/soffice, macOS Keynote/Quick Look, or Windows Office COM to PDF, then render every page to an inline image.
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

Probe and verify loop:

- Start with `agentdeck probe input`.
- If the probe reports usable dependencies, run `agentdeck wrap input --out dist`.
- `wrap` runs lightweight verification by default; run `agentdeck verify dist/index.html --json` again when you need an explicit report.
- Read `verify-report.json`; retry only when it reports a concrete failure such as a tiny slide, broken image, or bad navigation.
- If `verify` passes, do not keep modifying the source presentation.

Reports are schema-versioned. Prefer reading:

- `schemaVersion`
- `source.extension`
- `source.sha256`
- `environment.availableBackends`
- `pipeline[]`
- `output`
- `qualitySignals`

Output quality flags:

- Use `--fit contain` by default.
- Use `--fit width` for document pages that should fill horizontal space.
- Use `--image-format webp --quality 82` when the single HTML is too large.
- Use `--max-width`, `--max-output-mb`, and `--size-budget` when the target is email, chat, or mobile sharing.
- Use `--pack folder` when a deck is too large for comfortable single-file sharing.
- Use `--no-verify` only for batch processing where a separate verify pass follows.

Adaptive HTML handling:

- Start with `agentdeck wrap deck.html --out dist`.
- Read `dist/compat-report.json`.
- If `selectedStrategy` is `raster`, the CLI already detected a full-screen player or DOM extraction risk.
- Read `captureStrategy` in `compat-report.json`; it records whether hash, keyboard, or scroll navigation was used for screenshots.
- Read `adapterId`; first-class adapters include generic section, reveal-style, marp-style, swiper-style, and canvas single-page.
- Remote network requests are blocked during raster capture unless `--allow-network` is explicitly passed.
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
