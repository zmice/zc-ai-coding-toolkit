import type { Command } from "commander";
import { Orchestrator, type TeamSpec } from "../team/orchestrator.js";
import { SessionManager } from "../runtime/session-manager.js";
import { WorktreeManager } from "../runtime/worktree-manager.js";
import { readJson } from "../runtime/state.js";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";

function getStateDir(): string {
  return resolve(process.cwd(), ".zc");
}

function parseWorkers(raw: string): Array<{ id: string; cli: string }> {
  return raw.split(",").map((pair) => {
    const [id, cli] = pair.split(":");
    if (!id || !cli) {
      throw new Error(
        `Invalid worker format "${pair}". Expected "id:cli" (e.g. "w1:codex").`,
      );
    }
    return { id: id.trim(), cli: cli.trim() };
  });
}

function defaultTeamName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `team-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
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
    console.log(`Team "${spec.name}" started. Entering dispatch loop...`);
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
    .command("start")
    .description("启动团队")
    .requiredOption(
      "-w, --workers <spec>",
      '工人规格 "id:cli,id:cli,..." (e.g. "w1:codex,w2:qwen-code")',
    )
    .option("-t, --tasks <task...>", "任务描述（可重复）", [])
    .option("-n, --name <name>", "团队名称", defaultTeamName())
    .option("-m, --model <model>", "模型名称")
    .option("-s, --skills <skill...>", "手动指定 skills（全局应用到所有任务）", [])
    .option("--skill-match <mode>", "技能匹配模式 (keyword|ai)", "keyword")
    .action(async (opts: { workers: string; tasks: string[]; name: string; model?: string; skills: string[]; skillMatch: string }) => {
      if (opts.tasks.length === 0) {
        console.error("Error: at least one --tasks is required.");
        process.exitCode = 1;
        return;
      }

      const workers = parseWorkers(opts.workers);
      const spec: TeamSpec = {
        name: opts.name,
        workers,
        tasks: opts.tasks,
        model: opts.model,
        skills: opts.skills.length > 0 ? opts.skills : undefined,
        skillMatchMode: opts.skillMatch as "keyword" | "ai",
      };

      console.log(`Starting team "${spec.name}" with ${workers.length} worker(s) and ${spec.tasks.length} task(s)...`);

      const session = new SessionManager();
      const worktree = new WorktreeManager(process.cwd());
      const orch = new Orchestrator(getStateDir(), session, worktree);

      try {
        await runTeamRuntime(spec, getStateDir(), session, worktree, orch, process);
      } catch (err) {
        console.error("Failed to start team:", err instanceof Error ? err.message : err);
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
        console.log("Usage: zc team status <name>");
        return;
      }

      try {
        const statePath = resolve(stateDir, name, "state.json");
        const status = await readJson<Record<string, unknown>>(statePath, null as unknown as Record<string, unknown>);
        if (!status) {
          console.error(`No state found for team "${name}".`);
          process.exitCode = 1;
          return;
        }

        const s = status as {
          name: string;
          workers: Array<{ id: string; cli: string; status: string; currentTask?: string }>;
          tasks: { pending: number; running: number; done: number; failed: number };
          messages: number;
        };

        console.log(`\nTeam: ${s.name}`);
        console.log("─".repeat(40));

        // Workers table
        console.log("\nWorkers:");
        console.log("  ID            CLI          Status    Task");
        console.log("  " + "─".repeat(52));
        for (const w of s.workers) {
          console.log(
            `  ${w.id.padEnd(14)}${w.cli.padEnd(13)}${w.status.padEnd(10)}${w.currentTask ?? "-"}`,
          );
        }

        // Task summary
        console.log("\nTasks:");
        console.log(`  Pending: ${s.tasks.pending}  Running: ${s.tasks.running}  Done: ${s.tasks.done}  Failed: ${s.tasks.failed}`);

        // Messages
        console.log(`\nMessages: ${s.messages}`);
      } catch (err) {
        console.error("Failed to read team status:", err instanceof Error ? err.message : err);
        process.exitCode = 1;
      }
    });

  // --- shutdown ---
  team
    .command("shutdown")
    .description("关闭团队")
    .argument("<name>", "团队名称")
    .action(async (name: string) => {
      console.log(`Shutting down team "${name}"...`);

      const session = new SessionManager();
      const worktree = new WorktreeManager(process.cwd());

      try {
        await shutdownTeamRuntime(name, getStateDir(), session, worktree);
        console.log(`Team "${name}" shut down.`);
      } catch (err) {
        console.error("Failed to shutdown team:", err instanceof Error ? err.message : err);
        process.exitCode = 1;
      }
    });

  // --- log ---
  team
    .command("log")
    .description("查看团队日志")
    .argument("<name>", "团队名称")
    .option("-w, --worker <id>", "指定 worker ID")
    .action(async (name: string, opts: { worker?: string }) => {
      const session = new SessionManager();

      try {
        const statePath = resolve(getStateDir(), name, "state.json");
        const status = await readJson<Record<string, unknown>>(statePath, null as unknown as Record<string, unknown>);
        if (!status) {
          console.error(`No state found for team "${name}".`);
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
          console.error(opts.worker ? `Worker "${opts.worker}" not found.` : "No workers found.");
          process.exitCode = 1;
          return;
        }

        for (const w of targetWorkers) {
          console.log(`\n=== Worker: ${w.id} (pane: ${w.paneId}) ===`);
          try {
            const output = await session.captureOutput(w.paneId, 50);
            console.log(output);
          } catch {
            console.log("  (unable to capture output — pane may be dead)");
          }
        }
      } catch (err) {
        console.error("Failed to read logs:", err instanceof Error ? err.message : err);
        process.exitCode = 1;
      }
    });
}
