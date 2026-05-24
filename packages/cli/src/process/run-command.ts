import { spawnSync } from "node:child_process";

export interface CommandResult {
  command: string;
  args: string[];
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: Error;
  timedOut: boolean;
}

export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export function runCommand(command: string, args: string[], options: RunCommandOptions = {}): CommandResult {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    timeout: options.timeoutMs ?? 120_000,
  });
  const durationMs = Date.now() - startedAt;
  const message = result.error?.message ?? "";
  return {
    command,
    args,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    durationMs,
    error: result.error,
    timedOut: message.includes("ETIMEDOUT") || result.signal === "SIGTERM",
  };
}

export function commandOutput(result: CommandResult): string {
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
}

export function commandErrorMessage(result: CommandResult, fallback: string): string {
  if (result.error) return result.timedOut ? `timed out after ${result.durationMs}ms` : result.error.message;
  return commandOutput(result) || fallback;
}
