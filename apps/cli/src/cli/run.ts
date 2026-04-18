import type { Command } from "commander";
import { getAdapter, listAdapters } from "../adapters/index.js";

export interface RunOptions {
  cli: string;
  model?: string;
  workdir: string;
}

export function parseRunOptions(
  prompt: string | undefined,
  opts: { cli?: string; model?: string; workdir?: string },
): { prompt?: string; options: RunOptions } {
  return {
    prompt: prompt || undefined,
    options: {
      cli: opts.cli ?? "codex",
      model: opts.model,
      workdir: opts.workdir ?? process.cwd(),
    },
  };
}

export async function executeRun(
  prompt: string | undefined,
  options: RunOptions,
): Promise<void> {
  const adapter = getAdapter(options.cli);
  if (!adapter) {
    const available = listAdapters();
    console.error(
      `[zc run] 错误: 未知的 CLI 适配器 "${options.cli}"。可用: ${available.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  const detected = await adapter.detect();
  if (!detected) {
    console.error(
      `[zc run] 错误: "${options.cli}" CLI 未安装或不可用。请先安装后重试。`,
    );
    process.exitCode = 1;
    return;
  }

  const worker = await adapter.spawn({
    workdir: options.workdir,
    model: options.model,
    prompt,
  });

  console.log(`[zc run] 已启动 ${options.cli} worker (PID: ${worker.pid})`);

  // Forward stdout/stderr to current terminal
  worker.process.stdout?.on("data", (data: Buffer) => {
    process.stdout.write(data);
  });

  worker.process.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(data);
  });

  // Graceful shutdown on signals
  const handleSignal = async () => {
    console.log("\n[zc run] 收到终止信号，正在关闭 worker...");
    await worker.kill();
  };

  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  // Wait for process to exit
  const exitCode = await new Promise<number>((resolve) => {
    worker.process.on("close", (code) => {
      resolve(code ?? 0);
    });
  });

  // Cleanup signal handlers
  process.removeListener("SIGINT", handleSignal);
  process.removeListener("SIGTERM", handleSignal);

  process.exitCode = exitCode;
}

export function registerRunCommand(program: Command): void {
  program
    .command("run")
    .description("启动单个 CLI worker 执行任务")
    .argument("[prompt]", "任务描述 / prompt")
    .option("--cli <cli>", "CLI 适配器名称 (codex | qwen-code)", "codex")
    .option("-m, --model <model>", "指定模型")
    .option(
      "-w, --workdir <dir>",
      "工作目录",
      process.cwd(),
    )
    .action(async (prompt: string | undefined, opts: { cli?: string; model?: string; workdir?: string }) => {
      const { prompt: parsedPrompt, options } = parseRunOptions(prompt, opts);
      await executeRun(parsedPrompt, options);
    });
}
