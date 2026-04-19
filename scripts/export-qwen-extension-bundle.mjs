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

这个仓库可直接作为 Qwen Code 的 Git 扩展安装源，提供：

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

## 卸载

\`\`\`bash
qwen extensions uninstall zc-toolkit
\`\`\`

## 这是什么

这套扩展把 \`zc AI Coding Toolkit\` 的统一内容投影到 Qwen 原生扩展模型里：

- \`commands/zc/*.md\`
- \`skills/zc-*/SKILL.md\`
- \`agents/zc-*.md\`

它不是零散 prompt 文件集合，而是一套按固定 workflow 组织的内容系统，核心包括：

- \`product-analysis\`
- \`full-delivery\`
- \`bugfix\`
- \`review-closure\`
- \`docs-release\`
- \`investigation\`

通常从 \`zc:start\` 开始，由 AI 先评估任务类型，再进入对应 workflow。

## 命名空间规则

为了避免和平台内置命令或其他扩展冲突，这个扩展统一使用 \`zc\` 命名空间：

- \`zc:start\`
- \`zc:product-analysis\`
- \`zc:sdd-tdd\`
- \`zc:spec\`
- \`zc:task-plan\`
- \`zc:build\`
- \`zc:quality-review\`
- \`zc:verify\`

skills 和 agents 也会保留 \`zc-\` 前缀。

## 目录说明

- \`QWEN.md\`
  - 薄入口文件，说明 workflow、统一开始方式和详细内容入口
- \`commands/zc/\`
  - 统一任务入口和阶段入口
- \`skills/zc-*/SKILL.md\`
  - workflow 技能和专项方法
- \`agents/zc-*.md\`
  - 角色型入口

## 适合什么场景

- 想在 Qwen 里用统一 workflow 组织 AI 编码任务
- 想把 spec / plan / build / review / verify 这些入口稳定下来
- 想把 commands、skills、agents 作为一个受控扩展整体安装和更新

## 维护方式

这个仓库不是手工维护。

- 主仓库：<https://github.com/zmice/zc-ai-coding-toolkit>
- 同步方式：主仓库 GitHub Actions 自动导出并同步
- 这里的内容应视为发布产物，不建议直接手改

如果你希望调整内容，请回到主仓库修改，再由同步流程重新发布。

## 更多信息

- 主仓库 README：<https://github.com/zmice/zc-ai-coding-toolkit>
- 主仓库使用说明：<https://github.com/zmice/zc-ai-coding-toolkit/blob/main/docs/usage-guide.md>
- Qwen 平台说明：<https://github.com/zmice/zc-ai-coding-toolkit/blob/main/packages/platform-qwen/README.md>
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
