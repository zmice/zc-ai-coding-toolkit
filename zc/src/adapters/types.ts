import type { ChildProcess } from "node:child_process";

export interface SpawnOptions {
  workdir: string;
  model?: string;
  prompt?: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface WorkerProcess {
  pid: number;
  process: ChildProcess;
  kill(): Promise<void>;
}

export interface CLIAdapter {
  readonly name: string;
  detect(): Promise<boolean>;
  version(): Promise<string>;
  spawn(opts: SpawnOptions): Promise<WorkerProcess>;
  injectContext(ctx: string): Promise<void>;
  healthCheck(): Promise<boolean>;
  /** One-shot AI query — send prompt, get text response */
  query?(prompt: string, opts?: { timeout?: number }): Promise<string>;
}

const adapters = new Map<string, CLIAdapter>();

export function registerAdapter(adapter: CLIAdapter): void {
  adapters.set(adapter.name, adapter);
}

export function getAdapter(name: string): CLIAdapter | undefined {
  return adapters.get(name);
}

export function listAdapters(): string[] {
  return Array.from(adapters.keys());
}
