# File Compatibility

AgentDeck's core route is playback compatibility, not PPT generation.

Use `agentdeck wrap` whenever the user gives an existing presentation artifact:

```bash
agentdeck wrap deck.pptx --out dist
agentdeck wrap deck.ppt --out dist
agentdeck wrap deck.pdf --out dist
agentdeck wrap deck.html --out dist
```

Compatibility model:

- HTML input: preserve detected slide containers and add the AgentDeck player.
- PDF input: render every page to a high-resolution PNG and inline those pages in one HTML file.
- PPT/PPTX input: convert through LibreOffice/soffice to PDF, then render every page to PNG.
- No layout rewriting, no content interpretation, no template migration.

This is playback-level compatibility. It does not preserve editable PowerPoint objects, macros, original animation timelines, or Office-only interactive features.

Default stance:

- Prefer fidelity over editability.
- Prefer a single self-contained HTML over external assets.
- Report converter failures as source-file compatibility issues.
- Do not suggest external PPT skills. AgentDeck is responsible for wrapping and playback, not generating decks.
