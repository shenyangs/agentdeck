export type ThemeId = "editorial" | "swiss" | "launch" | "course";

export type DeckMode = "audience" | "presenter" | "creator";

export type CompatibilityProfile = "agentdeck" | "external-html" | "rendered-file";

export type OutputFormat =
  | "html"
  | "pdf"
  | "png"
  | "long-image"
  | "grid9"
  | "cover"
  | "social-pack";

export type DiagnosticLevel = "error" | "warning" | "info";

export interface Diagnostic {
  level: DiagnosticLevel;
  code: string;
  message: string;
  slideIndex?: number;
  detail?: string;
}

export interface DeckMeta {
  title: string;
  subtitle?: string;
  author?: string;
  lang: string;
  theme: string;
  aspect: "16:9";
  outputs: OutputFormat[];
  audience?: string;
  mode: DeckMode;
  variants: string[];
  compatibility: CompatibilityProfile;
  filenameStem: string;
  [key: string]: unknown;
}

export type BlockType =
  | "paragraph"
  | "list"
  | "quote"
  | "image"
  | "table"
  | "code"
  | "kpi"
  | "diagram"
  | "formula"
  | "html";

export interface BaseBlock {
  type: BlockType;
}

export interface ParagraphBlock extends BaseBlock {
  type: "paragraph";
  text: string;
}

export interface ListBlock extends BaseBlock {
  type: "list";
  items: string[];
}

export interface QuoteBlock extends BaseBlock {
  type: "quote";
  text: string;
  cite?: string;
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  src: string;
  alt: string;
  slot?: string;
  caption?: string;
}

export interface TableBlock extends BaseBlock {
  type: "table";
  headers: string[];
  rows: string[][];
}

export interface CodeBlock extends BaseBlock {
  type: "code";
  language: string;
  code: string;
}

export interface KpiBlock extends BaseBlock {
  type: "kpi";
  label: string;
  value: string;
  detail?: string;
}

export interface DiagramBlock extends BaseBlock {
  type: "diagram";
  syntax: "mermaid" | "text";
  code: string;
}

export interface FormulaBlock extends BaseBlock {
  type: "formula";
  text: string;
}

export interface HtmlBlock extends BaseBlock {
  type: "html";
  html: string;
  source?: string;
}

export type SlideBlock =
  | ParagraphBlock
  | ListBlock
  | QuoteBlock
  | ImageBlock
  | TableBlock
  | CodeBlock
  | KpiBlock
  | DiagramBlock
  | FormulaBlock
  | HtmlBlock;

export interface Slide {
  id: string;
  title: string;
  layout: string;
  note?: string;
  image?: string;
  alt?: string;
  dataLayout?: string;
  imageSlot?: string;
  social?: string;
  blocks: SlideBlock[];
  raw: string;
}

export interface DeckDocument {
  meta: DeckMeta;
  slides: Slide[];
  sourcePath?: string;
}

export interface LayoutSlot {
  id: string;
  kind: "text" | "image" | "table" | "code" | "diagram" | "metric";
  ratio?: string;
  required?: boolean;
}

export interface LayoutManifest {
  id: string;
  theme: ThemeId | "all";
  title: string;
  purpose: string;
  slots: LayoutSlot[];
  contentLimits: {
    maxTitleChars?: number;
    maxBodyChars?: number;
    maxItems?: number;
    maxImages?: number;
  };
  exportSafe: {
    pdf: boolean;
    png: boolean;
    singleHtml: boolean;
    notes?: string;
  };
  agentHints: string[];
  compatibleWith: string[];
}

export interface TemplateThemeTokens {
  paper?: string;
  ink?: string;
  accent?: string;
  accentAlt?: string;
  muted?: string;
  surface?: string;
  fontSans?: string;
  fontSerif?: string;
  fontMono?: string;
}

export interface TemplateLayout {
  id: string;
  title?: string;
  purpose?: string;
  slots?: LayoutSlot[];
  contentLimits?: LayoutManifest["contentLimits"];
  exportSafe?: LayoutManifest["exportSafe"];
  agentHints?: string[];
  compatibleWith?: string[];
}

export interface TemplateQualityRules {
  strict?: boolean;
  allowedColors?: string[];
  allowedFonts?: string[];
  requiredLayouts?: string[];
}

export interface TemplatePack {
  schemaVersion?: "1.0";
  id: string;
  name?: string;
  description?: string;
  baseTheme?: ThemeId;
  tokens?: TemplateThemeTokens;
  layouts?: TemplateLayout[];
  assets?: Record<string, string>;
  quality?: TemplateQualityRules;
}

export interface DeckLockSlide {
  index: number;
  id: string;
  title: string;
  layout: string;
  templateLayout: boolean;
  slots: LayoutSlot[];
  contentLimits: LayoutManifest["contentLimits"];
}

export interface DeckLock {
  schemaVersion: "1.0";
  agentdeckVersion: string;
  source: string;
  title: string;
  theme: string;
  template?: {
    id: string;
    name?: string;
    path: string;
    baseTheme: ThemeId;
    strict: boolean;
  };
  slides: DeckLockSlide[];
  warnings: string[];
}
