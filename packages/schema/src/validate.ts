import type { DeckDocument, Diagnostic, LayoutManifest } from "./types.js";

const SUPPORTED_OUTPUTS = new Set(["html", "pdf", "png", "long-image", "grid9", "cover", "social-pack"]);

export function validateDeck(
  deck: DeckDocument,
  layouts: LayoutManifest[] = [],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const layoutIds = new Set(layouts.map((layout) => layout.id));

  if (!deck.meta.title || deck.meta.title === "Untitled Deck") {
    diagnostics.push({ level: "error", code: "meta.title", message: "Deck frontmatter must include a title." });
  }
  if (deck.meta.aspect !== "16:9") {
    diagnostics.push({ level: "error", code: "meta.aspect", message: "Only aspect: 16:9 is supported in this release." });
  }
  for (const output of deck.meta.outputs) {
    if (!SUPPORTED_OUTPUTS.has(output)) {
      diagnostics.push({ level: "error", code: "meta.outputs", message: `Unsupported output: ${output}.` });
    }
  }
  if (deck.meta.mode !== "audience" && !["presenter", "creator"].includes(deck.meta.mode)) {
    diagnostics.push({ level: "error", code: "meta.mode", message: "mode must be audience, presenter, or creator." });
  }
  if (deck.slides.length === 0) {
    diagnostics.push({ level: "error", code: "slides.empty", message: "Deck must contain at least one # slide heading." });
  }

  deck.slides.forEach((slide, index) => {
    const slideIndex = index + 1;
    if (!slide.title.trim()) {
      diagnostics.push({ level: "error", code: "slide.title", message: "Slide title cannot be empty.", slideIndex });
    }
    if (layouts.length > 0 && !layoutIds.has(slide.layout)) {
      diagnostics.push({
        level: "error",
        code: "slide.layout",
        message: `Unknown layout "${slide.layout}".`,
        slideIndex,
        detail: "Use one of the layout IDs registered by @agentdeck/themes.",
      });
    }
    if (slide.title.length > 72) {
      diagnostics.push({
        level: "warning",
        code: "slide.title.length",
        message: "Slide title is long and may overflow fixed 16:9 layouts.",
        slideIndex,
      });
    }

    const images = slide.blocks.filter((block) => block.type === "image");
    if (images.length > 0 && slide.layout.includes("image") && !slide.imageSlot && images.every((image) => image.type === "image" && !image.slot)) {
      diagnostics.push({
        level: "warning",
        code: "image.slot",
        message: "Image-heavy slides should bind images to a named slot for export-safe layout.",
        slideIndex,
      });
    }

    const textLength = slide.blocks
      .filter((block) => block.type === "paragraph" || block.type === "quote")
      .map((block) => ("text" in block ? block.text.length : 0))
      .reduce((sum, length) => sum + length, 0);
    if (textLength > 520) {
      diagnostics.push({
        level: "warning",
        code: "slide.text.dense",
        message: "Slide body is dense; split it or choose a document-style layout.",
        slideIndex,
      });
    }
  });

  return diagnostics;
}

export function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.level === "error");
}

export function formatDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) return "No diagnostics.";
  return diagnostics
    .map((diagnostic) => {
      const scope = diagnostic.slideIndex ? `slide ${diagnostic.slideIndex}` : "deck";
      return `${diagnostic.level.toUpperCase()} ${diagnostic.code} (${scope}): ${diagnostic.message}${diagnostic.detail ? ` ${diagnostic.detail}` : ""}`;
    })
    .join("\n");
}
