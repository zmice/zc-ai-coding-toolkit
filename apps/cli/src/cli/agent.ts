import type { Command } from "commander";
import {
  createAgentControllerPlan,
  writeAgentControllerArtifacts,
  type AgentControllerMode,
  type AgentControllerPlan,
} from "../agent/controller.js";
import {
  CodexAgentWorktreeManager,
  type CodexAgentState,
} from "../agent/codex-worktree-manager.js";

interface AgentPlanOptions {
  readonly dir?: string;
  readonly objective?: string;
  readonly tasks: string[];
  readonly mode?: AgentControllerMode | "auto";
  readonly runId?: string;
  readonly write?: boolean;
  readonly force?: boolean;
  readonly allowWorktreeTeam?: boolean;
  readonly json?: boolean;
}

interface AgentWorktreeOptions {
  readonly dir?: string;
  readonly tempRoot?: string;
  readonly runId: string;
  readonly taskId: string;
  readonly apply?: boolean;
  readonly json?: boolean;
  readonly allowDirtySource?: boolean;
  readonly agentState?: CodexAgentState;
  readonly fanInCollected?: boolean;
}

const codexAgentStates = new Set<CodexAgentState>([
  "running",
  "completed",
  "failed",
  "interrupted",
  "blocked",
  "missing",
]);

function formatAgentPlan(plan: AgentControllerPlan, written: readonly string[]): string {
  const lines = [
    `Agent controller run: ${plan.run_id}`,
    `- status: ${plan.status}`,
    `- mode: ${plan.mode}`,
    `- dispatch_now: ${plan.dispatch_contract.dispatch_now}`,
    `- artifacts: ${plan.artifacts.root}`,
  ];

  if (plan.blockers.length > 0) {
    lines.push("", "Blockers:", ...plan.blockers.map((blocker) => `- ${blocker}`));
  }

  if (plan.conflicts.length > 0) {
    lines.push("", "Conflicts:");
    for (const conflict of plan.conflicts) {
      lines.push(`- [${conflict.severity}/${conflict.kind}] ${conflict.path}: ${conflict.tasks.join(", ")}`);
    }
  }

  lines.push("", "Tasks:");
  for (const task of plan.tasks) {
    lines.push(`- ${task.id}: ${task.title} | ${task.execution} | files=${task.ownership.files.join(", ") || "-"} | verify=${task.verification || "-"}`);
  }

  if (written.length > 0) {
    lines.push("", "Written artifacts:", ...written.map((path) => `- ${path}`));
  } else {
    lines.push("", "dry-run: no artifacts written; add --write to create templates.");
  }

  return lines.join("\n");
}

export function registerAgentCommand(program: Command): void {
  const agent = program
    .command("agent")
    .description("Codex 多 agent 控制器命令");

  agent
    .command("plan")
    .description("生成多 agent controller dry-run 计划和可选本地 run artifacts")
    .option("-d, --dir <path>", "项目根目录", process.cwd())
    .option("-o, --objective <text>", "本次 agent run 的目标")
    .option("-t, --tasks <task...>", "任务描述（可重复）；格式：标题 | files=a,b | mode=readonly|write|worktree | verify=cmd", [])
    .option("--mode <mode>", "auto | none | readonly-consult | serial-subagent | context-fanout | worktree-team", "auto")
    .option("--run-id <id>", "指定 run id，便于测试或复现")
    .option("--write", "写入 .codex/work/agent-runs/<run-id>/ artifacts")
    .option("--force", "允许覆盖同名 run artifacts")
    .option("--allow-worktree-team", "允许生成 worktree-team ready 计划；默认阻止重型模式")
    .option("-j, --json", "输出 JSON")
    .action(async (opts: AgentPlanOptions) => {
      if (opts.tasks.length === 0) {
        console.error("错误：至少需要提供一个 --tasks。");
        process.exitCode = 1;
        return;
      }

      try {
        const plan = createAgentControllerPlan({
          root: opts.dir ?? process.cwd(),
          objective: opts.objective,
          rawTasks: opts.tasks,
          requestedMode: opts.mode,
          runId: opts.runId,
          allowWorktreeTeam: opts.allowWorktreeTeam,
        });
        const written = opts.write
          ? await writeAgentControllerArtifacts(plan, { force: opts.force })
          : [];

        if (opts.json) {
          console.log(JSON.stringify({ ...plan, dry_run: !opts.write, written }, null, 2));
        } else {
          console.log(formatAgentPlan({ ...plan, dry_run: !opts.write }, written));
        }

        if (plan.status === "blocked") {
          process.exitCode = 1;
        }
      } catch (error) {
        console.error("agent plan 失败：", error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    });

  const worktree = agent
    .command("worktree")
    .description("管理 Codex 子代理的临时 Git worktree");

  worktree
    .command("prepare")
    .description("规划或创建位于 OS 临时目录的 Codex agent worktree")
    .option("-d, --dir <path>", "Git 仓库根目录", process.cwd())
    .option("--temp-root <path>", "覆盖 OS 临时根（主要用于隔离测试）")
    .requiredOption("--run-id <id>", "controller run id")
    .requiredOption("--task-id <id>", "controller task id")
    .option("--allow-dirty-source", "确认子 worktree 只基于 HEAD，且源工作区未提交改动与该任务无关")
    .option("--apply", "实际创建 worktree；默认仅输出 dry-run")
    .option("-j, --json", "输出 JSON")
    .action(async (opts: AgentWorktreeOptions) => {
      try {
        const manager = new CodexAgentWorktreeManager({
          repoRoot: opts.dir ?? process.cwd(),
          ...(opts.tempRoot ? { tempRoot: opts.tempRoot } : {}),
        });
        const prepareInput = {
          runId: opts.runId,
          taskId: opts.taskId,
          allowDirtySource: opts.allowDirtySource === true,
        };
        const result = opts.apply
          ? await manager.prepare(prepareInput)
          : await manager.planPrepare(prepareInput);

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log([
            `Codex worktree ${opts.apply ? "prepared" : "plan"}: ${result.runId}/${result.taskId}`,
            `- path: ${result.path}`,
            `- branch: ${result.branch}`,
            ...(result.sourceDirty
              ? [`- source: dirty (${result.sourceChanges.length} paths); HEAD-only acknowledgement=${result.dirtySourceAcknowledged}`]
              : ["- source: clean"]),
            ...("blockers" in result && result.blockers.length > 0
              ? ["- blockers:", ...result.blockers.map((blocker) => `  - ${blocker}`)]
              : []),
            ...(opts.apply ? [] : ["- dry-run: true; add --apply to create it"]),
          ].join("\n"));
        }

        if ("status" in result && result.status === "blocked") process.exitCode = 1;
      } catch (error) {
        console.error("agent worktree prepare 失败：", error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    });

  worktree
    .command("cleanup")
    .description("按 receipt、线程终态和 fan-in 门禁规划或清理 Codex agent worktree")
    .option("-d, --dir <path>", "Git 仓库根目录", process.cwd())
    .option("--temp-root <path>", "覆盖 OS 临时根（主要用于隔离测试）")
    .requiredOption("--run-id <id>", "controller run id")
    .requiredOption("--task-id <id>", "controller task id")
    .requiredOption("--agent-state <state>", "running | completed | failed | interrupted | blocked | missing")
    .option("--fan-in-collected", "确认 controller 已收集 fan-in 证据")
    .option("--apply", "实际执行非 force 清理；默认仅输出 cleanup plan")
    .option("-j, --json", "输出 JSON")
    .action(async (opts: AgentWorktreeOptions) => {
      try {
        if (!opts.agentState || !codexAgentStates.has(opts.agentState)) {
          throw new Error(`unsupported agent state: ${opts.agentState ?? "-"}`);
        }
        const manager = new CodexAgentWorktreeManager({
          repoRoot: opts.dir ?? process.cwd(),
          ...(opts.tempRoot ? { tempRoot: opts.tempRoot } : {}),
        });
        const plan = await manager.planCleanup({
          runId: opts.runId,
          taskId: opts.taskId,
          agentState: opts.agentState,
          fanInCollected: opts.fanInCollected === true,
        });
        const result = opts.apply ? await manager.cleanup(plan) : { ...plan, dryRun: true };

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log([
            `Codex worktree cleanup ${opts.apply ? "result" : "plan"}: ${opts.runId}/${opts.taskId}`,
            `- status: ${result.status}`,
            `- path: ${result.path}`,
            ...(opts.apply ? [] : ["- dry-run: true; add --apply after all gates pass"]),
          ].join("\n"));
        }

        if (result.status === "blocked" || result.status === "orphaned") process.exitCode = 1;
      } catch (error) {
        console.error("agent worktree cleanup 失败：", error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    });

  worktree
    .command("recover")
    .description("恢复中断的 Codex worktree lease，或收敛已合入的恢复 branch/receipt")
    .option("-d, --dir <path>", "Git 仓库根目录", process.cwd())
    .option("--temp-root <path>", "覆盖 OS 临时根（主要用于隔离测试）")
    .requiredOption("--run-id <id>", "controller run id")
    .requiredOption("--task-id <id>", "controller task id")
    .option("--apply", "实际执行 receipt 驱动的非 force 恢复；默认仅输出 recovery plan")
    .option("-j, --json", "输出 JSON")
    .action(async (opts: AgentWorktreeOptions) => {
      try {
        const manager = new CodexAgentWorktreeManager({
          repoRoot: opts.dir ?? process.cwd(),
          ...(opts.tempRoot ? { tempRoot: opts.tempRoot } : {}),
        });
        const plan = await manager.planRecovery({
          runId: opts.runId,
          taskId: opts.taskId,
        });
        const result = opts.apply ? await manager.recover(plan) : { ...plan, dryRun: true };

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log([
            `Codex worktree recovery ${opts.apply ? "result" : "plan"}: ${opts.runId}/${opts.taskId}`,
            `- status: ${result.status}`,
            `- action: ${result.action}`,
            `- path: ${result.path}`,
            ...(opts.apply ? [] : ["- dry-run: true; add --apply after reviewing the exact receipt action"]),
          ].join("\n"));
        }

        if (result.status === "blocked") process.exitCode = 1;
      } catch (error) {
        console.error("agent worktree recover 失败：", error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    });
}
