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

Use `--html-strategy raster` when:

- the source HTML has its own `position: fixed` full-screen deck
- slides are sized with `100vw` and `100vh`
- source slides become tiny after DOM wrapping
- the source already has its own navigation, scaling, WebGL, canvas, or animation system

Use `--html-strategy dom` when:

- the source HTML is simple static slide markup
- users need selectable text or embedded DOM content more than visual fidelity
