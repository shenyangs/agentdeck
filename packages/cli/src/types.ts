import type { DeckDocument, Diagnostic } from "@agentdeck/schema";

export interface CliResult {
  code: number;
}

export interface BuildResult {
  deck: DeckDocument;
  htmlPath: string;
  assetReportPath: string;
  deckLockPath: string;
}

export type HtmlWrapStrategy = "auto" | "dom" | "raster";
export type HtmlCaptureStrategy = "hash" | "keyboard" | "scroll";

export interface HtmlCompatibilityAnalysis {
  recommendedStrategy: Exclude<HtmlWrapStrategy, "auto">;
  confidence: number;
  reasons: string[];
  signals: {
    fixedViewport: boolean;
    viewportUnits: boolean;
    horizontalDeck: boolean;
    ownNavigation: boolean;
    canvasOrWebgl: boolean;
    moduleScripts: boolean;
    externalScripts: boolean;
    detectedSlideCount: number;
  };
}

export type CompatibilityAssetStatus = "external" | "local" | "missing" | "data" | "special";
export type CompatibilityAssetKind =
  | "image"
  | "script"
  | "stylesheet"
  | "font"
  | "media"
  | "iframe"
  | "object"
  | "css-url"
  | "hyperlink"
  | "office-relationship"
  | "other";

export interface CompatibilityAssetSignal {
  kind: CompatibilityAssetKind;
  url: string;
  status: CompatibilityAssetStatus;
  source?: string;
  relationshipType?: string;
}

export interface CompatibilityRenderRisk {
  code: string;
  level: "info" | "warn";
  message: string;
  evidence?: string;
  recommendation?: string;
}

export interface CompatibilityScan {
  schemaVersion: string;
  scanner: "agentdeck-compatibility-risk";
  sourceKind: "html" | "office" | "pdf" | "markdown" | "unsupported";
  summary: {
    externalResources: number;
    missingLocalResources: number;
    localResources: number;
    dataResources: number;
    renderRiskCount: number;
    externalOfficeRelationships: number;
  };
  assets: CompatibilityAssetSignal[];
  renderRisks: CompatibilityRenderRisk[];
  warnings: string[];
}

export interface CapturePageStatus {
  index: number;
  success: boolean;
  reason?: string;
}

export interface HtmlCompatibilityReport {
  schemaVersion: string;
  agentdeckVersion: string;
  source: ReportSource;
  sourceKind: "html";
  requestedStrategy: HtmlWrapStrategy;
  selectedStrategy: Exclude<HtmlWrapStrategy, "auto">;
  analysis: HtmlCompatibilityAnalysis;
  adapterId?: string;
  captureStrategy?: HtmlCaptureStrategy;
  capturePages?: CapturePageStatus[];
  pipeline: PipelineAttempt[];
  output: ReportOutput;
  qualitySignals: QualitySignals;
  compatibilityScan?: CompatibilityScan;
  wrappedSlides: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
}

export type PdfRenderBackend = "pdftoppm" | "pdftocairo" | "pypdfium2" | "pdf2image";
export type FitMode = "contain" | "width" | "height" | "cover";
export type ImageFormat = "png" | "jpeg" | "webp";
export type PackMode = "single-html" | "folder";

export interface RenderedPage {
  index: number;
  src: string;
  bytes: number;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
  format: ImageFormat;
  mime: string;
  fileName?: string;
}

export interface PdfRenderResult {
  backend: PdfRenderBackend;
  pages: RenderedPage[];
  pipeline: PipelineAttempt[];
}

export type OfficeConversionBackend =
  | "libreoffice"
  | "keynote"
  | "quicklook-preview"
  | "windows-powerpoint"
  | "windows-word"
  | "windows-excel";
export type OfficeBackendPreference = "auto" | OfficeConversionBackend;

export interface OfficeConversionResult {
  pdfPath: string;
  backend: OfficeConversionBackend;
  pipeline: PipelineAttempt[];
}

export interface ImageOutputOptions {
  fit: FitMode;
  format: ImageFormat;
  quality: number;
  maxWidth?: number;
  sizeBudgetBytes?: number;
  maxOutputBytes?: number;
  maxPages?: number;
  pack: PackMode;
  thumbnailDpi: number;
}

export interface ProbeReport {
  schemaVersion: string;
  agentdeckVersion: string;
  source: ReportSource;
  inputKind: "html" | "pdf" | "office" | "markdown" | "unsupported";
  recommendedRoute: string;
  confidence: number;
  environment: ReportEnvironment;
  availableBackends: string[];
  missingDependencies: string[];
  risks: string[];
  pipeline: PipelineAttempt[];
  output?: Partial<ReportOutput>;
  qualitySignals: QualitySignals;
  compatibilityScan?: CompatibilityScan;
  html?: {
    requestedStrategy: HtmlWrapStrategy;
    recommendedStrategy: Exclude<HtmlWrapStrategy, "auto">;
    signals: HtmlCompatibilityAnalysis["signals"];
    reasons: string[];
  };
  office?: {
    extension: string;
    recommendedBackend?: OfficeConversionBackend;
    availableBackends: OfficeConversionBackend[];
    triedBackends: string;
  };
  pdf?: {
    availableRenderers: PdfRenderBackend[];
  };
}

export interface VerifyIssue {
  level: "fail" | "warn";
  code: string;
  message: string;
}

export interface VerifySlideReview {
  index: number;
  screenshotWidth: number;
  screenshotHeight: number;
  visibleRatio: number;
  stageCoverageRatio: number;
  imageScaleRatio?: number;
  blankScore: number;
  flags: Array<"blank" | "clipped" | "low-resolution">;
}

export interface VerifyContactSheet {
  path: string;
  pageCount: number;
  columns: number;
  thumbnailWidth: number;
  pages: VerifySlideReview[];
}

export interface VerifyReport {
  schemaVersion: string;
  agentdeckVersion: string;
  source: ReportSource;
  status: "pass" | "warn" | "fail";
  environment: ReportEnvironment;
  pipeline: PipelineAttempt[];
  output: ReportOutput;
  qualitySignals: QualitySignals;
  slideCount: number;
  overviewCount: number;
  visibleAreaRatio: number;
  imageFailures: Array<{ src: string; alt: string }>;
  checks: {
    hasSlides: boolean;
    visibleArea: boolean;
    imagesLoaded: boolean;
    hashJump: boolean;
    overviewCount: boolean;
    overviewJump: boolean;
    comparePreview: boolean;
    dockClear: boolean;
  };
  issues: VerifyIssue[];
  contactSheet?: VerifyContactSheet;
}

export interface ReportSource {
  path: string;
  redacted: boolean;
  extension: string;
  bytes: number;
  sha256: string;
  detectedMime: string;
}

export interface ReportEnvironment {
  os: NodeJS.Platform;
  arch: string;
  node: string;
  availableBackends: string[];
}

export interface PipelineAttempt {
  step: string;
  backend: string;
  status: "success" | "failed" | "skipped";
  durationMs: number;
  errorCode?: string;
  message?: string;
}

export interface ReportOutput {
  htmlPath?: string;
  bytes: number;
  pageCount: number;
  packMode: PackMode;
  fidelity: "dom" | "raster" | "raster-html" | "markdown" | "unknown";
}

export interface QualitySignals {
  blankPages: number[];
  pageCountMismatch: boolean;
  oversizedOutput: boolean;
  warnings: string[];
}

export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

export interface HtmlImportResult {
  deck: DeckDocument;
  slideCount: number;
  warnings: Diagnostic[];
}
