import type { Command } from "commander";
import { detectPlatform } from "../utils/platform.js";

function ok(msg: string): void {
  console.log(`  \x1b[32m[通过]\x1b[0m ${msg}`);
}

function warn(msg: string): void {
  console.log(`  \x1b[33m[警告]\x1b[0m ${msg}`);
}

function fail(msg: string): void {
  console.log(`  \x1b[31m[失败]\x1b[0m ${msg}`);
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("诊断运行环境")
    .action(async () => {
      console.log("\n🔍 zc doctor 环境诊断\n");

      const info = await detectPlatform();
      let hasError = false;

      // OS
      switch (info.os) {
        case "macos":
          ok("平台：macOS");
          break;
        case "linux":
          ok("平台：Linux");
          break;
        case "windows-wsl":
          ok("平台：Windows（WSL Ubuntu）");
          break;
        case "windows-native":
          warn("平台：Windows（原生）- 建议使用 WSL Ubuntu 以获得完整 tmux 支持");
          break;
        default:
          warn(`平台：未知（${process.platform}）`);
      }

      // Node.js
      if (info.node.meetsMinimum) {
        ok(`Node.js：${info.node.version}`);
      } else {
        fail(`Node.js：${info.node.version} - 需要 >= 20.0.0`);
        hasError = true;
      }

      // git
      if (info.git.available) {
        ok(`git：${info.git.version}`);
      } else {
        fail("git：未找到 - 请安装 git");
        hasError = true;
      }

      // tmux
      if (info.tmux.available) {
        ok(`tmux：${info.tmux.version}`);
      } else {
        if (info.os === "windows-wsl" || info.os === "linux") {
          warn("tmux：未找到 - 安装：sudo apt install tmux");
        } else if (info.os === "macos") {
          warn("tmux：未找到 - 安装：brew install tmux");
        } else {
          warn("tmux：未找到");
        }
      }

      // CLI detection
      console.log("");

      const { exec: execCb } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(execCb);

      // Codex CLI check
      try {
        const { stdout } = await execAsync("codex --version");
        ok(`Codex CLI：${stdout.trim()}`);
      } catch {
        warn("Codex CLI：未找到（安装：npm i -g @openai/codex）");
      }

      // Qwen Code check
      try {
        const { stdout } = await execAsync("qwen --version");
        ok(`Qwen Code：${stdout.trim()}`);
      } catch {
        warn("Qwen Code：未找到（安装：npm i -g @anthropic/qwen-code）");
      }

      console.log("");
      if (hasError) {
        console.log("  ❌ 存在关键问题，请先修复后再使用 zc");
      } else {
        console.log("  ✅ 环境就绪");
      }
      console.log("");
    });
}
