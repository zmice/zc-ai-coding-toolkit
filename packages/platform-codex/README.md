# @zmice/platform-codex

`@zmice/platform-codex` 把 `@zmice/toolkit` 的结构化内容渲染成 Codex 平台所需产物。

当前输出包括：

- `AGENTS.md`

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

项目安装 / 全局安装的详细步骤见：

- `docs/usage-guide.md`

## 验证

```bash
pnpm --dir packages/platform-codex test
pnpm --dir packages/platform-codex build
pnpm --dir packages/platform-codex verify
```
