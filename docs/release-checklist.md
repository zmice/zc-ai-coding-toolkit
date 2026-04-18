# Release Checklist

## 版本前

- `pnpm changeset status` 只包含 `@zmice/zc`
- `pnpm release:check` 通过
- 工作树除了 `.changeset/*.md` 外没有其他脏改动
- 本次 changeset 对应的 bump level 合理

## 版本后

- `pnpm changeset version` 已执行
- `pnpm install` 已执行
- `pnpm release:check:post-version` 通过
- 只有 `apps/cli/package.json` 和 `pnpm-lock.yaml` 出现预期变化
- 内部 workspace 包没有被误带进发布面

## 发布前最后确认

- `pnpm verify` 通过
- 待发布包版本号正确，且只发布 `@zmice/zc`
- 没有无关包被带入本次 release batch
- 发布说明和 changeset 对得上

## 发布后

- 确认目标包已完成发布
- 确认发布批次与计划一致
- 记录异常和后续动作
