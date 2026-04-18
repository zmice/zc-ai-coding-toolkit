# Release Checklist

## 版本前

- `pnpm changeset status` 输出的包集合正确
- `pnpm release:check` 通过
- 工作树除了 `.changeset/*.md` 外没有其他脏改动
- 本次 changeset 对应的 bump level 合理

## 版本后

- `pnpm changeset version` 已执行
- `pnpm install` 已执行
- `pnpm release:check:post-version` 通过
- 只有发布相关 `package.json` 和 `pnpm-lock.yaml` 出现预期变化
- 内部依赖版本联动正确

## 发布前最后确认

- `pnpm verify` 通过
- 待发布包版本号正确
- 没有无关包被带入本次 release batch
- 发布说明和 changeset 对得上

## 发布后

- 确认目标包已完成发布
- 确认发布批次与计划一致
- 记录异常和后续动作
