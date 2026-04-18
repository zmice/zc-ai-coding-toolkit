import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import type { CLIAdapter, SpawnOptions, WorkerProcess } from "./types.js";

const execAsync = promisify(exec);

export class QwenCodeAdapter implements CLIAdapter {
  readonly name = "qwen-code";

  async detect(): Promise<boolean> {
    try {
      await execAsync("qwen --version");
      return true;
    } catch {
      return false;
    }
  }

  async version(): Promise<string> {
    try {
      const { stdout } = await execAsync("qwen --version");
      return stdout.trim();
    } catch {
      return "not installed";
    }
  }

  async spawn(opts: SpawnOptions): Promise<WorkerProcess> {
    const args: string[] = ["chat", "--agent"];
    if (opts.model) args.push("--model", opts.model);
    if (opts.prompt) args.push("--message", opts.prompt);
    if (opts.args) args.push(...opts.args);

    const proc = spawn("qwen", args, {
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
    // Qwen Code reads QWEN.md from extensions automatically
    void ctx;
  }

  async healthCheck(): Promise<boolean> {
    return this.detect();
  }

  async query(prompt: string, opts?: { timeout?: number }): Promise<string> {
    const timeout = opts?.timeout ?? 15000;
    const { stdout } = await execAsync(`qwen chat --message ${JSON.stringify(prompt)}`, { timeout });
    return stdout.trim();
  }
}
