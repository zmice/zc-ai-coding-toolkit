import type { Command } from "commander";

export function registerTaskCommand(program: Command): void {
  const task = program
    .command("task")
    .description("任务操作命令");

  task.command("list").description("列出任务").action(async () => {
    console.log("[zc task list] TODO");
  });

  task.command("claim").description("认领任务").argument("<id>", "任务 ID").action(async (id: string) => {
    console.log(`[zc task claim] ID: ${id}`);
  });

  task.command("done").description("标记完成").argument("<id>", "任务 ID").action(async (id: string) => {
    console.log(`[zc task done] ID: ${id}`);
  });

  task.command("fail").description("标记失败").argument("<id>", "任务 ID")
    .option("-r, --reason <reason>", "失败原因")
    .action(async (id: string, opts: { reason?: string }) => {
      console.log(`[zc task fail] ID: ${id}, Reason: ${opts.reason}`);
    });
}
