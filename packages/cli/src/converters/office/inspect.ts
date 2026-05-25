import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { findCommand } from "../../process/find-command.js";
import type { OfficeConversionBackend } from "../../types.js";

export function describeOfficeConverter(
  commandPath: string,
  options: { installationIssue?: string; versionTimeoutMs?: number } = {},
): string {
  const installationIssue = options.installationIssue ?? inspectOfficeInstallation(commandPath);
  if (installationIssue) return `${commandPath} (${installationIssue})`;
  const probe = spawnSync(commandPath, ["--version"], { encoding: "utf8", timeout: options.versionTimeoutMs ?? 5_000 });
  if (probe.error) return `${commandPath} (${probe.error.message.includes("ETIMEDOUT") ? "version check timed out" : `version check failed: ${probe.error.message}`})`;
  const output = `${probe.stdout || ""}${probe.stderr || ""}`.trim();
  return output ? `${commandPath} (${output.split(/\r?\n/)[0]})` : `${commandPath} (found; version output unavailable)`;
}

export function availableOfficeBackends(ext: string): OfficeConversionBackend[] {
  const backends: OfficeConversionBackend[] = [];
  const converter = findCommand(["/Applications/LibreOffice.app/Contents/MacOS/soffice", "soffice", "libreoffice"]);
  if (converter && !inspectOfficeInstallation(converter)) backends.push("libreoffice");
  if (process.platform === "darwin" && [".ppt", ".pptx", ".key"].includes(ext) && keynoteAvailable()) backends.push("keynote");
  if (process.platform === "darwin" && [".doc", ".docx", ".xls", ".xlsx"].includes(ext) && quickLookPreviewAvailable()) backends.push("quicklook-preview");
  if (process.platform === "win32") {
    const windowsBackend = windowsOfficeBackendForExtension(ext);
    if (windowsBackend) backends.push(windowsBackend);
  }
  return backends;
}

export function recommendedOfficeBackend(ext: string, available: OfficeConversionBackend[]): OfficeConversionBackend | undefined {
  if (available.includes("libreoffice")) return "libreoffice";
  if ([".ppt", ".pptx", ".key"].includes(ext) && available.includes("keynote")) return "keynote";
  if ([".doc", ".docx", ".xls", ".xlsx"].includes(ext) && available.includes("quicklook-preview")) return "quicklook-preview";
  return available[0];
}

export function describeNativeOfficeFallbacks(): string {
  const fallbacks: string[] = [];
  if (process.platform === "darwin" && keynoteAvailable()) fallbacks.push("Keynote.app for .ppt/.pptx/.key -> PDF");
  if (process.platform === "darwin" && quickLookPreviewAvailable()) fallbacks.push("Quick Look preview for .doc/.docx/.xls/.xlsx -> HTML preview -> PDF");
  if (process.platform === "win32") fallbacks.push("PowerPoint/Word/Excel COM automation when Microsoft Office is installed");
  return fallbacks.length ? fallbacks.join("; ") : "none detected";
}

export function inspectOfficeInstallation(commandPath: string): string | undefined {
  const bundlePath = officeBundlePath(commandPath);
  if (!bundlePath) return undefined;

  const gatekeeper = spawnSync("spctl", ["--assess", "--type", "execute", "-vv", bundlePath], { encoding: "utf8", timeout: 5_000 });
  const gatekeeperOutput = `${gatekeeper.stdout || ""}${gatekeeper.stderr || ""}`.trim();
  if (/sealed resource is missing or invalid/i.test(gatekeeperOutput)) {
    return "macOS reports the LibreOffice app bundle has missing or invalid sealed resources";
  }

  const attrs = spawnSync("xattr", ["-l", bundlePath], { encoding: "utf8", timeout: 5_000 });
  const attrOutput = `${attrs.stdout || ""}${attrs.stderr || ""}`.trim();
  if (/com\.apple\.quarantine/i.test(attrOutput) && /Homebrew Cask|quarantine/i.test(attrOutput)) {
    return "macOS quarantine attributes are present on the LibreOffice app bundle";
  }

  return undefined;
}

export function keynoteAvailable(): boolean {
  return existsSync("/Applications/Keynote.app");
}

export function quickLookPreviewAvailable(): boolean {
  return process.platform === "darwin" && Boolean(findCommand(["qlmanage"]));
}

export function windowsOfficeBackendForExtension(ext: string): Extract<OfficeConversionBackend, "windows-powerpoint" | "windows-word" | "windows-excel"> | undefined {
  if (ext === ".ppt" || ext === ".pptx") return "windows-powerpoint";
  if (ext === ".doc" || ext === ".docx") return "windows-word";
  if (ext === ".xls" || ext === ".xlsx") return "windows-excel";
  return undefined;
}

export function describeTriedOfficeBackends(ext: string): string {
  const backends = ["LibreOffice"];
  if (process.platform === "darwin" && [".ppt", ".pptx", ".key"].includes(ext)) backends.push("Keynote");
  if (process.platform === "darwin" && [".doc", ".docx", ".xls", ".xlsx"].includes(ext)) backends.push("Quick Look preview");
  if (process.platform === "win32") {
    const backend = windowsOfficeBackendForExtension(ext);
    if (backend === "windows-powerpoint") backends.push("PowerPoint COM");
    if (backend === "windows-word") backends.push("Word COM");
    if (backend === "windows-excel") backends.push("Excel COM");
  }
  return backends.join(", ");
}

export function describeCommandVersion(commandPath: string, args: string[]): string {
  const probe = spawnSync(commandPath, args, { encoding: "utf8", timeout: 5_000 });
  if (probe.error) return probe.error.message.includes("ETIMEDOUT") ? "version check timed out" : "version check failed";
  const output = `${probe.stdout || ""}${probe.stderr || ""}`.trim();
  return output ? output.split(/\r?\n/)[0] : "version output unavailable";
}

export function officeConverterEnv(): NodeJS.ProcessEnv {
  return process.platform === "linux"
    ? { ...process.env, SAL_USE_VCLPLUGIN: "svp" }
    : { ...process.env };
}

function officeBundlePath(commandPath: string): string | undefined {
  const marker = "/Contents/MacOS/";
  const index = commandPath.indexOf(marker);
  if (index === -1) return undefined;
  return commandPath.slice(0, index);
}
