import { existsSync } from "node:fs";
import { join, parse } from "node:path";
import { findCommand } from "../../process/find-command.js";
import { commandErrorMessage, commandOutput, runCommand } from "../../process/run-command.js";
import type { OfficeConversionBackend } from "../../types.js";

export function convertOfficeToPdfWithWindowsOffice(sourcePath: string, outDir: string, backend: Extract<OfficeConversionBackend, "windows-powerpoint" | "windows-word" | "windows-excel">, timeoutMs = 180_000): string {
  const shell = findCommand(["powershell", "pwsh"]);
  if (!shell) throw new Error("PowerShell not found");
  const pdfPath = join(outDir, `${parse(sourcePath).name}.pdf`);
  const inputLiteral = powershellLiteral(sourcePath);
  const outputLiteral = powershellLiteral(pdfPath);
  const scripts = {
    "windows-powerpoint": [
      "$app = New-Object -ComObject PowerPoint.Application",
      "$presentation = $app.Presentations.Open(" + inputLiteral + ", $false, $false, $false)",
      "$presentation.SaveAs(" + outputLiteral + ", 32)",
      "$presentation.Close()",
      "$app.Quit()",
    ],
    "windows-word": [
      "$app = New-Object -ComObject Word.Application",
      "$app.Visible = $false",
      "$document = $app.Documents.Open(" + inputLiteral + ", [ref]$false, [ref]$true)",
      "$document.ExportAsFixedFormat(" + outputLiteral + ", 17)",
      "$document.Close([ref]$false)",
      "$app.Quit()",
    ],
    "windows-excel": [
      "$app = New-Object -ComObject Excel.Application",
      "$app.Visible = $false",
      "$workbook = $app.Workbooks.Open(" + inputLiteral + ", 0, $true)",
      "$workbook.ExportAsFixedFormat(0, " + outputLiteral + ")",
      "$workbook.Close($false)",
      "$app.Quit()",
    ],
  } as const;
  const command = [
    "$ErrorActionPreference = 'Stop'",
    ...scripts[backend],
  ].join("; ");
  const result = runCommand(shell, ["-NoProfile", "-NonInteractive", "-Command", command], { timeoutMs });
  if (result.error) throw new Error(commandErrorMessage(result, "Windows Office COM automation failed"));
  if (result.status !== 0 || !existsSync(pdfPath)) {
    throw new Error(commandOutput(result) || "Windows Office COM automation failed");
  }
  return pdfPath;
}

function powershellLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
