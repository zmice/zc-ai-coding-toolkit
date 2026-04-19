#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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

function renderReadme() {
  return `# zc Qwen Extension

这是由 [zc AI Coding Toolkit](https://github.com/zmice/zc-ai-coding-toolkit) 自动导出的 Qwen 扩展仓库。

它提供：

- \`QWEN.md\` 入口说明
- \`qwen-extension.json\` 扩展元数据
- \`commands/\`
- \`skills/\`
- \`agents/\`

## 安装

\`\`\`bash
qwen extensions install https://github.com/zmice/zc-qwen-extension.git
\`\`\`

## 更新

\`\`\`bash
qwen extensions update zc-toolkit
\`\`\`

## 目录说明

- \`commands/zc/\`：统一命令入口，使用 \`zc:*\` 命名空间
- \`skills/zc-*/SKILL.md\`：专项与 workflow 技能
- \`agents/zc-*.md\`：角色型入口

## 来源

- 主仓库：<https://github.com/zmice/zc-ai-coding-toolkit>
- 同步方式：主仓库 GitHub Actions 自动导出并同步

如果需要查看完整使用说明、平台适配规则或内容治理模型，请回到主仓库文档。
`;
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

  const license = await readFile("LICENSE", "utf8");
  await writeFile(join(out, "LICENSE"), license, "utf8");
  await writeFile(join(out, "README.md"), renderReadme(), "utf8");
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? `Qwen 发布态扩展包导出失败：${error.message}`
      : "Qwen 发布态扩展包导出失败。",
  );
  process.exitCode = 1;
});
