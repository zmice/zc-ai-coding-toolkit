import type { Command } from "commander";

export function registerMsgCommand(program: Command): void {
  const msg = program
    .command("msg")
    .description("消息通信命令");

  msg.command("send").description("发送消息")
    .argument("<to>", "目标 worker")
    .argument("<body>", "消息内容")
    .action(async (to: string, body: string) => {
      console.log(`[zc msg send] To: ${to}, Body: ${body}`);
    });

  msg.command("broadcast").description("广播消息")
    .argument("<body>", "消息内容")
    .action(async (body: string) => {
      console.log(`[zc msg broadcast] Body: ${body}`);
    });

  msg.command("list").description("查看消息").action(async () => {
    console.log("[zc msg list] TODO");
  });
}
