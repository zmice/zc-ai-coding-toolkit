import { spawnSync, type SpawnOptions } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { spawnCommand } from "./cross-platform-spawn.js";
import { sanitizeCommandArgs, sanitizeCommandText } from "./command-output-redaction.js";

export interface CodexCliCommandResult {
  readonly args: readonly string[];
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export interface CodexCliCommandOptions {
  readonly mirrorOutput?: boolean;
  readonly allowFailure?: boolean;
  readonly timeoutMs?: number;
  readonly maxOutputBytes?: number;
  readonly signal?: AbortSignal;
  /** Synchronous, internal-only inspection of complete raw output; never log or serialize it. */
  readonly inspectRawOutput?: (raw: { readonly stdout: string; readonly stderr: string }) => void;
  /** Test seam: production always uses cross-platform-spawn. */
  readonly spawn?: typeof spawnCommand;
}

type ResourceReason = "timeout" | "output-limit" | "aborted";

function commandText(args: readonly string[]): string {
  return ["codex", ...sanitizeCommandArgs(args)].map((arg) =>
    /^[A-Za-z0-9_@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, "'\\''")}'`,
  ).join(" ");
}

function isQuery(args: readonly string[]): boolean {
  return args.includes("--help") || args.includes("--version") ||
    (args[0] === "plugin" && args[1] === "list") ||
    (args[0] === "plugin" && args[1] === "marketplace" && args[2] === "list") ||
    (args[0] === "marketplace" && args[1] === "list");
}

function positiveLimit(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} 必须是正整数。`);
  }
  return value;
}

function cleanupOwnedProcess(pid: number | undefined, childKill: () => boolean): string {
  if (!pid) return "no-pid";
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      shell: false,
      windowsHide: true,
      timeout: 3000,
      stdio: "ignore",
    });
    if (result.status === 0) return "tree-kill-confirmed";
    try { return childKill() ? "child-kill-sent;tree-uncertain" : "cleanup-failed"; }
    catch { return "cleanup-failed"; }
  }
  try {
    process.kill(-pid, "SIGKILL");
    return "group-kill-sent;tree-exit-pending";
  } catch {
    try { return childKill() ? "child-kill-sent;tree-uncertain" : "cleanup-failed"; }
    catch { return "cleanup-failed"; }
  }
}

export function createCodexCliCommandFailure(result: CodexCliCommandResult): Error {
  const command = commandText(result.args);
  return new Error(result.signal
    ? `${command} 被信号 ${result.signal} 中断。reason=signal; cleanup=not-needed`
    : `${command} 退出码为 ${result.code ?? "unknown"}：${sanitizeCommandText(result.stderr.trim() || result.stdout.trim() || "无错误输出")}；reason=nonzero; cleanup=not-needed`);
}

export async function runCodexCliCommand(
  args: readonly string[],
  options: CodexCliCommandOptions = {},
): Promise<CodexCliCommandResult> {
  const query = isQuery(args);
  const timeoutMs = positiveLimit(options.timeoutMs, query ? 15_000 : 300_000, "timeoutMs");
  const maxOutputBytes = positiveLimit(options.maxOutputBytes, query ? 8 * 1024 * 1024 : 16 * 1024 * 1024, "maxOutputBytes");
  if (options.signal?.aborted) {
    throw new Error(`${commandText(args)} 失败：reason=aborted; cleanup=not-started`);
  }

  return await new Promise((resolve, reject) => {
    const spawn = options.spawn ?? spawnCommand;
    const spawnOptions: SpawnOptions = {
      shell: false,
      stdio: ["inherit", "pipe", "pipe"],
      windowsHide: true,
      detached: process.platform !== "win32",
    };
    let child: ReturnType<typeof spawnCommand>;
    try { child = spawn("codex", args, spawnOptions); }
    catch (error) {
      reject(new Error(`${commandText(args)} 启动失败：${sanitizeCommandText(String(error))}；reason=spawn-error; cleanup=not-started`));
      return;
    }
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    const stdoutDecoder = new StringDecoder("utf8");
    const stderrDecoder = new StringDecoder("utf8");
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    let resource: { reason: ResourceReason; cleanup: string } | undefined;
    const finish = (error?: Error, result?: CodexCliCommandResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (cleanupTimer) clearTimeout(cleanupTimer);
      options.signal?.removeEventListener("abort", onAbort);
      process.off("SIGINT", onProcessSignal);
      process.off("SIGTERM", onProcessSignal);
      if (options.mirrorOutput && !error) {
        const safeStdout = sanitizeCommandText(stdout);
        const safeStderr = sanitizeCommandText(stderr);
        if (safeStdout) process.stdout.write(safeStdout);
        if (safeStderr) process.stderr.write(safeStderr);
      }
      if (error) reject(error);
      else resolve({ ...result!, args: sanitizeCommandArgs(result!.args), stdout: sanitizeCommandText(result!.stdout), stderr: sanitizeCommandText(result!.stderr) });
    };
    const failResource = (reason: ResourceReason) => {
      if (settled || resource) return;
      const cleanup = cleanupOwnedProcess(child.pid, () => child.kill("SIGKILL"));
      resource = { reason, cleanup };
      if (timer) clearTimeout(timer);
      cleanupTimer = setTimeout(() => {
        child.stdout?.destroy();
        child.stderr?.destroy();
        try { child.unref(); } catch { /* The process may already have disappeared. */ }
        const pid = child.pid ?? "unknown";
        finish(new Error(`${commandText(args)} 失败：reason=${reason}; cleanup=${cleanup}; exit=unconfirmed; pid=${pid}`));
      }, 2000);
    };
    const onAbort = () => failResource("aborted");
    const onProcessSignal = () => failResource("aborted");
    const onOutput = (kind: "stdout" | "stderr", chunk: Buffer | string) => {
      if (settled || resource) return;
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remaining = Math.max(0, maxOutputBytes - outputBytes);
      const accepted = data.subarray(0, remaining);
      outputBytes += accepted.length;
      const text = (kind === "stdout" ? stdoutDecoder : stderrDecoder).write(accepted);
      if (kind === "stdout") stdout += text;
      else stderr += text;
      if (data.length > remaining) failResource("output-limit");
    };
    child.stdout?.on("data", (chunk: Buffer | string) => onOutput("stdout", chunk));
    child.stderr?.on("data", (chunk: Buffer | string) => onOutput("stderr", chunk));
    child.once("error", (error: NodeJS.ErrnoException) => {
      if (resource) return;
      finish(error.code === "ENOENT"
        ? new Error(`${commandText(args)} 未检测到 codex CLI，无法自动注册 Git marketplace。reason=spawn-enoent; cleanup=not-started`)
        : new Error(`${commandText(args)} 启动失败：${sanitizeCommandText(error.message)}；reason=spawn-error; cleanup=not-started`));
    });
    child.once("close", (code, signal) => {
      if (resource) {
        finish(new Error(`${commandText(args)} 失败：reason=${resource.reason}; cleanup=${resource.cleanup}; exit=parent-confirmed`));
        return;
      }
      stdout += stdoutDecoder.end();
      stderr += stderrDecoder.end();
      const result = { args, code, signal, stdout, stderr };
      if (code === 0 || options.allowFailure) {
        try { options.inspectRawOutput?.({ stdout, stderr }); }
        catch (error) {
          finish(new Error(`${commandText(args)} 内部输出解析失败：${sanitizeCommandText(String(error))}；reason=inspect-output`));
          return;
        }
        finish(undefined, result);
      }
      else finish(createCodexCliCommandFailure(result));
    });
    options.signal?.addEventListener("abort", onAbort, { once: true });
    process.on("SIGINT", onProcessSignal);
    process.on("SIGTERM", onProcessSignal);
    timer = setTimeout(() => failResource("timeout"), timeoutMs);
    timer.unref();
    if (options.signal?.aborted) onAbort();
  });
}
