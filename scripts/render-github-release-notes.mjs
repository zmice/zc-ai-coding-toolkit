#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function parseArgs(argv) {
  let tag;
  let version;
  let out;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if ((current === "--tag" || current === "-t") && next) {
      tag = next;
      index += 1;
      continue;
    }

    if ((current === "--version" || current === "-v") && next) {
      version = next;
      index += 1;
      continue;
    }

    if ((current === "--out" || current === "-o") && next) {
      out = resolve(next);
      index += 1;
    }
  }

  if (!tag) {
    throw new Error("缺少 `--tag <tag>`。");
  }

  if (!version) {
    throw new Error("缺少 `--version <version>`。");
  }

  if (!out) {
    throw new Error("缺少 `--out <file>`。");
  }

  return { tag, version, out };
}

function renderNotes({ tag, version }) {
  const repoUrl = "https://github.com/zmice/zc-ai-coding-toolkit";
  const npmUrl = "https://www.npmjs.com/package/@zmice/zc";
  const qwenRepoUrl = "https://github.com/zmice/zc-qwen-extension";
  const assetName = `zc-qwen-extension-${version}.zip`;

  return `# ${tag}

\`zc\` 的统一 CLI 发版，继续提供面向 AI 编码 workflow 的安装、更新、诊断和平台适配能力。

## 安装与更新

\`\`\`bash
npm install -g @zmice/zc@${version}
\`\`\`

如果本机已安装旧版本，也可以直接更新：

\`\`\`bash
npm update -g @zmice/zc
\`\`\`

## 当前支持的平台

- Codex
- Claude Code
- OpenCode
- Qwen

## Release 附件

本次 GitHub Release 会附带一个 Qwen extension release bundle：

- \`${assetName}\`

它可以作为 Qwen 扩展发布产物查看，也可以配合独立扩展仓库一起使用。

## 相关链接

- npm：<${npmUrl}>
- 主仓库：<${repoUrl}>
- Qwen 扩展仓库：<${qwenRepoUrl}>

## Full Changelog

<${repoUrl}/commits/${tag}>
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await writeFile(options.out, renderNotes(options), "utf8");
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? `GitHub Release 文案生成失败：${error.message}`
      : "GitHub Release 文案生成失败。",
  );
  process.exitCode = 1;
});
