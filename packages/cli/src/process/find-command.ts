import { existsSync } from "node:fs";
import { runCommand } from "./run-command.js";

export function findCommand(candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    if (candidate.includes("/") && existsSync(candidate)) return candidate;
    const result = runCommand("sh", ["-lc", `command -v ${shellQuote(candidate)}`], { timeoutMs: 5_000 });
    const found = result.stdout.trim();
    if (result.status === 0 && found) return found;
  }
  return undefined;
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
