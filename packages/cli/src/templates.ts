import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import type {
  DeckDocument,
  DeckLock,
  Diagnostic,
  LayoutManifest,
  TemplateLayout,
  TemplatePack,
  ThemeId,
} from "@agentdeck/schema";
import { layoutRegistry, resolveTheme, type ThemeTokens } from "@agentdeck/themes";
import { AGENTDECK_VERSION } from "./reports.js";

const BUILT_IN_THEME_IDS = new Set(["editorial", "swiss", "launch", "course"]);

export interface TemplateContext {
  pack?: TemplatePack;
  templatePath?: string;
  diagnostics: Diagnostic[];
  layouts: LayoutManifest[];
  themeTokens?: ThemeTokens;
}

export function isBuiltInTheme(theme: string): boolean {
  return BUILT_IN_THEME_IDS.has(theme);
}

export function resolveTemplateContext(deck: DeckDocument, deckPath: string): TemplateContext {
  if (isBuiltInTheme(deck.meta.theme)) {
    return {
      diagnostics: [],
      layouts: layoutRegistry,
    };
  }

  const templatePath = resolveTemplateJsonPath(deck.meta.theme, dirname(deckPath));
  if (!existsSync(templatePath)) {
    return {
      templatePath,
      diagnostics: [{
        level: "error",
        code: "template.missing",
        message: `Template pack not found: ${templatePath}`,
        detail: "Use a built-in theme or point theme to a directory/file containing template.json.",
      }],
      layouts: layoutRegistry,
    };
  }
  if (!statSync(templatePath).isFile()) {
    return {
      templatePath,
      diagnostics: [{
        level: "error",
        code: "template.path",
        message: `Template path is not a file: ${templatePath}`,
      }],
      layouts: layoutRegistry,
    };
  }

  const { pack, diagnostics } = readTemplatePack(templatePath);
  if (!pack) {
    return { templatePath, diagnostics, layouts: layoutRegistry };
  }

  const templateLayouts = (pack.layouts ?? []).map((layout) => normalizeTemplateLayout(layout));
  const templateLayoutIds = new Set(templateLayouts.map((layout) => layout.id));
  const layouts = templateLayouts.length > 0
    ? [...templateLayouts, ...layoutRegistry.filter((layout) => !templateLayoutIds.has(layout.id))]
    : layoutRegistry;
  const baseTheme = isBuiltInTheme(pack.baseTheme ?? "") ? pack.baseTheme as ThemeId : "editorial";
  const themeTokens = resolveTheme(baseTheme, {
    ...pack.tokens,
    id: pack.id,
    label: pack.name ?? pack.id,
  });

  return {
    pack: { ...pack, baseTheme },
    templatePath,
    diagnostics,
    layouts,
    themeTokens,
  };
}

export function createDeckLock(deck: DeckDocument, deckPath: string, context: TemplateContext): DeckLock {
  const layoutById = new Map(context.layouts.map((layout) => [layout.id, layout]));
  const templateLayoutIds = new Set((context.pack?.layouts ?? []).map((layout) => layout.id));
  const templatePath = context.templatePath ? shortPath(context.templatePath) : undefined;

  return {
    schemaVersion: "1.0",
    agentdeckVersion: AGENTDECK_VERSION,
    source: basename(deckPath),
    title: deck.meta.title,
    theme: deck.meta.theme,
    template: context.pack && templatePath ? {
      id: context.pack.id,
      name: context.pack.name,
      path: templatePath,
      baseTheme: context.pack.baseTheme ?? "editorial",
      strict: Boolean(context.pack.quality?.strict),
    } : undefined,
    slides: deck.slides.map((slide, index) => {
      const layout = layoutById.get(slide.layout);
      return {
        index: index + 1,
        id: slide.id,
        title: slide.title,
        layout: slide.layout,
        templateLayout: templateLayoutIds.has(slide.layout),
        slots: layout?.slots ?? [],
        contentLimits: layout?.contentLimits ?? {},
      };
    }),
    warnings: context.diagnostics
      .filter((diagnostic) => diagnostic.level !== "error")
      .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`),
  };
}

export function starterTemplatePack(id: string, baseTheme: ThemeId = "swiss"): TemplatePack {
  return {
    schemaVersion: "1.0",
    id,
    name: titleize(id),
    description: "AgentDeck template pack for Markdown authoring.",
    baseTheme,
    tokens: {
      paper: "#ffffff",
      ink: "#111111",
      accent: "#0038ff",
      accentAlt: "#f5ff00",
      muted: "#666666",
      surface: "#f4f4f4",
      fontSans: "Inter, Helvetica, Arial, 'Noto Sans SC', sans-serif",
      fontSerif: "Georgia, 'Times New Roman', serif",
      fontMono: "'SFMono-Regular', 'JetBrains Mono', Consolas, monospace",
    },
    layouts: [
      {
        id: "cover",
        title: "Cover",
        purpose: "Opening title and identity.",
        slots: [
          { id: "title", kind: "text", required: true },
          { id: "subtitle", kind: "text" },
          { id: "author", kind: "text" },
        ],
        contentLimits: { maxTitleChars: 48 },
        agentHints: ["Use for the first slide only."],
      },
      {
        id: "insight",
        title: "Insight",
        purpose: "Default narrative body slide.",
        slots: [
          { id: "title", kind: "text", required: true },
          { id: "body", kind: "text" },
        ],
        contentLimits: { maxTitleChars: 72, maxBodyChars: 520 },
        agentHints: ["One idea per slide."],
      },
      {
        id: "image-hero",
        title: "Image Hero",
        purpose: "Single dominant image with short caption.",
        slots: [
          { id: "image", kind: "image", ratio: "16:9", required: true },
          { id: "caption", kind: "text" },
        ],
        contentLimits: { maxImages: 1, maxBodyChars: 160 },
        agentHints: ["Bind the image to image-slot: image."],
      },
    ],
    quality: {
      strict: false,
      allowedColors: ["#ffffff", "#111111", "#0038ff", "#f5ff00", "#666666", "#f4f4f4"],
      requiredLayouts: ["cover"],
    },
  };
}

function resolveTemplateJsonPath(theme: string, baseDir: string): string {
  const path = isAbsolute(theme) ? theme : resolve(baseDir, theme);
  return path.endsWith(".json") ? path : join(path, "template.json");
}

function readTemplatePack(templatePath: string): { pack?: TemplatePack; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(templatePath, "utf8"));
  } catch (error) {
    return {
      diagnostics: [{
        level: "error",
        code: "template.json",
        message: `Could not parse template JSON: ${templatePath}`,
        detail: error instanceof Error ? error.message : String(error),
      }],
    };
  }

  if (!isObject(value) || typeof value.id !== "string" || !value.id.trim()) {
    return {
      diagnostics: [{
        level: "error",
        code: "template.id",
        message: "template.json must include a non-empty string id.",
      }],
    };
  }

  if (value.baseTheme && (typeof value.baseTheme !== "string" || !isBuiltInTheme(value.baseTheme))) {
    diagnostics.push({
      level: "warning",
      code: "template.baseTheme",
      message: `Unknown baseTheme "${String(value.baseTheme)}"; falling back to editorial.`,
    });
  }

  return { pack: value as unknown as TemplatePack, diagnostics };
}

function normalizeTemplateLayout(layout: TemplateLayout): LayoutManifest {
  const fallback = layoutRegistry.find((candidate) => candidate.id === layout.id);
  return {
    id: layout.id,
    theme: "all",
    title: layout.title ?? fallback?.title ?? titleize(layout.id),
    purpose: layout.purpose ?? fallback?.purpose ?? "Template-defined layout.",
    slots: layout.slots ?? fallback?.slots ?? [],
    contentLimits: layout.contentLimits ?? fallback?.contentLimits ?? {},
    exportSafe: layout.exportSafe ?? fallback?.exportSafe ?? {
      pdf: true,
      png: true,
      singleHtml: true,
    },
    agentHints: layout.agentHints ?? fallback?.agentHints ?? [],
    compatibleWith: layout.compatibleWith ?? fallback?.compatibleWith ?? [],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function titleize(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortPath(filePath: string): string {
  const relativePath = relative(process.cwd(), filePath);
  return relativePath && !relativePath.startsWith("..") ? relativePath : filePath;
}
