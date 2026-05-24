# Swiss Locked Compatibility

AgentDeck treats locked Swiss-style HTML decks as one compatibility profile among many possible external deck sources.

This profile is structural compatibility only. It does not make AgentDeck the author of the source skill, visual system, or templates.

Run:

```bash
agentdeck compat swiss-locked path/to/index.html
agentdeck import-swiss-locked path/to/index.html --out deck.md
```

Compatibility rules:

- Preserve `data-layout` from Swiss locked pages.
- Map `S01-S22` through AgentDeck's compatibility registry.
- Keep S22 images bound to `data-image-slot="s22-hero-21x9"`.
- Keep local image paths stable when importing.
- Avoid experimental P23/P24 structures unless the user explicitly asks to preserve them.
- Do not use SVG `<text>` for visible labels.
- Swiss body titles should stay left aligned unless the original layout is statement-like.

Useful mapping examples:

- `S15` / `S16` -> `evidence-grid`
- `S22` -> `image-hero`
- `S08` / `S14` / `S17` -> `diagram`
- `S03` / `S09` / `S10` -> `statement`
