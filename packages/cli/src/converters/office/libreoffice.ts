import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, parse } from "node:path";
import { pathToFileURL } from "node:url";
import { commandOutput, runCommand } from "../../process/run-command.js";
import { inspectOfficeInstallation, officeConverterEnv } from "./inspect.js";

export function convertOfficeToPdfWithLibreOffice(sourcePath: string, outDir: string, converter: string, timeoutMs = 120_000): string {
  const userProfile = join(outDir, "libreoffice-profile");
  mkdirSync(userProfile, { recursive: true });
  const result = runCommand(
    converter,
    [
      `-env:UserInstallation=${pathToFileURL(userProfile).href}`,
      "--headless",
      "--norestore",
      "--nodefault",
      "--nolockcheck",
      "--nofirststartwizard",
      "--convert-to",
      "pdf",
      "--outdir",
      outDir,
      sourcePath,
    ],
    { timeoutMs, env: officeConverterEnv() },
  );
  if (result.error) {
    const installationHint = inspectOfficeInstallation(converter);
    const detail = installationHint ? ` ${installationHint}.` : "";
    throw new Error(result.timedOut ? `timed out after ${Math.round(timeoutMs / 1000)} seconds.${detail}` : `${result.error.message}.${detail}`);
  }
  if (result.status !== 0) {
    throw new Error(commandOutput(result) || "unknown LibreOffice conversion error");
  }
  const expected = join(outDir, `${parse(sourcePath).name}.pdf`);
  if (existsSync(expected)) return expected;
  const pdf = readdirSync(outDir).find((file) => file.toLowerCase().endsWith(".pdf"));
  if (!pdf) throw new Error("LibreOffice did not produce a PDF");
  return join(outDir, pdf);
}
