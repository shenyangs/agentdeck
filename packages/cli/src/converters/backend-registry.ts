export interface BackendEnvironment {
  platform: NodeJS.Platform;
  availableCommands: Set<string>;
  availableModules: Set<string>;
}

export interface Backend<I, O> {
  id: string;
  platform: "all" | NodeJS.Platform;
  supports(input: I, env: BackendEnvironment): boolean;
  priority(input: I, env: BackendEnvironment): number;
  run(input: I): Promise<O> | O;
}

export function supportedBackends<I, O>(backends: Array<Backend<I, O>>, input: I, env: BackendEnvironment): Array<Backend<I, O>> {
  return backends
    .filter((backend) => (backend.platform === "all" || backend.platform === env.platform) && backend.supports(input, env))
    .sort((a, b) => b.priority(input, env) - a.priority(input, env));
}

export function backendIds<I, O>(backends: Array<Backend<I, O>>, input: I, env: BackendEnvironment): string[] {
  return supportedBackends(backends, input, env).map((backend) => backend.id);
}
