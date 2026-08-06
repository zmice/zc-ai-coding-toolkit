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
  return `# zc Codex Marketplace

[![source repo](https://img.shields.io/badge/source-zc--ai--coding--toolkit-24292f)](https://github.com/zmice/zc-ai-coding-toolkit)
[![npm version](https://img.shields.io/npm/v/@zmice/zc)](https://www.npmjs.com/package/@zmice/zc)
[![license](https://img.shields.io/github/license/zmice/zc-ai-coding-toolkit)](LICENSE)
[![codex marketplace](https://img.shields.io/badge/Codex-marketplace-111827)](https://developers.openai.com/codex/plugins/build)

这是由 [zc AI Coding Toolkit](https://github.com/zmice/zc-ai-coding-toolkit) 自动导出的 Codex marketplace 仓库。

这个仓库面向 Codex 官方插件分发模型，提供：

- \`.agents/plugins/marketplace.json\`
- \`plugins/zc-toolkit/.codex-plugin/plugin.json\`
- \`plugins/zc-toolkit/skills/\`
- \`AGENTS.md\` 薄入口
- \`.codex/agents/\` 和 \`.codex/config.toml\` 的 zc-managed custom agent 配置

## 安装 marketplace

\`\`\`bash
codex plugin marketplace add zmice/zc-codex-marketplace
\`\`\`

注册 marketplace 后，打开 Codex 的 **Plugins** 页面，选择 \`zc-toolkit\` 安装或启用插件。

## 更新

\`\`\`bash
codex plugin marketplace upgrade zc-toolkit
\`\`\`

更新后重新打开 Codex 或开始新线程，让新的 skills 列表进入会话。

## 常用入口

安装插件后，优先从这些入口开始：

- \`$start\`
- \`$product-analysis\`
- \`$sdd-tdd\`
- \`$debug\`
- \`$quality-review\`
- \`$context-init\`

也可以在 Codex 中使用 \`@\` 显式选择 \`zc-toolkit\` 或其中的 skill。

## 目录说明

- \`.agents/plugins/marketplace.json\`
  - Codex marketplace 清单，插件路径指向 \`./plugins/zc-toolkit\`
- \`plugins/zc-toolkit/\`
  - Codex plugin 根目录，包含 \`.codex-plugin/plugin.json\` 和 skills
- \`AGENTS.md\`
  - repo-local 薄入口，保留 zc 规则、命令语义映射和能力索引
- \`.codex/agents/\`
  - zc-managed custom agent role 配置，供项目级 Codex 配置使用

## 维护方式

这个仓库不是手工维护。

- 主仓库：<https://github.com/zmice/zc-ai-coding-toolkit>
- npm CLI：<https://www.npmjs.com/package/@zmice/zc>
- 同步方式：主仓库 GitHub Actions 自动导出并同步

如果你希望调整内容，请回到主仓库修改 \`packages/toolkit/src/content/\`，再由同步流程重新发布。

## 反馈与问题

- Issues：<https://github.com/zmice/zc-ai-coding-toolkit/issues>
- CLI README：<https://github.com/zmice/zc-ai-coding-toolkit/blob/main/apps/cli/README.md>
- 使用说明：<https://github.com/zmice/zc-ai-coding-toolkit/blob/main/docs/usage-guide.md>
- Codex 插件构建说明：<https://developers.openai.com/codex/plugins/build>
`;
}

function renderGitAttributes() {
  return [
    "# Keep companion integrity hashes stable across Windows, macOS, and Linux checkouts.",
    "plugins/zc-toolkit/assets/zc-agents/** text eol=lf",
    "",
  ].join("\n");
}

async function main() {
  const { out } = parseArgs(process.argv.slice(2));
  await mkdir(dirname(out), { recursive: true });

  await run("node", [
    "apps/cli/dist/cli/index.js",
    "platform",
    "generate",
    "codex",
    "--bundle",
    "codex-marketplace",
    "--dir",
    out,
  ]);

  const license = await readFile("LICENSE", "utf8");
  await writeFile(join(out, ".gitattributes"), renderGitAttributes(), "utf8");
  await writeFile(join(out, "LICENSE"), license, "utf8");
  await writeFile(join(out, "README.md"), renderReadme(), "utf8");
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? `Codex marketplace 发布包导出失败：${error.message}`
      : "Codex marketplace 发布包导出失败。",
  );
  process.exitCode = 1;
});
