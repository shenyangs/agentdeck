# Security Model

AgentDeck may process untrusted Office, PDF, and HTML files. Treat conversion as a potentially risky operation.

## Defaults

- Reports redact absolute source paths by default. Use `--debug` only for local diagnosis.
- HTML raster capture blocks non-local network requests by default.
- Use `--allow-network` only when the source deck intentionally depends on remote assets.
- Wrapped Office/PDF output contains rendered page images, not the original editable source file.
- HTML DOM import does not try to preserve the source deck's script runtime.

## Risks

- Office and PDF converters can have parser vulnerabilities.
- HTML files can include tracking, external scripts, or local file references.
- Browser capture can execute source JavaScript when rasterizing an HTML deck.
- Single HTML output may contain embedded images that reveal confidential content.

## Safer Handling

For untrusted files:

```bash
agentdeck probe input.file --json
agentdeck wrap input.file --out dist --no-verify
agentdeck verify dist/index.html
```

Prefer a containerized environment when processing files from unknown senders. The planned Docker image will bundle Node, Playwright Chromium, LibreOffice, Poppler, Noto CJK fonts, and Python PDF fallback libraries.

## Network Policy

HTML raster mode allows:

- `file:`
- `data:`
- `blob:`
- `about:`

It blocks remote `http:` and `https:` resources unless `--allow-network` is passed.

## Path Disclosure

Default report:

```json
{
  "source": {
    "path": "deck.pdf",
    "redacted": true
  }
}
```

Debug report:

```bash
agentdeck wrap deck.pdf --debug
```

Only use debug mode when the report stays local.
