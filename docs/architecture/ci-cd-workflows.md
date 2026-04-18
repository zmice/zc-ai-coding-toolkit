# CI/CD Workflows

## Objective

把 `docs/architecture/ci-cd-plan.md` 的 Stage 1 命令契约落地成最小可用 workflow：

- PR 和手动触发时运行 `pnpm verify`
- 手动触发时可运行 release gate：`pnpm verify` + `pnpm changeset status`

本文件只描述已经落地的 workflow 行为，不替代原始规划文档。

## Implemented Workflows

### Verify

文件：`.github/workflows/verify.yml`

- Triggers:
  - `pull_request`
  - `workflow_dispatch`
- Purpose:
  - 作为默认 PR 质量门禁
  - 也可手动触发，用于排查 CI 环境问题
- Commands:
  - `pnpm install --frozen-lockfile`
  - `pnpm verify`

### Release Gate

文件：`.github/workflows/release-gate.yml`

- Triggers:
  - `workflow_dispatch`
- Purpose:
  - 作为 release 准备阶段的只读检查
  - 不执行发布，只确认 workspace 验证和 changeset 状态
- Commands:
  - `pnpm install --frozen-lockfile`
  - `pnpm verify`
  - `pnpm changeset status`

## Design Notes

- `pnpm verify` 继续作为默认 PR gate，不把 `pnpm changeset status` 强制到所有 PR。
- release gate 暂时只做手动触发，避免在 Stage 2 第一批里扩大自动触发面。
- workflow 保持最小依赖：
  - `actions/checkout`
  - `pnpm/action-setup`
  - `actions/setup-node`
- Node 和 pnpm 版本与仓库当前 root 约定对齐：
  - Node `22`
  - pnpm `10.13.1`

## Boundaries

- 不修改现有发布脚本，`pnpm release` 仍然是 publish 唯一入口。
- 不新增 root 级命令，只复用现有 `pnpm verify` 和 `pnpm changeset status`。
- 不在本阶段引入 matrix、artifact upload、cache 微调、自动发布等复杂逻辑。

## Next Steps

- 当 `platform`、`release/versioning`、`upstream automation` 的实现稳定后，再决定：
  - 是否增加 `push` 到 `main` 的验证
  - 是否让 release gate 在特定 release PR 上自动触发
  - 是否单独补 publish workflow
