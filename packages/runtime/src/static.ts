import {
  type DeckDocument,
  type DeckMode,
  type Slide,
  type SlideBlock,
} from "@agentdeck/schema";
import { resolveTheme, type ThemeTokens } from "@agentdeck/themes";
import { baseCss, runtimeJs } from "./static-assets.js";

export interface StandaloneRenderOptions {
  assetResolver?: (src: string) => string;
  includeSourceJson?: boolean;
  mode?: DeckMode;
  profile?: string;
  themeTokens?: Partial<ThemeTokens>;
}

export function renderStandaloneHtml(deck: DeckDocument, options: StandaloneRenderOptions = {}): string {
  const theme = resolveTheme(deck.meta.theme, options.themeTokens);
  const mode = options.mode ?? deck.meta.mode ?? "audience";
  const profile = options.profile ?? deck.meta.compatibility ?? "agentdeck";
  const stats = deckStats(deck);
  const slides = deck.slides.map((slide, index) => renderSlide(deck, slide, index, deck.slides.length, options)).join("\n");
  const overviewSlides = deck.slides.map((slide, index) => renderOverviewSlide(deck, slide, index, options)).join("\n");
  const deckJson = options.includeSourceJson === false ? "" : `<script type="application/json" id="agentdeck-source">${escapeHtml(JSON.stringify(deck))}</script>`;
  const printHelpNote = profile === "agentdeck"
    ? "For pixel-perfect export, prefer CLI: <code>agentdeck export deck.md --pdf</code><br>如果要更稳定的高保真导出，优先使用 CLI。"
    : "For wrapped files, use browser print or re-run wrap with a higher DPI, such as <code>agentdeck wrap input.pdf --dpi 220</code>.<br>封装已有文件时，可用浏览器打印，或重新 wrap 并提高 DPI。";
  const sourceStyles = typeof deck.meta.sourceStyles === "string" && deck.meta.sourceStyles.trim()
    ? `<style data-agentdeck-source-styles>${escapeStyleContent(deck.meta.sourceStyles)}</style>`
    : "";

  return `<!doctype html>
<html lang="${escapeAttr(deck.meta.lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="AgentDeck">
  <meta property="og:title" content="${escapeAttr(deck.meta.title)}">
  ${deck.meta.subtitle ? `<meta property="og:description" content="${escapeAttr(deck.meta.subtitle)}">` : ""}
  <title>${escapeHtml(deck.meta.title)}</title>
  <style>${baseCss}</style>
  <style>
    :root {
      --ad-paper: ${theme.paper};
      --ad-ink: ${theme.ink};
      --ad-accent: ${theme.accent};
      --ad-accent-alt: ${theme.accentAlt};
      --ad-muted: ${theme.muted};
      --ad-surface: ${theme.surface};
      --ad-font-sans: ${theme.fontSans};
      --ad-font-serif: ${theme.fontSerif};
      --ad-font-mono: ${theme.fontMono};
    }
  </style>
  ${sourceStyles}
</head>
<body data-theme="${escapeAttr(theme.id)}" data-color-mode="light" data-deck-mode="${escapeAttr(mode)}" data-compat-profile="${escapeAttr(profile)}">
  <div class="agentdeck-app">
    <div class="ad-dock-zone" data-dock-zone data-html2canvas-ignore></div>
    <header class="ad-dock" data-html2canvas-ignore>
      <div class="ad-toolbar-group ad-toolbar-group--nav" aria-label="Slide navigation">
        <button type="button" data-action="restart" aria-label="Restart deck" title="Restart">${icon("restart")}</button>
        <button type="button" data-action="prev" aria-label="Previous slide" title="Previous slide">‹</button>
        <button type="button" data-action="play" aria-label="Toggle autoplay" title="Autoplay">${icon("play")}</button>
        <button type="button" data-action="interval" class="ad-interval-button" aria-label="Change autoplay interval" title="Autoplay interval"><span data-interval-label>8s</span></button>
        <span class="ad-counter"><span data-current>1</span> / ${deck.slides.length}</span>
        <button type="button" data-action="next" aria-label="Next slide" title="Next slide">›</button>
      </div>
      <div class="ad-toolbar-group" aria-label="Theme">
        <span class="ad-toolbar-icon" aria-hidden="true">${icon("monitor")}</span>
        <div class="ad-segmented">
          <button type="button" data-action="theme" data-theme-value="light" class="is-active" aria-label="Use light theme" title="Light">${icon("sun")}<span>Light</span></button>
          <button type="button" data-action="theme" data-theme-value="dark" aria-label="Use dark theme" title="Dark">${icon("moon")}<span>Dark</span></button>
        </div>
      </div>
      <div class="ad-toolbar-group">
        <button type="button" data-action="compare" class="ad-icon-only" aria-label="Toggle compare view" title="Compare View">${icon("compare")}</button>
        <button type="button" data-action="overview" class="ad-icon-only" aria-label="Open overview" title="Overview">${icon("grid")}</button>
        <button type="button" data-action="blackout" class="ad-icon-only" aria-label="Toggle blank screen" title="Blank screen">${icon("lights-off")}</button>
        <button type="button" data-action="spotlight" class="ad-icon-only" aria-label="Toggle spotlight" title="Spotlight">${icon("spotlight")}</button>
      </div>
      <div class="ad-toolbar-group">
        <button type="button" data-action="dock-autohide" class="ad-icon-only" aria-label="Auto-hide toolbar" title="Auto-hide toolbar" aria-pressed="false">${icon("dock-hide")}</button>
        <button type="button" data-action="fullscreen" class="ad-icon-only" aria-label="Enter fullscreen" title="Fullscreen">${icon("fullscreen")}</button>
        <button type="button" data-action="print" class="ad-icon-only" aria-label="Print or save PDF" title="Print / PDF">${icon("download")}</button>
      </div>
    </header>
    <div class="ad-progress" data-html2canvas-ignore><span data-progress-bar></span></div>
    <main class="ad-stage" aria-live="polite">
      <div class="ad-scaled-shell" data-shell>
        <div class="ad-scaled" data-scaled>
          ${slides}
        </div>
      </div>
    </main>
    <div class="ad-overview" data-overlay="overview" data-html2canvas-ignore hidden>
      <div class="ad-overview-head">
        <div class="ad-overview-title">
          <strong>${escapeHtml(deck.meta.title)}</strong>
          <p>Click a thumbnail to jump · 点击缩略图跳转</p>
        </div>
      </div>
      <div class="ad-overview-grid">${overviewSlides}</div>
      <button type="button" class="ad-overview-close" data-action="overview-close" aria-label="Close overview" title="Close overview">${icon("grid")}</button>
    </div>
    <div class="ad-compare" data-overlay="compare" data-html2canvas-ignore hidden>
      <div class="ad-compare-viewport" data-compare-next></div>
    </div>
    <div class="ad-print-help" data-overlay="print-help" data-html2canvas-ignore hidden>
      <div class="ad-print-help-card">
        <strong>Print / PDF · 打印 / PDF</strong>
        <p>Browser PDF depends on the print dialog, not just the deck.<br>浏览器导出 PDF 取决于打印设置，不只是页面本身。</p>
        <ul>
          <li>Turn on Background graphics · 打开背景图形</li>
          <li>Turn off Headers and footers · 关闭页眉和页脚</li>
          <li>Keep margins at None or Default zero-margin mode · 使用无边距或零边距模式</li>
        </ul>
        <p class="ad-print-help-note">${printHelpNote}</p>
        <div class="ad-print-help-actions">
          <button type="button" data-action="print-close">Close / 关闭</button>
          <button type="button" data-action="print-confirm">Continue / 继续</button>
        </div>
      </div>
    </div>
    <div class="ad-blackout" data-overlay="blackout" data-action="blackout" data-html2canvas-ignore hidden>
      <strong>Blank screen</strong>
      <span>Click anywhere, press B, or press Esc to return</span>
    </div>
    <div class="ad-spotlight" data-overlay="spotlight" data-html2canvas-ignore hidden></div>
    <aside class="ad-presenter-panel" data-panel="presenter" data-html2canvas-ignore>
      <section>
        <p class="ad-panel-label">Presenter</p>
        <strong data-timer>00:00</strong>
      </section>
      <section>
        <p class="ad-panel-label">Notes</p>
        ${deck.slides.map((slide, index) => `<article data-note="${index}" ${index === 0 ? "" : "hidden"}>${escapeHtml(slide.note || "No speaker note for this slide.")}</article>`).join("")}
      </section>
      <section>
        <p class="ad-panel-label">Next</p>
        <div data-next-title>${escapeHtml(deck.slides[1]?.title ?? "End")}</div>
      </section>
    </aside>
    <aside class="ad-creator-panel" data-panel="creator" data-html2canvas-ignore>
      <section>
        <p class="ad-panel-label">Deck Studio</p>
        <strong>${deck.slides.length} slides</strong>
        <p>${escapeHtml(stats.summary)}</p>
        <div class="ad-stat-grid">
          <div><span>Layouts</span><b>${stats.layoutCount}</b></div>
          <div><span>Notes</span><b>${stats.noteCount}</b></div>
          <div><span>Dense</span><b>${stats.denseCount}</b></div>
        </div>
      </section>
      <section>
        <p class="ad-panel-label">Presentation Tools</p>
        <div class="ad-shortcut-grid">
          <div><kbd>O</kbd><span>Overview</span></div>
          <div><kbd>B</kbd><span>Black screen</span></div>
          <div><kbd>L</kbd><span>Spotlight</span></div>
          <div><kbd>F</kbd><span>Fullscreen</span></div>
        </div>
      </section>
      <section>
        <p class="ad-panel-label">Quality Checks</p>
        <ul class="ad-check-list">
          <li class="${stats.denseCount === 0 ? "is-covered" : ""}">No dense text slides</li>
          <li class="${stats.noteCount === deck.slides.length ? "is-covered" : ""}">Speaker notes coverage</li>
          <li class="${stats.imageSlotWarnings === 0 ? "is-covered" : ""}">Image slots ready</li>
          <li class="${stats.layoutCount >= 4 ? "is-covered" : ""}">Layout variety</li>
        </ul>
      </section>
      <section>
        <p class="ad-panel-label">Outline</p>
        <ol class="ad-outline-list">
          ${deck.slides.map((slide, index) => `<li><button type="button" data-goto="${index}"><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(slide.title)}</button></li>`).join("")}
        </ol>
      </section>
      <section>
        <p class="ad-panel-label">Export Pack</p>
        <div class="ad-chip-row">${deck.meta.outputs.map((output) => `<span>${escapeHtml(output)}</span>`).join("")}</div>
        <code class="ad-command">agentdeck export deck.md --pdf --png --long-image --grid9</code>
      </section>
    </aside>
  </div>
  ${deckJson}
  <script>${runtimeJs}</script>
</body>
</html>`;
}

function deckText(deck: DeckDocument): string {
  return [
    deck.meta.title,
    deck.meta.subtitle,
    ...deck.slides.flatMap((slide) => [
      slide.title,
      slide.note,
      ...slide.blocks.map((block) => {
        if ("text" in block) return block.text;
        if ("items" in block) return block.items.join(" ");
        if (block.type === "table") return [...block.headers, ...block.rows.flat()].join(" ");
        return "";
      }),
    ]),
  ].filter(Boolean).join(" ");
}

function deckStats(deck: DeckDocument): {
  summary: string;
  layoutCount: number;
  noteCount: number;
  denseCount: number;
  imageSlotWarnings: number;
} {
  const layouts = new Set(deck.slides.map((slide) => slide.layout));
  const noteCount = deck.slides.filter((slide) => Boolean(slide.note?.trim())).length;
  const denseCount = deck.slides.filter((slide) => slideBodyLength(slide) > 520 || slide.title.length > 72).length;
  const imageSlotWarnings = deck.slides.filter((slide) => slide.blocks.some((block) => block.type === "image") && !slide.imageSlot).length;
  const warnings: string[] = [];
  if (denseCount > 0) warnings.push(`${denseCount} dense slide(s)`);
  if (noteCount < deck.slides.length) warnings.push(`${deck.slides.length - noteCount} missing note(s)`);
  if (imageSlotWarnings > 0) warnings.push(`${imageSlotWarnings} image slot warning(s)`);
  return {
    summary: warnings.length ? warnings.join(" · ") : "Ready for audience, presenter, and export modes.",
    layoutCount: layouts.size,
    noteCount,
    denseCount,
    imageSlotWarnings,
  };
}

function slideBodyLength(slide: Slide): number {
  return slide.blocks
    .map((block) => {
      if ("text" in block) return block.text.length;
      if ("items" in block) return block.items.join("").length;
      if (block.type === "table") return [...block.headers, ...block.rows.flat()].join("").length;
      return 0;
    })
    .reduce((sum, length) => sum + length, 0);
}

function renderOverviewSlide(deck: DeckDocument, slide: Slide, index: number, options: StandaloneRenderOptions): string {
  const blocks = slide.blocks.length ? slide.blocks.map((block) => renderBlock(block, options)).join("\n") : "";
  const subtitle = index === 0 ? deck.meta.subtitle ?? deck.meta.author ?? "" : slide.note ?? "";
  const kicker = index === 0 ? "" : `<p class="ad-kicker">${escapeHtml(slide.dataLayout || slide.layout)}</p>`;
  if (slide.layout === "html-import") {
    return `<button type="button" class="ad-overview-card${index === 0 ? " is-current" : ""}" data-goto="${index}" data-overview-index="${index}" aria-label="Go to slide ${index + 1}: ${escapeAttr(slide.title)}">
      <div class="ad-overview-viewport">
        <section class="ad-slide ad-overview-slide layout-html-import" data-agentdeck-layout="html-import">
          <div class="ad-content"><div class="ad-blocks">${blocks}</div></div>
        </section>
      </div>
    </button>`;
  }
  return `<button type="button" class="ad-overview-card${index === 0 ? " is-current" : ""}" data-goto="${index}" data-overview-index="${index}" aria-label="Go to slide ${index + 1}: ${escapeAttr(slide.title)}">
    <div class="ad-overview-viewport">
      <section class="ad-slide ad-overview-slide layout-${escapeAttr(slide.layout)}" data-agentdeck-layout="${escapeAttr(slide.layout)}" ${slide.dataLayout ? `data-layout="${escapeAttr(slide.dataLayout)}"` : ""}>
        <div class="ad-content">
          <header class="ad-slide-head">
            ${kicker}
            <h1>${escapeHtml(slide.title)}</h1>
            ${subtitle ? `<p class="ad-lead">${escapeHtml(subtitle)}</p>` : ""}
          </header>
          <div class="ad-blocks">${blocks}</div>
        </div>
        <div class="ad-page-indicator" aria-hidden="true">${String(index + 1).padStart(2, "0")}</div>
        <div class="ad-brand-line"></div>
      </section>
    </div>
  </button>`;
}

function renderSlide(deck: DeckDocument, slide: Slide, index: number, count: number, options: StandaloneRenderOptions): string {
  const blocks = slide.blocks.length ? slide.blocks.map((block) => renderBlock(block, options)).join("\n") : "";
  if (slide.layout === "html-import") {
    return `<section class="ad-slide layout-html-import" data-export-page data-slide-index="${index}" data-agentdeck-layout="html-import" aria-label="${escapeAttr(slide.title)}" ${index === 0 ? "" : "hidden"}>
      <div class="ad-content"><div class="ad-blocks">${blocks}</div></div>
    </section>`;
  }
  const subtitle = index === 0 ? deck.meta.subtitle ?? deck.meta.author ?? "" : slide.note ?? "";
  const kicker = index === 0 ? "" : `<p class="ad-kicker">${escapeHtml(slide.dataLayout || slide.layout)}</p>`;
  return `<section class="ad-slide layout-${escapeAttr(slide.layout)}" data-export-page data-slide-index="${index}" data-agentdeck-layout="${escapeAttr(slide.layout)}" ${slide.dataLayout ? `data-layout="${escapeAttr(slide.dataLayout)}"` : ""} aria-label="${escapeAttr(slide.title)}" ${index === 0 ? "" : "hidden"}>
    <div class="ad-content">
      <header class="ad-slide-head">
        ${kicker}
        <h1>${escapeHtml(slide.title)}</h1>
        ${subtitle ? `<p class="ad-lead">${escapeHtml(subtitle)}</p>` : ""}
      </header>
      <div class="ad-blocks">${blocks}</div>
    </div>
    <div class="ad-page-indicator" aria-hidden="true">${String(index + 1).padStart(2, "0")}</div>
    <div class="ad-brand-line"></div>
  </section>`;
}

function renderBlock(block: SlideBlock, options: StandaloneRenderOptions): string {
  switch (block.type) {
    case "paragraph":
      return `<p class="ad-paragraph">${inlineMarkdown(block.text)}</p>`;
    case "list":
      return `<ul class="ad-list">${block.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`;
    case "quote":
      return `<blockquote class="ad-quote">${inlineMarkdown(block.text)}${block.cite ? `<cite>${escapeHtml(block.cite)}</cite>` : ""}</blockquote>`;
    case "image": {
      const src = options.assetResolver?.(block.src) ?? block.src;
      return `<figure class="ad-image" ${block.slot ? `data-image-slot="${escapeAttr(block.slot)}"` : ""}><img src="${escapeAttr(src)}" alt="${escapeAttr(block.alt)}">${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}</figure>`;
    }
    case "table":
      return `<table class="ad-table"><thead><tr>${block.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    case "code":
      return `<figure class="ad-code"><figcaption>${escapeHtml(block.language)}</figcaption><pre><code>${escapeHtml(block.code)}</code></pre></figure>`;
    case "kpi":
      return `<div class="ad-kpi"><span>${escapeHtml(block.label)}</span><strong>${escapeHtml(block.value)}</strong>${block.detail ? `<p>${escapeHtml(block.detail)}</p>` : ""}</div>`;
    case "diagram":
      return `<figure class="ad-diagram"><pre>${escapeHtml(block.code)}</pre><figcaption>${escapeHtml(block.syntax)}</figcaption></figure>`;
    case "formula":
      return `<div class="ad-formula">${escapeHtml(block.text)}</div>`;
    case "html":
      return `<div class="ad-html-block">${block.html}</div>`;
  }
}

function icon(name: "monitor" | "sun" | "moon" | "fullscreen" | "download" | "grid" | "spotlight" | "restart" | "compare" | "play" | "lights-off" | "dock-hide" | "x"): string {
  const paths: Record<typeof name, string> = {
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M8 20h8"></path><path d="M12 16v4"></path>',
    sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>',
    moon: '<path d="M12 3a6.7 6.7 0 0 0 9 9 8 8 0 1 1-9-9Z"></path>',
    fullscreen: '<path d="M8 3H5a2 2 0 0 0-2 2v3"></path><path d="M16 3h3a2 2 0 0 1 2 2v3"></path><path d="M21 16v3a2 2 0 0 1-2 2h-3"></path><path d="M8 21H5a2 2 0 0 1-2-2v-3"></path>',
    download: '<path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect>',
    spotlight: '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3"></path><path d="M12 19v3"></path><path d="M2 12h3"></path><path d="M19 12h3"></path><path d="m4.9 4.9 2.1 2.1"></path><path d="m17 17 2.1 2.1"></path><path d="m19.1 4.9-2.1 2.1"></path><path d="m7 17-2.1 2.1"></path>',
    restart: '<path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v6h6"></path>',
    compare: '<rect x="3" y="5" width="7" height="14" rx="1.5"></rect><rect x="14" y="5" width="7" height="14" rx="1.5"></rect><path d="M12 5v14"></path>',
    play: '<path d="M7 5v14l11-7z"></path>',
    "lights-off": '<path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M12 2a6 6 0 0 1 4.8 9.6c-.85 1.1-1.8 2.1-2.3 3.4h-5c-.5-1.3-1.45-2.3-2.3-3.4A6 6 0 0 1 12 2Z"></path><path d="m4 4 16 16"></path>',
    "dock-hide": '<path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"></path><path d="M8 20h8"></path><path d="M12 16v4"></path><path d="m8 10 4 3 4-3"></path>',
    x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
  };
  return `<svg class="ad-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function escapeStyleContent(value: string): string {
  return value.replace(/<\/style/gi, "<\\/style");
}
