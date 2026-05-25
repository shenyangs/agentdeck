import { runCommand } from "./run-command.js";

export function pythonModuleAvailable(python: string, moduleName: string): boolean {
  const result = runCommand(
    python,
    ["-c", "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec(sys.argv[1]) else 1)", moduleName],
    { timeoutMs: 5_000 },
  );
  return result.status === 0;
}
