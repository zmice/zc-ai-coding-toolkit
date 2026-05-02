#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const releaseTagPattern = /^@zmice\/zc@(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/;

const commitTypeLabels = {
  feat: "新增能力",
  fix: "修复",
  refactor: "架构与重构",
  docs: "文档与内容",
  chore: "工程维护",
  test: "测试",
  ci: "CI/CD",
  perf: "性能"
};

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

function runGit(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });

  if (result.status !== 0) {
    return "";
  }

  return result.stdout.trim();
}

function parseVersion(value) {
  const [major = "0", minor = "0", patch = "0"] = value.split(/[+-]/)[0].split(".");
  return [Number(major), Number(minor), Number(patch)];
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }

  return left.localeCompare(right);
}

export function findPreviousReleaseTag(tag, tags) {
  const currentMatch = tag.match(releaseTagPattern);
  if (!currentMatch) {
    return undefined;
  }

  const candidates = tags
    .map((candidate) => {
      const match = candidate.match(releaseTagPattern);
      return match ? { tag: candidate, version: match[1] } : undefined;
    })
    .filter(Boolean)
    .sort((left, right) => compareVersions(left.version, right.version));

  const exactIndex = candidates.findIndex((candidate) => candidate.tag === tag);
  if (exactIndex > 0) {
    return candidates[exactIndex - 1].tag;
  }

  const previousCandidates = candidates.filter(
    (candidate) => compareVersions(candidate.version, currentMatch[1]) < 0
  );

  return previousCandidates.at(-1)?.tag;
}

function listReleaseTags() {
  const output = runGit(["tag", "--list", "@zmice/zc@*"]);
  return output ? output.split("\n").filter(Boolean) : [];
}

function resolveCommitRange(tag, previousTag) {
  const targetExists = Boolean(runGit(["rev-parse", "--verify", "--quiet", `${tag}^{commit}`]));
  const target = targetExists ? tag : "HEAD";
  return previousTag ? `${previousTag}..${target}` : target;
}

export function parseCommitSubject(subject) {
  const match = subject.match(/^([a-z]+)(?:\(([^)]+)\))?:\s+(.+)$/i);
  if (!match) {
    return { type: "other", summary: subject };
  }

  return {
    type: match[1].toLowerCase(),
    scope: match[2],
    summary: match[3]
  };
}

function collectCommits(tag, previousTag) {
  const output = runGit(["log", "--no-merges", "--format=%s", resolveCommitRange(tag, previousTag)]);
  if (!output) {
    return [];
  }

  return output.split("\n").filter(Boolean).map(parseCommitSubject);
}

function groupCommits(commits) {
  const groups = new Map();

  for (const commit of commits) {
    const type = commitTypeLabels[commit.type] ? commit.type : "other";
    const label = commitTypeLabels[type] ?? "其他变更";
    const entries = groups.get(label) ?? [];
    entries.push(commit);
    groups.set(label, entries);
  }

  return groups;
}

function renderCommitLine(commit) {
  const scope = commit.scope ? `**${commit.scope}**: ` : "";
  return `- ${scope}${commit.summary}`;
}

function renderChanges(commits) {
  if (commits.length === 0) {
    return [
      "## 本次变更",
      "",
      "- 未从当前 tag 范围内检测到可分组提交；请查看下方完整变更链接。"
    ].join("\n");
  }

  const lines = ["## 本次变更", ""];
  for (const [label, entries] of groupCommits(commits)) {
    lines.push(`### ${label}`, "");
    lines.push(...entries.map(renderCommitLine), "");
  }

  return lines.join("\n").trimEnd();
}

export function renderNotes({ tag, version, previousTag, commits = [] }) {
  const repoUrl = "https://github.com/zmice/zc-ai-coding-toolkit";
  const npmUrl = "https://www.npmjs.com/package/@zmice/zc";
  const qwenRepoUrl = "https://github.com/zmice/zc-qwen-extension";
  const assetName = `zc-qwen-extension-${version}.zip`;
  const changelogUrl = previousTag
    ? `${repoUrl}/compare/${previousTag}...${tag}`
    : `${repoUrl}/commits/${tag}`;

  return `# ${tag}

\`zc\` 的统一 CLI 发版，包含本次从上一个版本以来的 CLI、平台适配、workflow 内容与发布工程变更。

${renderChanges(commits)}

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

## 发布说明

- 对外 npm 包仍然只发布 \`@zmice/zc\`。
- \`packages/toolkit\` 与 \`packages/platform-*\` 继续作为内部运行时随 CLI vendoring。
- GitHub Release 附件继续提供 Qwen extension release bundle。

## Release 附件

本次 GitHub Release 会附带一个 Qwen extension release bundle：

- \`${assetName}\`

它可以作为 Qwen 扩展发布产物查看，也可以配合独立扩展仓库一起使用。

## 相关链接

- npm：<${npmUrl}>
- 主仓库：<${repoUrl}>
- Qwen 扩展仓库：<${qwenRepoUrl}>

## Full Changelog

<${changelogUrl}>
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const tags = listReleaseTags();
  const previousTag = findPreviousReleaseTag(options.tag, tags);
  const commits = collectCommits(options.tag, previousTag);

  await writeFile(options.out, renderNotes({ ...options, previousTag, commits }), "utf8");
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isMain) {
  main().catch((error) => {
    console.error(
      error instanceof Error
        ? `GitHub Release 文案生成失败：${error.message}`
        : "GitHub Release 文案生成失败。",
    );
    process.exitCode = 1;
  });
}
