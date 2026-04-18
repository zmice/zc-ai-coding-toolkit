# Release Guide

本指南是面向发布操作者的最小发布手册。当前对外只发布一个包：

- `@zmice/zc`

`packages/toolkit`、`packages/platform-*` 仍然保留在 monorepo 中独立开发，但它们是内部包，不直接发布到 registry。`zc` 会在构建时把运行所需的内部产物 vendoring 到自身包里。

## 发布对象

公开发布对象：

- `@zmice/zc`

非发布对象：

- `packages/toolkit/**`
- `packages/platform-*/**`
- `docs/**`
- `references/**`
- `scripts/**`
- `tests/**`

## 操作原则

- 版本变更只通过 `changeset` 驱动，不手改包版本。
- 发布前必须先跑 `pnpm verify`。
- 发布前必须先确认 `pnpm changeset status` 只包含 `@zmice/zc`。
- `zc` 的发布必须包含最新 vendored 运行时产物。

## 标准命令

- 查看待发布批次：`pnpm changeset status`
- 发布前校验：`pnpm release:check`
- 版本后校验：`pnpm release:check:post-version`
- 应用版本变更：`pnpm changeset version`
- 同步 lockfile：`pnpm install`
- 发布：`pnpm release`

## 标准发布流程

1. 确认当前 changeset 只包含 `@zmice/zc`。
2. 运行 `pnpm release:check`。
3. 运行 `pnpm changeset version`。
4. 运行 `pnpm install`。
5. 运行 `pnpm release:check:post-version`。
6. 运行 `pnpm verify`，确认 `zc` build 后携带的 vendored 运行时正常。
7. 审阅 `apps/cli/package.json` 和 `pnpm-lock.yaml` 的版本变化。
8. 运行 `pnpm release`。

## 失败处理

- `pnpm release:check` 失败：
  - 优先清理非 `.changeset/*.md` 的脏改动。
  - 确认 changeset 没有错误引用内部包。
- `pnpm release:check:post-version` 失败：
  - 检查是否有非 `apps/cli/package.json` 的 manifest 被误修改。
  - 检查 `pnpm-lock.yaml` 是否同步。
- `pnpm verify` 失败：
  - 先修 workspace 健康问题，不进入发布。

## 发布后检查

- 确认 `@zmice/zc` 版本按预期推进。
- 确认没有内部包被误带入发布批次。
- 确认 CLI 全局安装后仍能执行 `toolkit` / `platform` 相关命令。
