# AgentDeck

AgentDeck is a **single-file HTML playback and delivery layer** for presentation files.

Positioning:

**Wrap PPT, PDF, HTML, or Markdown presentations into one playable, shareable, exportable single-file HTML.**

## Product Boundary

AgentDeck does not make slides for users, choose third-party PPT skills, imitate template systems, or re-layout Office/PDF content.

It does one lower-level job:

- accept existing `.ppt`, `.pptx`, `.pdf`, `.html`, or `.md` files
- preserve the source visuals as much as possible
- generate one self-contained `index.html`
- add the AgentDeck presenter controls

The product focus is compatibility, playback, sharing, and export.

## Compatibility Routes

### Office PPT / PPTX

```bash
agentdeck wrap deck.pptx --out dist
agentdeck wrap deck.ppt --out dist
```

Flow:

1. Convert PPT/PPTX to PDF with local LibreOffice / `soffice`.
2. Render each PDF page to a high-resolution PNG.
3. Inline every page into one HTML file.
4. Add the AgentDeck player.

This is playback-level compatibility, not Office-editing compatibility. It prioritizes visual fidelity.

### PDF

```bash
agentdeck wrap deck.pdf --out dist
agentdeck wrap deck.pdf --out dist --dpi 220
```

Each PDF page is rendered to an image and packed into a single HTML file.

### HTML

```bash
agentdeck wrap deck.html --out dist
agentdeck wrap-html deck.html --out dist
```

HTML supports two compatibility strategies. The default is `auto`:

```bash
agentdeck wrap deck.html --out dist --html-strategy auto
agentdeck wrap deck.html --out dist --html-strategy dom
agentdeck wrap deck.html --out dist --html-strategy raster
```

- `dom`: detect `.slide`, `.page`, `.ppt-slide`, `.swiper-slide`, or `section`, then place each detected page into the AgentDeck player.
- `raster`: render the original HTML page by page in a browser, then inline each screenshot into the AgentDeck player.
- `auto`: use `dom` for ordinary HTML; switch to `raster` for full-viewport player-style HTML with `position: fixed`, `100vw/100vh`, and horizontal deck navigation.

You can also pass a browser-style `file:///.../index.html` URL directly to the CLI.

`raster` is better for HTML decks that already have their own full-screen playback system. It preserves visual size and layout, but turns the source HTML into static page images, so original animations and DOM interactions are not preserved.

`auto` is more than a default flag. AgentDeck analyzes the source HTML first, chooses DOM or raster wrapping, and falls back to raster if DOM extraction only finds one page, slide counts do not match, or the source clearly behaves like its own full-screen player. The output directory includes:

- `asset-report.json`: assets, screenshots, DPI, and wrapping details
- `compat-report.json`: HTML compatibility signals, recommended strategy, selected strategy, and fallback status

These reports are meant for agents. An agent should not ask the user to choose internal strategies first. It should run `agentdeck wrap input --out dist`, read the reports, inspect the result, and retry with the higher-fidelity route only when needed.

### Markdown

```bash
agentdeck init my-deck --theme swiss
agentdeck build my-deck/deck.md --single-html --out my-deck/dist
```

Markdown is a lightweight fallback authoring path. The main product path is still existing presentation file to single-file HTML player.

## Player Features

The generated `dist/index.html` includes:

- previous / next slide
- restart
- autoplay
- autoplay interval switcher
- looped playback
- progress bar and scrubber
- thumbnail overview with click-to-jump
- next-slide preview
- blank screen
- spotlight
- fullscreen
- browser print / PDF

Shortcuts:

- `ArrowLeft` / `ArrowRight`
- `O` overview
- `C` next-slide preview
- `B` blank screen
- `L` spotlight
- `P` autoplay
- `F` fullscreen
- `Esc` close overlay

## Install

### GitHub

```bash
git clone https://github.com/shenyangs/agentdeck.git
cd agentdeck
npm install
npm run build
```

### Homebrew

```bash
brew tap shenyangs/agentdeck
brew install agentdeck
```

Tap repository:

```text
https://github.com/shenyangs/homebrew-agentdeck
```

## Converter Check

```bash
agentdeck doctor
```

PPT/PPTX wrapping requires LibreOffice / `soffice`. PDF rendering requires `pdftoppm`.
`doctor` checks not only whether a converter exists, but also whether it responds. If it reports `version check timed out`, fix LibreOffice before wrapping PPT/PPTX files.

On macOS:

```bash
brew install --cask libreoffice
brew install poppler
```

## CLI

```bash
agentdeck wrap deck.pptx --out dist
agentdeck wrap deck.pdf --out dist
agentdeck wrap deck.html --out dist
agentdeck wrap deck.html --out dist --html-strategy raster
agentdeck wrap-html deck.html --out dist
agentdeck init my-deck --theme swiss
agentdeck lint my-deck/deck.md
agentdeck build my-deck/deck.md --single-html --mode audience --out my-deck/dist
agentdeck export my-deck/deck.md --pdf --png --long-image --grid9 --out my-deck/export
agentdeck doctor
```

## Agent Usage

Recommended workflow:

1. If the user provides `.ppt`, `.pptx`, `.pdf`, or `.html`, run `agentdeck wrap path/to/file --out dist`.
2. If the user provides `.md`, run `agentdeck lint` and `agentdeck build`.
3. Read `dist/asset-report.json` and `dist/compat-report.json` to understand the actual wrapping route.
4. Do not recommend, install, or route to PPT skills.
5. Do not re-layout Office or PDF content.
6. Open `dist/index.html` and check controls, overview, next-slide preview, autoplay, blank screen, spotlight, fullscreen, and PDF.
7. If conversion fails, report the converter issue instead of rewriting the user's deck.

AgentDeck expects agents to reason and act adaptively: try the default compatibility path first, then use the reports and visual result to retry when pages are tiny, blank, mismatched, or malformed. Interrupt the user only when converters are missing, the source file is broken, or both HTML routes fail.

Principles:

- the source file is the source of truth
- preserve visuals first
- enhance playback
- ship one file
- do not make the PPT for the user

## Project Structure

- `packages/cli`: command-line interface
- `packages/runtime`: single-file HTML player
- `packages/schema`: Markdown DSL and validation
- `packages/themes`: fallback Markdown themes
- `packages/compat-profiles`: generic external HTML import
- `packages/skill`: agent instructions

## Development

```bash
npm install
npm run build
npm test
npm run verify
```
