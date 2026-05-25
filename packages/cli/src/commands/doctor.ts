import { extname } from "node:path";
import { availableOfficeBackends, describeNativeOfficeFallbacks, describeOfficeConverter, inspectOfficeInstallation } from "../converters/office.js";
import { parseArgs, stringFlag } from "../flags.js";
import { findCommand } from "../process/find-command.js";
import {
  AGENTDECK_VERSION,
  REPORT_SCHEMA_VERSION,
  reportEnvironment,
  reportSource,
} from "../reports.js";
import type { CliResult } from "../types.js";
import { hasNodeModule, resolveInputPath } from "../utils/files.js";
import { availablePdfRenderBackends, describePdfRenderers } from "./shared-pdf.js";

export function commandDoctor(args: string[] = []): CliResult {
  const options = parseArgs(args);
  const input = stringFlag(options.flags.input) ?? options.positionals[0];
  const office = findCommand(["/Applications/LibreOffice.app/Contents/MacOS/soffice", "soffice", "libreoffice"]);
  const officeInstallationIssue = office ? inspectOfficeInstallation(office) : undefined;
  const officeConverterMessage = office
    ? describeOfficeConverter(office, { installationIssue: officeInstallationIssue, versionTimeoutMs: 1_500 })
    : "not found; Office wrap needs LibreOffice, native macOS fallback, or Windows Office COM";
  const pdfBackends = availablePdfRenderBackends();
  const pdfRenderers = describePdfRenderers(pdfBackends);
  const nativeOffice = describeNativeOfficeFallbacks();
  const playwrightAvailable = hasNodeModule("playwright");
  const inputExt = input ? extname(resolveInputPath(input)).toLowerCase() : "";
  const availableBackends = [
    ...(inputExt ? availableOfficeBackends(inputExt) : availableOfficeBackends(".pptx")),
    ...pdfBackends,
    playwrightAvailable ? "playwright" : "",
  ].filter(Boolean);
  const checks = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    agentdeckVersion: AGENTDECK_VERSION,
    environment: reportEnvironment(availableBackends),
    input: input ? reportSource(resolveInputPath(input), { debug: Boolean(options.flags.debug) }) : undefined,
    required: {
      node: { status: "ok", message: process.version },
      cli: { status: "ok", message: "AgentDeck CLI loaded" },
    },
    neededForInput: {
      officeConverter: office ? { status: officeInstallationIssue ? "warn" : "ok", message: officeConverterMessage } : { status: "missing", message: officeConverterMessage },
      nativeOfficeFallbacks: { status: nativeOffice === "none detected" ? "missing" : "ok", message: nativeOffice },
      pdfRenderers: { status: pdfBackends.length ? "ok" : "missing", message: pdfRenderers },
    },
    optional: {
      playwright: { status: playwrightAvailable ? "ok" : "missing", message: playwrightAvailable ? "available" : "not installed; export/verify/raster need it" },
    },
    risk: {
      windowsOfficeCom: { status: process.platform === "win32" ? "experimental" : "not-applicable", message: "Windows Office COM is wired but requires Windows + desktop Office verification." },
    },
  };
  if (options.flags.json) {
    console.log(JSON.stringify(checks, null, 2));
    return { code: 0 };
  }
  console.log(`Node: ${checks.required.node.message}`);
  console.log(`Working directory: ${process.cwd()}`);
  console.log(`Office converter: ${checks.neededForInput.officeConverter.message}`);
  console.log(`Native Office fallbacks: ${checks.neededForInput.nativeOfficeFallbacks.message}`);
  console.log(`PDF renderers: ${checks.neededForInput.pdfRenderers.message}`);
  console.log(`Playwright: ${checks.optional.playwright.message}`);
  console.log(`Windows Office COM: ${checks.risk.windowsOfficeCom.message}`);
  return { code: 0 };
}
