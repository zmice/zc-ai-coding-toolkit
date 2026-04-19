#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

function parseArgs(argv) {
  let out;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if ((current === "--out" || current === "-o") && argv[index + 1]) {
      out = argv[index + 1];
      index += 1;
      continue;
    }
  }

  if (!out) {
    throw new Error("缺少 `--out <dir>`。");
  }

  return {
    out: resolve(out),
  };
}

async function run(command, args) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
    });

    child.once("error", rejectPromise);
    child.once("close", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(
          signal
            ? `${command} 被信号 ${signal} 中断。`
            : `${command} 退出码为 ${code ?? "unknown"}。`,
        ),
      );
    });
  });
}

async function main() {
  const { out } = parseArgs(process.argv.slice(2));
  await mkdir(dirname(out), { recursive: true });

  await run("node", [
    "apps/cli/dist/cli/index.js",
    "platform",
    "generate",
    "qwen",
    "--bundle",
    "release-bundle",
    "--dir",
    out,
  ]);
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? `Qwen 发布态扩展包导出失败：${error.message}`
      : "Qwen 发布态扩展包导出失败。",
  );
  process.exitCode = 1;
});
