import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import type { CLIAdapter, SpawnOptions, WorkerProcess } from "./types.js";

const execAsync = promisify(exec);

export class CodexAdapter implements CLIAdapter {
  readonly name = "codex";

  async detect(): Promise<boolean> {
    try {
      await execAsync("codex --version");
      return true;
    } catch {
      return false;
    }
  }

  async version(): Promise<string> {
    try {
      const { stdout } = await execAsync("codex --version");
      return stdout.trim();
    } catch {
      return "not installed";
    }
  }

  async spawn(opts: SpawnOptions): Promise<WorkerProcess> {
    const args: string[] = ["--quiet"];
    if (opts.model) args.push("--model", opts.model);
    if (opts.prompt) args.push(opts.prompt);
    if (opts.args) args.push(...opts.args);

    const proc = spawn("codex", args, {
      cwd: opts.workdir,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...opts.env },
    });

    return {
      pid: proc.pid ?? -1,
      process: proc,
      async kill() {
        if (!proc.killed) {
          proc.kill("SIGTERM");
        }
      },
    };
  }

  async injectContext(ctx: string): Promise<void> {
    // Codex reads AGENTS.md from project root automatically
    // Additional context injected via stdin/prompt
    void ctx;
  }

  async healthCheck(): Promise<boolean> {
    return this.detect();
  }

  async query(prompt: string, opts?: { timeout?: number }): Promise<string> {
    const timeout = opts?.timeout ?? 15000;
    const { stdout } = await execAsync(`codex --quiet ${JSON.stringify(prompt)}`, { timeout });
    return stdout.trim();
  }
}
