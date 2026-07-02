import type { Command } from "commander";
import {
  createAgentControllerPlan,
  writeAgentControllerArtifacts,
  type AgentControllerMode,
  type AgentControllerPlan,
} from "../agent/controller.js";

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
}
