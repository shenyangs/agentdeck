# AgentDeck Compatibility

AgentDeck is a playback compatibility layer. It preserves visual output first and does not promise editable Office objects.

| Input | Route | Visual Fidelity | Editable | Notes |
| --- | --- | --- | --- | --- |
| `.ppt` / `.pptx` | LibreOffice or Keynote or Windows Office COM -> PDF -> images -> player | High | No | Animations and editable objects are flattened. |
| `.key` | Keynote or LibreOffice -> PDF -> images -> player | High | No | Keynote route is macOS only. |
| `.pdf` | PDF renderer -> images -> player | High | No | Text is rendered into page images. |
| `.html` DOM | DOM import -> player | Medium | Partial DOM | Scripts and source player logic are not preserved. |
| `.html` raster | Browser screenshots -> images -> player | High | No | Best for existing full-screen HTML decks. |
| `.doc` / `.docx` | LibreOffice or Quick Look -> PDF -> images -> player | Medium-high | No | Depends on local renderer and fonts. |
| `.xls` / `.xlsx` | LibreOffice or Quick Look -> PDF -> images -> player | Medium | No | Wide sheets may paginate. |
| `.md` | AgentDeck Markdown -> player | Native | Source remains Markdown | Fallback path, not the main product promise. |

## Backend Order

Office files:

1. LibreOffice / `soffice`, when installed and healthy.
2. macOS Keynote for `.ppt`, `.pptx`, `.key`.
3. macOS Quick Look for `.doc`, `.docx`, `.xls`, `.xlsx`.
4. Windows Office COM for PowerPoint, Word, Excel. This is marked experimental until Windows desktop Office regression is available.

PDF pages:

1. `pdftoppm`
2. `pdftocairo`
3. `pypdfium2`
4. `pdf2image`

HTML raster:

1. Static source analysis chooses `dom` or `raster`.
2. Runtime capture tries hash navigation, keyboard navigation, then scroll navigation.
3. Reports record `adapterId`, `captureStrategy`, and page capture status.

## Report Contract

Every generated report uses `schemaVersion: "1.0"` and includes:

- `agentdeckVersion`
- `source` with extension, bytes, sha256, MIME, and a redacted path by default
- `environment`
- `pipeline[]` with backend attempts
- `output`
- `qualitySignals`

Use `--debug` when absolute paths are needed for local diagnosis.
