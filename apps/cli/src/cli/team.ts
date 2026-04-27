import type { Command } from "commander";
import { Orchestrator, type TeamSpec } from "../team/orchestrator.js";
import { SessionManager } from "../runtime/session-manager.js";
import { WorktreeManager, WorktreeSafetyError, type WorktreeBranchStatus } from "../runtime/worktree-manager.js";
import { readJson } from "../runtime/state.js";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import {
  createTeamPlan,
  parseTeamTaskDescriptors,
  type TeamPlan,
  type TeamTaskSpec,
} from "../team/planner.js";

function getStateDir(): string {
  return resolve(process.cwd(), ".zc");
}

function parseWorkers(raw: string): Array<{ id: string; cli: string }> {
  return raw.split(",").map((pair) => {
    const [id, cli] = pair.split(":");
    if (!id || !cli) {
      throw new Error(
        `工人规格格式无效 "${pair}"。应为 "id:cli"（例如 "w1:codex"）。`,
      );
    }
    return { id: id.trim(), cli: cli.trim() };
  });
}

function formatWorkerStatus(status: string): string {
  const map: Record<string, string> = {
    idle: "空闲",
    busy: "繁忙",
    failed: "失败",
    exited: "已退出",
  };
  return map[status] ?? status;
}

function defaultTeamName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `team-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function formatTeamPlan(plan: TeamPlan): string {
  const lines = [
    `建议 worker：${plan.recommendedWorkers}`,
    `需要 worktree：${plan.requiresWorktree ? "是" : "否"}`,
    `可直接启动：${plan.canStart ? "是" : "否"}`,
  ];

  if (plan.reasons.length > 0) {
    lines.push("\n原因：", ...plan.reasons.map((reason) => `- ${reason}`));
  }

  if (plan.blockers.length > 0) {
    lines.push("\n阻塞项：", ...plan.blockers.map((blocker) => `- ${blocker}`));
  }

  if (plan.conflicts.length > 0) {
    lines.push("\n文件冲突：");
    for (const conflict of plan.conflicts) {
      lines.push(`- ${conflict.file}: ${conflict.tasks.join(", ")}`);
    }
  }

  lines.push("\n并行批次：");
  plan.batches.forEach((batch, index) => {
    lines.push(`- batch ${index + 1}: ${batch.join(", ")}`);
  });

  lines.push("\n任务：");
  for (const task of plan.tasks) {
    const files = task.files.length > 0 ? task.files.join(", ") : "未声明";
    const deps = task.dependencies.length > 0 ? task.dependencies.join(", ") : "-";
    lines.push(`- ${task.id}: ${task.title} | files=${files} | deps=${deps} | mode=${task.mode}`);
  }

  return lines.join("\n");
}

function printTeamPlan(plan: TeamPlan, json?: boolean): void {
  if (json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  console.log(formatTeamPlan(plan));
}

function formatWorktreeStatus(status: WorktreeBranchStatus): string {
  const branch = status.branch ?? "-";
  const ahead = status.ahead === null ? "unknown" : String(status.ahead);
  const merged = status.merged === null ? "unknown" : status.merged ? "yes" : "no";
  return `${status.name.padEnd(24)} ${status.status.padEnd(8)} branch=${branch} ahead=${ahead} merged=${merged} path=${status.path}`;
}

async function getShutdownWorktreeStatuses(
  name: string,
  stateDir: string,
  worktree: Pick<WorktreeManager, "inspectTeam">,
): Promise<WorktreeBranchStatus[]> {
  const inspected = await worktree.inspectTeam(name);
  if (inspected.length > 0) {
    return inspected;
  }

  const statePath = resolve(stateDir, name, "state.json");
  const status = await readJson<Record<string, unknown>>(statePath, null as unknown as Record<string, unknown>);
  const workers = (status as { workers?: Array<{ id: string; worktreePath?: string }> } | null)?.workers ?? [];
  return workers
    .filter((worker) => worker.worktreePath)
    .map((worker) => ({
      name: `${name}-${worker.id}`,
      path: worker.worktreePath ?? "",
      branch: null,
      status: "unknown" as const,
      ahead: null,
      merged: null,
    }));
}

async function printShutdownPlan(
  name: string,
  stateDir: string,
  worktree: Pick<WorktreeManager, "inspectTeam">,
): Promise<void> {
  const statuses = await getShutdownWorktreeStatuses(name, stateDir, worktree);
  console.log(`团队 "${name}" 的 fan-in 收尾状态：`);
  if (statuses.length === 0) {
    console.log("- 未找到受管 worktree。");
    return;
  }
  for (const status of statuses) {
    console.log(`- ${formatWorktreeStatus(status)}`);
  }
}

export async function shutdownTeamRuntime(
  name: string,
  stateDir: string,
  session: Pick<SessionManager, "killSession">,
  worktree: Pick<WorktreeManager, "cleanup">,
): Promise<void> {
  await session.killSession(`zc-${name}`);
  await worktree.cleanup(name);
  await rm(resolve(stateDir, name), { recursive: true, force: true });
}

type SignalName = "SIGINT" | "SIGTERM";

interface SignalProcess {
  exitCode?: string | number | null;
  on(event: SignalName, listener: () => void | Promise<void>): unknown;
  removeListener(event: SignalName, listener: () => void | Promise<void>): unknown;
}

async function cleanupStartedTeamRuntime(
  name: string,
  stateDir: string,
  orchestrator: Pick<Orchestrator, "shutdown">,
  session: Pick<SessionManager, "killSession">,
  worktree: Pick<WorktreeManager, "cleanup">,
): Promise<void> {
  try {
    await orchestrator.shutdown();
  } finally {
    await shutdownTeamRuntime(name, stateDir, session, worktree);
  }
}

export async function runTeamRuntime(
  spec: TeamSpec,
  stateDir: string,
  session: Pick<SessionManager, "killSession">,
  worktree: Pick<WorktreeManager, "cleanup">,
  orchestrator: Pick<Orchestrator, "startTeam" | "runDispatchLoop" | "shutdown">,
  signalProcess: SignalProcess,
): Promise<void> {
  let cleanupPromise: Promise<void> | null = null;

  const cleanup = (): Promise<void> => {
    cleanupPromise ??= cleanupStartedTeamRuntime(
      spec.name,
      stateDir,
      orchestrator,
      session,
      worktree,
    );
    return cleanupPromise;
  };

  const handleSignal = (signal: SignalName) => async (): Promise<void> => {
    if (signalProcess.exitCode === undefined) {
      signalProcess.exitCode = signal === "SIGINT" ? 130 : 143;
    }
    await cleanup();
  };

  const sigintHandler = handleSignal("SIGINT");
  const sigtermHandler = handleSignal("SIGTERM");

  signalProcess.on("SIGINT", sigintHandler);
  signalProcess.on("SIGTERM", sigtermHandler);

  try {
    await orchestrator.startTeam(spec);
    console.log(`团队 "${spec.name}" 已启动，正在进入调度循环...`);
    await orchestrator.runDispatchLoop();
  } catch (err) {
    await cleanup();
    throw err;
  } finally {
    signalProcess.removeListener("SIGINT", sigintHandler);
    signalProcess.removeListener("SIGTERM", sigtermHandler);
  }
}

export function registerTeamCommand(program: Command): void {
  const team = program
    .command("team")
    .description("团队编排命令");

  // --- start ---
  team
    .command("plan")
    .description("干跑分析团队并行计划，不启动 tmux 或创建 worktree")
    .option("-t, --tasks <task...>", "任务描述（可重复）；可用 \"标题 | files=a,b | deps=task-1 | mode=worktree\"", [])
    .option("-w, --workers <count>", "计划 worker 数", "2")
    .option("-j, --json", "输出 JSON")
    .action((opts: { tasks: string[]; workers: string; json?: boolean }) => {
      if (opts.tasks.length === 0) {
        console.error("错误：至少需要提供一个 --tasks。");
        process.exitCode = 1;
        return;
      }

      const workerCount = Number.parseInt(opts.workers, 10);
      const tasks = parseTeamTaskDescriptors(opts.tasks);
      const plan = createTeamPlan(tasks, Number.isFinite(workerCount) ? workerCount : undefined);
      printTeamPlan(plan, opts.json);
    });

  team
    .command("start")
    .description("启动团队")
    .requiredOption(
      "-w, --workers <spec>",
      '工人规格 "id:cli,id:cli,..."（例如 "w1:codex,w2:qwen-code"）',
    )
    .option("-t, --tasks <task...>", "任务描述（可重复）", [])
    .option("-n, --name <name>", "团队名称", defaultTeamName())
    .option("-m, --model <model>", "模型名称")
    .option("-s, --skills <skill...>", "手动指定 skills（全局应用到所有任务）", [])
    .option("--skill-match <mode>", "技能匹配模式（keyword|ai）", "keyword")
    .action(async (opts: { workers: string; tasks: string[]; name: string; model?: string; skills: string[]; skillMatch: string }) => {
      if (opts.tasks.length === 0) {
        console.error("错误：至少需要提供一个 --tasks。");
        process.exitCode = 1;
        return;
      }

      const workers = parseWorkers(opts.workers);
      const parsedTasks: TeamTaskSpec[] = parseTeamTaskDescriptors(opts.tasks);
      const plan = createTeamPlan(parsedTasks, workers.length);
      if (!plan.canStart) {
        console.error("团队任务不能安全并行启动。请先处理以下计划阻塞项，或改用单 worker 串行执行：");
        console.error(formatTeamPlan(plan));
        process.exitCode = 1;
        return;
      }

      const spec: TeamSpec = {
        name: opts.name,
        workers,
        tasks: parsedTasks,
        model: opts.model,
        skills: opts.skills.length > 0 ? opts.skills : undefined,
        skillMatchMode: opts.skillMatch as "keyword" | "ai",
      };

      console.log(`正在启动团队 "${spec.name}"，包含 ${workers.length} 个工人和 ${spec.tasks.length} 个任务...`);

      const session = new SessionManager();
      const worktree = new WorktreeManager(process.cwd());
      const orch = new Orchestrator(getStateDir(), session, worktree);

      try {
        await runTeamRuntime(spec, getStateDir(), session, worktree, orch, process);
      } catch (err) {
        if (err instanceof WorktreeSafetyError) {
          console.error("启动团队失败：", err.message);
        } else {
          console.error("启动团队失败：", err instanceof Error ? err.message : err);
        }
        process.exitCode = 1;
      }
    });

  // --- status ---
  team
    .command("status")
    .description("查询团队状态")
    .argument("[name]", "团队名称")
    .action(async (name?: string) => {
      const stateDir = getStateDir();
      if (!name) {
        console.log("用法：zc team status <name>");
        return;
      }

      try {
        const statePath = resolve(stateDir, name, "state.json");
        const status = await readJson<Record<string, unknown>>(statePath, null as unknown as Record<string, unknown>);
        if (!status) {
          console.error(`未找到团队 "${name}" 的状态。`);
          process.exitCode = 1;
          return;
        }

        const s = status as {
          name: string;
          workers: Array<{ id: string; cli: string; status: string; currentTask?: string }>;
          tasks: { pending: number; running: number; done: number; failed: number };
          messages: number;
        };

        console.log(`\n团队：${s.name}`);
        console.log("─".repeat(40));

        // Workers table
        console.log("\n工人：");
        console.log("  ID            CLI          状态      任务");
        console.log("  " + "─".repeat(52));
        for (const w of s.workers) {
          console.log(
            `  ${w.id.padEnd(14)}${w.cli.padEnd(13)}${formatWorkerStatus(w.status).padEnd(10)}${w.currentTask ?? "-"}`,
          );
        }

        // Task summary
        console.log("\n任务：");
        console.log(`  待处理: ${s.tasks.pending}  进行中: ${s.tasks.running}  已完成: ${s.tasks.done}  失败: ${s.tasks.failed}`);

        // Messages
        console.log(`\n消息：${s.messages}`);
      } catch (err) {
        console.error("读取团队状态失败：", err instanceof Error ? err.message : err);
        process.exitCode = 1;
      }
    });

  // --- shutdown ---
  team
    .command("shutdown")
    .description("关闭团队")
    .argument("<name>", "团队名称")
    .option("--plan", "只输出 fan-in 收尾状态，不关闭 tmux 或删除 worktree")
    .action(async (name: string, opts: { plan?: boolean }) => {
      console.log(`正在关闭团队 "${name}"...`);

      const session = new SessionManager();
      const worktree = new WorktreeManager(process.cwd());

      try {
        await printShutdownPlan(name, getStateDir(), worktree);
        if (opts.plan) {
          console.log("dry-run：未关闭 tmux session，未删除 worktree。");
          return;
        }
        await shutdownTeamRuntime(name, getStateDir(), session, worktree);
        console.log(`团队 "${name}" 已关闭。`);
      } catch (err) {
        console.error("关闭团队失败：", err instanceof Error ? err.message : err);
        process.exitCode = 1;
      }
    });

  // --- log ---
  team
    .command("log")
    .description("查看团队日志")
    .argument("<name>", "团队名称")
    .option("-w, --worker <id>", "指定工人 ID")
    .action(async (name: string, opts: { worker?: string }) => {
      const session = new SessionManager();

      try {
        const statePath = resolve(getStateDir(), name, "state.json");
        const status = await readJson<Record<string, unknown>>(statePath, null as unknown as Record<string, unknown>);
        if (!status) {
          console.error(`未找到团队 "${name}" 的状态。`);
          process.exitCode = 1;
          return;
        }

        const s = status as {
          workers: Array<{ id: string; paneId: string }>;
        };

        const targetWorkers = opts.worker
          ? s.workers.filter((w) => w.id === opts.worker)
          : s.workers;

        if (targetWorkers.length === 0) {
          console.error(opts.worker ? `未找到工人 "${opts.worker}"。` : "未找到任何工人。");
          process.exitCode = 1;
          return;
        }

        for (const worker of targetWorkers) {
          const output = await session.captureOutput(worker.paneId);
          console.log(`\n=== ${worker.id} (${worker.paneId}) ===\n`);
          console.log(output);
        }
      } catch (err) {
        console.error("读取团队日志失败：", err instanceof Error ? err.message : err);
        process.exitCode = 1;
      }
    });
}
