# @zmice/platform-codex

`@zmice/platform-codex` 把 `@zmice/toolkit` 的结构化内容渲染成 Codex 平台所需产物。

它是 **仓库内部包**，公开分发入口统一由 `@zmice/zc` 提供。

当前输出包括：

- `AGENTS.md`
- `skills/zc-<command>/SKILL.md`
- `skills/zc-<skill>/SKILL.md`

## 边界

- 提示资产内容不在本包维护
- 本包只关心 Codex 平台模板、安装计划和产物布局
- 不承担仓库治理能力

## 常用用法

```bash
zc platform install codex --dir /tmp/codex-out
zc platform install codex
zc platform install codex --global
zc platform where codex --global --json
zc platform install codex --plan --json
```

`--global` 默认会安装到 `~/.codex/AGENTS.md`。

当前安装模型：

- `--project`
  - 安装 `<project>/AGENTS.md`
  - 保守处理，不额外生成项目级 skills 目录
- `--global`
  - 安装 `~/.codex/AGENTS.md`
  - 同时安装 `~/.codex/skills/zc-<command>/SKILL.md`
  - 同时安装 `~/.codex/skills/zc-<skill>/SKILL.md`
- `--dir <path>`
  - 安装 `<path>/AGENTS.md`
  - 同时安装 `<path>/skills/zc-<command>/SKILL.md`
  - 同时安装 `<path>/skills/zc-<skill>/SKILL.md`

在 Codex 中：

- 统一命令语义通过 command-alias skill 承接，例如：
  - `$zc-start`
  - `$zc-spec`
  - `$zc-task-plan`
  - `$zc-build`
- 更完整的方法和专题能力继续通过 `$zc-<skill>` 使用

项目安装 / 全局安装的详细步骤见：

- `docs/usage-guide.md`

## 验证

```bash
pnpm --dir packages/platform-codex test
pnpm --dir packages/platform-codex build
pnpm --dir packages/platform-codex verify
```
