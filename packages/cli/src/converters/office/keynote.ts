import { existsSync, rmSync } from "node:fs";
import { join, parse } from "node:path";
import { commandErrorMessage, commandOutput, runCommand } from "../../process/run-command.js";

export function convertPresentationToPdfWithKeynote(sourcePath: string, outDir: string, timeoutMs = 180_000): string {
  const pdfPath = join(outDir, `${parse(sourcePath).name}.pdf`);
  if (existsSync(pdfPath)) rmSync(pdfPath, { force: true });
  const script = [
    "on run argv",
    "set inputPath to POSIX file (item 1 of argv)",
    "set outputPath to POSIX file (item 2 of argv)",
    'tell application "Keynote"',
    "set appWasRunning to running",
    "launch",
    "set docRef to open inputPath",
    "delay 3",
    "export docRef to outputPath as PDF",
    "close docRef saving no",
    "if appWasRunning is false then quit",
    "end tell",
    "end run",
  ];
  const args = script.flatMap((line) => ["-e", line]).concat([sourcePath, pdfPath]);
  const result = runCommand("osascript", args, { timeoutMs });
  if (result.error) {
    throw new Error(commandErrorMessage(result, "Keynote export failed"));
  }
  if (result.status !== 0 || !existsSync(pdfPath)) {
    throw new Error(commandOutput(result) || "Keynote did not produce a PDF");
  }
  return pdfPath;
}
