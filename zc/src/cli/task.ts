import type { Command } from "commander";
import { resolve } from "node:path";
import { TaskQueue } from "../team/task-queue.js";

function getTeamDir(): string {
  return resolve(process.cwd(), ".zc");
}

function formatStatus(status: string): string {
  const icons: Record<string, string> = {
    pending: "○",
    claimed: "◐",
    in_progress: "●",
    completed: "✔",
    failed: "✘",
  };
  return `${icons[status] ?? "?"} ${status}`;
}

export function registerTaskCommand(program: Command): void {
  const task = program
    .command("task")
    .description("任务操作命令");

  task.command("list").description("列出任务")
    .option("-s, --status <status>", "按状态筛选")
    .action(async (opts: { status?: string }) => {
      const teamDir = getTeamDir();
      const queue = new TaskQueue(teamDir);
      try {
        await queue.load();
      } catch {
        console.log("当前目录未找到团队任务文件（.zc/tasks.json）。请先初始化团队或切换到正确的项目目录。");
        return;
      }

      const filter = opts.status
        ? { status: opts.status as "pending" | "claimed" | "in_progress" | "completed" | "failed" }
        : undefined;
      const tasks = queue.list(filter);

      if (tasks.length === 0) {
        console.log("暂无任务。");
        return;
      }

      // 表头
      const header = `${"ID".padEnd(10)} ${"状态".padEnd(14)} ${"负责人".padEnd(12)} 标题`;
      console.log(header);
      console.log("-".repeat(60));

      for (const t of tasks) {
        const line = `${t.id.padEnd(10)} ${formatStatus(t.status).padEnd(14)} ${(t.assignee ?? "-").padEnd(12)} ${t.title}`;
        console.log(line);
      }
    });

  task.command("claim").description("认领任务")
    .argument("<id>", "任务 ID")
    .option("-w, --worker <worker>", "Worker ID", "cli-user")
    .action(async (id: string, opts: { worker: string }) => {
      const queue = new TaskQueue(getTeamDir());
      try {
        await queue.load();
        const { task: claimed } = await queue.claim(id, opts.worker);
        console.log(`已认领任务 [${claimed.id}] "${claimed.title}" -> ${opts.worker}`);
      } catch (err) {
        console.error(`认领失败: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  task.command("done").description("标记完成")
    .argument("<id>", "任务 ID")
    .action(async (id: string) => {
      const queue = new TaskQueue(getTeamDir());
      try {
        await queue.load();
        const t = queue.getById(id);
        if (!t) { console.error(`任务不存在: ${id}`); process.exitCode = 1; return; }
        if (!t.claimToken) { console.error(`任务 ${id} 尚未被认领，无法标记完成。`); process.exitCode = 1; return; }
        await queue.transition(id, t.claimToken, "completed");
        console.log(`任务 [${id}] 已标记为完成。`);
      } catch (err) {
        console.error(`操作失败: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  task.command("fail").description("标记失败")
    .argument("<id>", "任务 ID")
    .option("-r, --reason <reason>", "失败原因")
    .action(async (id: string, opts: { reason?: string }) => {
      const queue = new TaskQueue(getTeamDir());
      try {
        await queue.load();
        const t = queue.getById(id);
        if (!t) { console.error(`任务不存在: ${id}`); process.exitCode = 1; return; }
        if (!t.claimToken) { console.error(`任务 ${id} 尚未被认领，无法标记失败。`); process.exitCode = 1; return; }
        await queue.transition(id, t.claimToken, "failed");
        const reasonStr = opts.reason ? `（原因: ${opts.reason}）` : "";
        console.log(`任务 [${id}] 已标记为失败。${reasonStr}`);
      } catch (err) {
        console.error(`操作失败: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });
}
