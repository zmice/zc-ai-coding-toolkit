import type { Command } from "commander";
import { resolve } from "node:path";
import { Mailbox } from "../team/mailbox.js";

function getTeamDir(): string {
  return resolve(process.cwd(), ".zc");
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function formatTime(iso: string): string {
  return iso.replace("T", " ").slice(0, 19);
}

export function registerMsgCommand(program: Command): void {
  const msg = program
    .command("msg")
    .description("消息通信命令");

  msg.command("send").description("发送消息")
    .argument("<to>", "目标 worker")
    .argument("<body>", "消息内容")
    .action(async (to: string, body: string) => {
      const mailbox = new Mailbox(getTeamDir());
      try {
        await mailbox.load();
        const sent = await mailbox.send("cli-user", to, body);
        console.log(`消息已发送 [${sent.id}] -> ${to}`);
      } catch (err) {
        console.error(`发送失败: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  msg.command("broadcast").description("广播消息")
    .argument("<body>", "消息内容")
    .action(async (body: string) => {
      const mailbox = new Mailbox(getTeamDir());
      try {
        await mailbox.load();
        const sent = await mailbox.broadcast("cli-user", body);
        console.log(`广播已发送 [${sent.id}]`);
      } catch (err) {
        console.error(`广播失败: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  msg.command("list").description("查看消息")
    .option("-w, --worker <worker>", "查看指定 worker 的消息")
    .option("-n, --limit <n>", "显示最近 N 条消息", "20")
    .action(async (opts: { worker?: string; limit: string }) => {
      const mailbox = new Mailbox(getTeamDir());
      try {
        await mailbox.load();
      } catch {
        console.log("当前目录未找到消息文件（.zc/mailbox.json）。请先初始化团队或切换到正确的项目目录。");
        return;
      }

      const limit = parseInt(opts.limit, 10) || 20;
      const all = opts.worker ? mailbox.list(opts.worker) : mailbox.allMessages();

      // 按时间倒序，取最近 N 条
      const sorted = [...all].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);

      if (sorted.length === 0) {
        console.log("暂无消息。");
        return;
      }

      const header = `${"ID".padEnd(10)} ${"发送者".padEnd(12)} ${"接收者".padEnd(12)} ${"时间".padEnd(21)} ${"状态".padEnd(12)} 内容`;
      console.log(header);
      console.log("-".repeat(80));

      for (const m of sorted) {
        const line = `${m.id.padEnd(10)} ${m.from.padEnd(12)} ${m.to.padEnd(12)} ${formatTime(m.timestamp).padEnd(21)} ${m.status.padEnd(12)} ${truncate(m.body, 30)}`;
        console.log(line);
      }
    });

  msg.command("read").description("标记消息已读")
    .argument("<id>", "消息 ID")
    .action(async (id: string) => {
      const mailbox = new Mailbox(getTeamDir());
      try {
        await mailbox.load();
        await mailbox.markRead(id);
        console.log(`消息 [${id}] 已标记为已读。`);
      } catch (err) {
        console.error(`操作失败: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });
}
