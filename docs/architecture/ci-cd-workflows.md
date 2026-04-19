# CI/CD Workflows

## Objective

把当前仓库的 CI/CD 命令契约落地成最小可用 workflow：

- PR 和手动触发时运行 `pnpm verify`
- 手动触发时可运行 release gate：`pnpm verify` + `pnpm changeset status`
- 手动触发时复用 `release-check` 的 pre-version 逻辑

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
  - `node scripts/release-check.mjs pre-version --skip-commands`

### Publish Qwen Extension Repo

文件：`.github/workflows/publish-qwen-extension-repo.yml`

- Triggers:
  - `push` tags: `@zmice/zc@*`
  - `workflow_dispatch`
- Purpose:
  - 导出 Qwen 发布态 extension bundle
  - 把 bundle 同步到独立 GitHub 扩展仓库
- Commands:
  - `pnpm install --frozen-lockfile`
  - `pnpm --dir apps/cli build`
  - `node scripts/export-qwen-extension-bundle.mjs --out <runner-temp>`
  - `rsync` 同步到目标扩展仓库
  - `git commit && git push`

### Publish GitHub Release

文件：`.github/workflows/publish-github-release.yml`

- Triggers:
  - `push` tags: `@zmice/zc@*`
  - `workflow_dispatch`
- Purpose:
  - 为 `@zmice/zc` 版本 tag 创建或更新 GitHub Release
  - 使用仓库内模板生成 release 文案
  - 上传 Qwen extension release bundle 压缩包
- Commands:
  - `pnpm install --frozen-lockfile`
  - `pnpm --dir apps/cli build`
  - `node scripts/export-qwen-extension-bundle.mjs --out <runner-temp>`
  - `node scripts/render-github-release-notes.mjs --tag <tag> --version <version> --out <runner-temp>`
  - `zip -r` 打包 Qwen bundle
  - `gh release create` / `gh release edit` / `gh release upload`

## Design Notes

- `pnpm verify` 继续作为默认 PR gate，不把 `pnpm changeset status` 强制到所有 PR。
- release gate 暂时只做手动触发，避免在 Stage 2 第一批里扩大自动触发面。
- release gate 直接复用 `release-check` 的 pre-version 规则，避免 CI 和本地 release preflight 漂移。
- npm 继续作为唯一 npm 分发源；GitHub Release 只承载版本展示和 release asset，不额外引入 GitHub Packages npm registry。
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
- 不在本阶段引入 matrix、cache 微调、GitHub Packages npm 分发等额外复杂度。

## Next Steps

- 当 `platform`、`release/versioning`、`upstream automation` 的实现稳定后，再决定：
  - 是否增加 `push` 到 `main` 的验证
  - 是否让 release gate 在特定 release PR 上自动触发
  - 是否单独补 publish workflow
