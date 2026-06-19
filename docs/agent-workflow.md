# Agent Workflow

AgentDeck is for agents that need to deliver a reliable single HTML presentation from an existing artifact.

## Default Loop

0. Confirm the CLI is installed:

   ```bash
   command -v agentdeck
   agentdeck doctor --json
   ```

   If `agentdeck` is missing on macOS and Homebrew is available, install it with:

   ```bash
   brew tap shenyangs/agentdeck
   brew install agentdeck
   ```

1. Detect the input:

   ```bash
   agentdeck probe input.file --json --out probe-report.json
   ```

2. Wrap it with the default route:

   ```bash
   agentdeck wrap input.file --out dist
   ```

3. Verify the result:

   ```bash
   agentdeck verify dist/index.html --json --out dist/verify-report.json
   ```

4. For risky PDF/Office conversions or large decks, create a contact sheet:

   ```bash
   agentdeck verify dist/index.html --contact-sheet dist/contact-sheet.png --out dist/verify-report.json
   ```

5. Read reports before deciding whether to retry:

   - `probe-report.json`
   - `dist/asset-report.json`
   - `dist/compat-report.json` for HTML inputs
   - `dist/verify-report.json`
   - `dist/contact-sheet.png` when generated

6. Stop when verification passes.

## Retry Rules

- Page too small: retry HTML with `--html-strategy raster`, or PDF/Office with higher `--dpi`.
- Output too large: retry with `--image-format webp --quality 82` or `--pack folder`.
- HTML page count wrong: retry with `--html-strategy raster`.
- Remote assets blocked: ask the user before using `--allow-network`.
- Converter missing or source corrupt: report the dependency/source problem; do not rewrite the deck content.

## Hard Boundaries

Do not:

- recommend or install third-party PPT skills
- generate a new deck when the user asked to preserve an existing one
- re-layout Office, PDF, or existing HTML content
- claim editable PowerPoint compatibility
- modify AgentDeck runtime when a `deck.md` edit is enough

Do:

- prefer visual fidelity
- write reports
- verify the single HTML
- preserve the source as the truth
- use the Authoring Kit only for Markdown-first decks
