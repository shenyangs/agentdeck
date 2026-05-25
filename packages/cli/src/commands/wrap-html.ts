import { readFileSync } from "node:fs";
import { analyzeHtmlCompatibility, formatHtmlStrategyDecision } from "../converters/html.js";
import { htmlStrategy, parseArgs } from "../flags.js";
import type { CliResult, HtmlWrapStrategy } from "../types.js";
import { resolveInputPath } from "../utils/files.js";
import { wrapHtmlDom } from "./wrap-html-dom.js";
import { wrapHtmlRaster } from "./wrap-html-raster.js";

export async function commandWrapHtml(args: string[]): Promise<CliResult> {
  const options = parseArgs(args);
  const file = options.positionals[0];
  if (!file) {
    console.error('Usage: agentdeck wrap-html <index.html> [--out dist] [--title "Deck title"] [--html-strategy auto|dom|raster] [--fit contain|width|height|cover] [--image-format png|jpeg|webp] [--quality 82] [--max-width 1600] [--size-budget 50mb]');
    return { code: 2 };
  }
  const htmlPath = resolveInputPath(file);
  const htmlSource = readFileSync(htmlPath, "utf8");
  const requestedStrategy = htmlStrategy(options.flags["html-strategy"] ?? options.flags.strategy);
  const analysis = analyzeHtmlCompatibility(htmlSource);
  const selectedStrategy: Exclude<HtmlWrapStrategy, "auto"> = requestedStrategy === "auto" ? analysis.recommendedStrategy : requestedStrategy;
  console.log(formatHtmlStrategyDecision(requestedStrategy, selectedStrategy, analysis));

  if (selectedStrategy === "raster") {
    return wrapHtmlRaster(htmlPath, htmlSource, options, analysis, requestedStrategy);
  }

  return wrapHtmlDom({
    file,
    htmlPath,
    htmlSource,
    options,
    analysis,
    requestedStrategy,
    selectedStrategy,
    fallback: (fallbackAnalysis, fallbackReason) => wrapHtmlRaster(htmlPath, htmlSource, options, fallbackAnalysis, requestedStrategy, fallbackReason),
  });
}
