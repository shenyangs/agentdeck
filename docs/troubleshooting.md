# Troubleshooting

Start with:

```bash
agentdeck probe input.file --json --out probe-report.json
agentdeck wrap input.file --out dist
agentdeck verify dist/index.html --json --out dist/verify-report.json
```

## Common Failures

### LibreOffice Is Missing Or Broken

Symptoms:

- `agentdeck doctor` reports LibreOffice missing.
- macOS reports missing or invalid sealed resources.
- `soffice --version` times out.

Actions:

```bash
brew reinstall --cask libreoffice
brew install poppler
agentdeck doctor --json
```

On macOS, AgentDeck can fall back to Keynote for presentations and Quick Look for Word/Excel documents.

### PDF Renders Blank Or Too Small

Retry with a different DPI or renderer:

```bash
agentdeck wrap input.pdf --dpi 220
agentdeck wrap input.pdf --dpi 160 --max-output-mb 80
```

Read `asset-report.json` and `verify-report.json`:

- `rendererBackend` says which PDF renderer was used.
- `qualitySignals` records output-size and visual warnings.
- `visibleAreaRatio` below 0.55 means the page was probably captured too small.

### HTML Captures Only One Slide

Use raster mode:

```bash
agentdeck wrap input.html --html-strategy raster
```

Then inspect `compat-report.json`:

- `adapterId` identifies the detected HTML deck family.
- `captureStrategy` is `hash`, `keyboard`, or `scroll`.
- `capturePages[]` lists capture success per page.

### Output HTML Is Too Large

Single HTML is the default. For big decks, use compression or folder mode:

```bash
agentdeck wrap input.pdf --image-format webp --quality 82 --max-output-mb 50
agentdeck wrap input.pdf --pack folder
```

`--pack folder` writes `index.html + assets/`, which is better for CDN, object storage, and very large decks.

### Browser Print/PDF Looks Wrong

Browser print depends on the print dialog. Turn on background graphics, turn off headers and footers, and use zero margins when available.

For Markdown decks, prefer:

```bash
agentdeck export deck.md --pdf
```

For wrapped files, regenerate at higher DPI:

```bash
agentdeck wrap input.pdf --dpi 220
```
