# Release Guide

本指南是面向发布操作者的最小可用发布手册。发布策略本身仍以 [docs/architecture/release-versioning.md](/mnt/e/workspace/apps/ai-coding/docs/architecture/release-versioning.md:1) 为准。

## 发布对象

当前独立发布单元：

- `@zmice/toolkit`
- `@zmice/platform-core`
- `@zmice/platform-codex`
- `@zmice/platform-qoder`
- `@zmice/platform-qwen`
- `@zmice/zc`

非发布对象：

- `docs/**`
- `references/**`
- `scripts/**`
- `tests/**`

## 操作原则

- 版本变更只通过 `changeset` 驱动，不手改包版本。
- 发布前必须先跑 `pnpm verify`。
- 发布前必须先确认 `pnpm changeset status` 的 release batch。
- 内部依赖版本更新属于发布检查的一部分，不是发布后的补救动作。

## 标准命令

- 查看待发布批次：`pnpm changeset status`
- 发布前校验：`pnpm release:check`
- 版本后校验：`pnpm release:check:post-version`
- 应用版本变更：`pnpm changeset version`
- 同步 lockfile：`pnpm install`
- 发布：`pnpm release`

## 首次公开发布流程

1. 确认当前 changeset 只包含本次要发布的包。
2. 运行 `pnpm release:check`。
3. 运行 `pnpm changeset version`。
4. 运行 `pnpm install`。
5. 运行 `pnpm release:check:post-version`。
6. 确认版本号、依赖联动和工作树状态都符合预期。
7. 运行 `pnpm release`。

## 日常发布流程

1. 为本次用户可见变更准备 changeset。
2. 运行 `pnpm release:check`。
3. 运行 `pnpm changeset version`。
4. 运行 `pnpm install`。
5. 运行 `pnpm release:check:post-version`。
6. 审阅版本 diff。
7. 运行 `pnpm release`。

## 失败处理

- `pnpm release:check` 失败：
  - 优先清理非 release metadata 的脏改动。
  - 确认 `.changeset/*.md` 是否与本次发布意图一致。
- `pnpm release:check:post-version` 失败：
  - 检查是否有非版本化文件被意外修改。
  - 检查 `package.json` 和 `pnpm-lock.yaml` 是否同步。
- `pnpm verify` 失败：
  - 先修工作区健康问题，不进入发布。

## 发布后检查

- 再次确认目标包版本已按预期推进。
- 确认没有意外带出无关包。
- 记录本次发布的 changeset 和发布说明。
