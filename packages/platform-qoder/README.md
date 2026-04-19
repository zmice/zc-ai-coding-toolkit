# @zmice/platform-qoder

`@zmice/platform-qoder` 把 `@zmice/toolkit` 的结构化内容渲染成 Qoder 平台所需产物。

它是 **仓库内部包**，公开分发入口统一由 `@zmice/zc` 提供。

当前输出包括：

- `AGENTS.md`
- `commands/zc-<command>.md`
- `skills/zc-<skill>/SKILL.md`
- `agents/zc-<agent>.md`

## 边界

- 内容仍由 `@zmice/toolkit` 维护
- 本包只处理 Qoder 平台模板、安装计划和落盘策略
- 不负责 upstream 审阅、snapshot 或导入提案

## 常用用法

```bash
zc platform install qoder
zc platform install qoder --global
zc platform where qoder --global --json
zc platform install qoder --plan --json
```

省略 `--dir` 时，CLI 会优先把最近项目根解析为安装目录。

当前安装模型：

- `--project`
  - 安装 `<project>/AGENTS.md`
  - 安装 `<project>/.qoder/commands/zc-<command>.md`
  - 安装 `<project>/.qoder/skills/zc-<skill>/SKILL.md`
  - 安装 `<project>/.qoder/agents/zc-<agent>.md`
- `--global`
  - 安装 `~/.qoder/AGENTS.md`
  - 安装 `~/.qoder/commands/zc-<command>.md`
  - 安装 `~/.qoder/skills/zc-<skill>/SKILL.md`
  - 安装 `~/.qoder/agents/zc-<agent>.md`
- `--dir <path>`
  - 安装 `<path>/AGENTS.md`
  - 安装 `<path>/commands/zc-<command>.md`
  - 安装 `<path>/skills/zc-<skill>/SKILL.md`
  - 安装 `<path>/agents/zc-<agent>.md`

项目安装 / 全局安装的详细步骤见：

- `docs/usage-guide.md`

## 验证

```bash
pnpm --dir packages/platform-qoder test
pnpm --dir packages/platform-qoder build
pnpm --dir packages/platform-qoder verify
```
