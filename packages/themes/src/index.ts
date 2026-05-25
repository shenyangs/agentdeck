import type { LayoutManifest, ThemeId } from "@agentdeck/schema";

export interface ThemeTokens {
  id: string;
  label: string;
  paper: string;
  ink: string;
  accent: string;
  accentAlt: string;
  muted: string;
  surface: string;
  fontSans: string;
  fontSerif: string;
  fontMono: string;
}

export const themeTokens: Record<ThemeId, ThemeTokens> = {
  editorial: {
    id: "editorial",
    label: "Editorial Magazine",
    paper: "#fbfaf6",
    ink: "#16130f",
    accent: "#b44c34",
    accentAlt: "#174d4a",
    muted: "#756f66",
    surface: "#f0ece2",
    fontSans: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSerif: "Georgia, 'Times New Roman', 'Noto Serif SC', serif",
    fontMono: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
  },
  swiss: {
    id: "swiss",
    label: "Swiss International",
    paper: "#ffffff",
    ink: "#0a0a0a",
    accent: "#0038ff",
    accentAlt: "#f5ff00",
    muted: "#686868",
    surface: "#f4f4f4",
    fontSans: "Inter, Helvetica, Arial, 'Noto Sans SC', sans-serif",
    fontSerif: "Georgia, 'Times New Roman', serif",
    fontMono: "'SFMono-Regular', 'JetBrains Mono', Consolas, monospace",
  },
  launch: {
    id: "launch",
    label: "Product Launch",
    paper: "#f9fbff",
    ink: "#111827",
    accent: "#f05a28",
    accentAlt: "#00a6a6",
    muted: "#667085",
    surface: "#eef4ff",
    fontSans: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSerif: "Georgia, serif",
    fontMono: "'SFMono-Regular', Consolas, monospace",
  },
  course: {
    id: "course",
    label: "Course Notes",
    paper: "#fffdf7",
    ink: "#17211b",
    accent: "#2563eb",
    accentAlt: "#16a34a",
    muted: "#65726b",
    surface: "#eff6f1",
    fontSans: "Inter, ui-sans-serif, system-ui, 'Noto Sans SC', sans-serif",
    fontSerif: "Georgia, serif",
    fontMono: "'SFMono-Regular', Consolas, monospace",
  },
};

const all = "all" as const;

export const layoutRegistry: LayoutManifest[] = [
  layout("cover", all, "Cover", "Opening title and identity", ["title", "subtitle", "author"], { maxTitleChars: 48 }, ["Use for the first slide only."]),
  layout("statement", all, "Statement", "One strong claim with very little body copy", ["title"], { maxTitleChars: 72, maxBodyChars: 120 }, ["Rewrite into one memorable sentence."]),
  layout("section", all, "Section", "Chapter divider", ["title", "body"], { maxTitleChars: 42, maxBodyChars: 180 }, ["Use between narrative chapters."]),
  layout("quote", all, "Quote", "Large quotation or testimonial", ["quote", "cite"], { maxBodyChars: 260 }, ["Keep attribution short."]),
  layout("kpi", all, "KPI", "Metric-led argument", ["metric", "body"], { maxItems: 4, maxBodyChars: 220 }, ["Only use real numbers."]),
  layout("comparison", all, "Comparison", "Before/after or A/B comparison", ["left", "right"], { maxItems: 6, maxBodyChars: 320 }, ["Balance both sides."]),
  layout("timeline", all, "Timeline", "Chronology or roadmap", ["items"], { maxItems: 7, maxBodyChars: 420 }, ["Use dates or sequence labels."]),
  layout("steps", all, "Steps", "Ordered workflow", ["items"], { maxItems: 6, maxBodyChars: 420 }, ["Use verbs at the start of each step."]),
  layout("cards", all, "Cards", "Small group of idea cards", ["items"], { maxItems: 6, maxBodyChars: 520 }, ["Avoid nested paragraphs."]),
  layout("table", all, "Table", "Dense comparable data", ["table"], { maxItems: 8 }, ["Keep columns to four or fewer."]),
  layout("code", all, "Code", "Code listing with context", ["code", "body"], { maxBodyChars: 180 }, ["Keep code under 18 lines."]),
  layout("formula", all, "Formula", "Math or symbolic expression", ["formula", "body"], { maxBodyChars: 160 }, ["Explain the formula in speaker notes."]),
  layout("diagram", all, "Diagram", "System or flow diagram", ["diagram", "caption"], { maxBodyChars: 220 }, ["Prefer HTML/SVG labels over raster text."]),
  layout("screenshot", all, "Screenshot", "Product or webpage screenshot", ["image"], { maxImages: 1, maxBodyChars: 160 }, ["Bind screenshot to a named slot."]),
  layout("evidence-grid", all, "Evidence Grid", "Multiple proof images or claims", ["images", "captions"], { maxImages: 6, maxBodyChars: 260 }, ["Use images as evidence, not decoration."]),
  layout("image-hero", all, "Image Hero", "Single dominant image", ["image", "caption"], { maxImages: 1, maxBodyChars: 160 }, ["Use high-resolution images."]),
  layout("closing", all, "Closing", "Final takeaway and contact", ["title", "items"], { maxItems: 3, maxBodyChars: 240 }, ["End with three or fewer takeaways."]),
  layout("split", all, "Split", "Left text, right visual", ["body", "image"], { maxImages: 1, maxBodyChars: 280 }, ["Keep one side visually dominant."]),
  layout("checklist", all, "Checklist", "Checklist or readiness list", ["items"], { maxItems: 8, maxBodyChars: 420 }, ["Use binary, verifiable wording."]),
  layout("insight", all, "Insight", "Default narrative body slide", ["title", "body"], { maxBodyChars: 520 }, ["One idea per slide."]),
  layout("html-import", all, "Imported HTML", "Full-slide HTML imported from an external deck or PPT skill", ["body"], {}, ["Preserve the source deck visual work and only add AgentDeck playback controls."]),
];

export function resolveTheme(theme: string | undefined, overrides: Partial<ThemeTokens> = {}): ThemeTokens {
  const base = themeTokens[(theme as ThemeId) || "editorial"] ?? themeTokens.editorial;
  return {
    ...base,
    ...overrides,
    id: overrides.id ?? base.id,
    label: overrides.label ?? base.label,
  };
}

export function getLayout(id: string): LayoutManifest | undefined {
  return layoutRegistry.find((manifest) => manifest.id === id);
}

function layout(
  id: string,
  theme: LayoutManifest["theme"],
  title: string,
  purpose: string,
  slotIds: string[],
  contentLimits: LayoutManifest["contentLimits"],
  agentHints: string[],
): LayoutManifest {
  return {
    id,
    theme,
    title,
    purpose,
    slots: slotIds.map((slotId) => ({
      id: slotId,
      kind: slotKind(slotId),
      required: slotId === "title" || slotId === "image" || slotId === "items",
      ratio: slotId.includes("image") ? "16:9" : undefined,
    })),
    contentLimits,
    exportSafe: {
      pdf: true,
      png: true,
      singleHtml: true,
    },
    agentHints,
    compatibleWith: [],
  };
}

function slotKind(slotId: string): LayoutManifest["slots"][number]["kind"] {
  if (slotId.includes("image")) return "image";
  if (slotId === "table") return "table";
  if (slotId === "code") return "code";
  if (slotId === "diagram") return "diagram";
  if (slotId === "metric") return "metric";
  return "text";
}
