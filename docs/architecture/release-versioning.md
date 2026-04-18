# Release / Versioning Spec

## Objective

定义当前 monorepo 的对外发布模型，并明确下面几件事：

- 哪些包会公开发布
- 哪些包只是仓库内部实现包
- changeset 应该只驱动哪个发布单元
- `zc` 如何在发布后继续带上 toolkit / platform 能力

## Release Model

当前对外只公开发布一个包：

- `@zmice/zc`

仓库内部包：

- `@zmice/toolkit`
- `@zmice/platform-core`
- `@zmice/platform-qwen`
- `@zmice/platform-codex`
- `@zmice/platform-qoder`

这些内部包保留独立边界是为了：

- 在 monorepo 内清晰开发和测试
- 保持内容层、平台层、CLI 层的职责分离
- 避免把内部架构直接暴露成外部产品契约

## Packaging Rule

`zc` 公开发布时必须自带运行所需的内部产物。当前规则是：

- `apps/cli` build 时生成 `dist/`
- 同时把内部依赖 vendoring 到 `apps/cli/vendor/`
- vendored 内容至少包括：
  - `packages/toolkit` 的 `dist`、`src/content`、`templates`
  - `packages/platform-qwen` / `platform-codex` / `platform-qoder` 的 `dist`、`templates`
  - `packages/platform-core` 的运行时代码
  - `references/upstreams.yaml`

因此，用户安装 `@zmice/zc` 后不需要再单独安装 `toolkit` 或任何 `platform-*` 包。

## Changeset Policy

- changeset 只为 `@zmice/zc` 建立公开发布意图。
- 内部包不作为公开 release 单元参与 batch。
- 内部包可以继续保留版本字段用于 workspace 管理，但这些版本不构成对外语义承诺。
- `.changeset/config.json` 应忽略内部包，避免 changeset status 把它们带入发布批次。

## Package Matrix

| Package | Role | Public |
| --- | --- | --- |
| `@zmice/zc` | 对外 CLI 产品 | Yes |
| `@zmice/toolkit` | 内容事实源 | No |
| `@zmice/platform-core` | 平台共享 contract | No |
| `@zmice/platform-qwen` | Qwen 平台实现 | No |
| `@zmice/platform-codex` | Codex 平台实现 | No |
| `@zmice/platform-qoder` | Qoder 平台实现 | No |

非发布区域：

- `docs/**`
- `references/**`
- `scripts/**`
- `tests/**`

## Commands

- 检查待发布批次：`pnpm changeset status`
- 发布前校验：`pnpm release:check`
- 应用版本变更：`pnpm changeset version`
- 同步 lockfile：`pnpm install`
- 全量验证：`pnpm verify`
- 正式发布：`pnpm release`

## Release Gates

### Pre-version

- 工作树除了 `.changeset/*.md` 外没有无关脏改动
- `pnpm changeset status` 只包含 `@zmice/zc`
- `pnpm verify` 通过

### Post-version

允许变化：

- `apps/cli/package.json`
- `pnpm-lock.yaml`
- `.changeset/*.md`

不允许变化：

- 任何 `packages/*/package.json`
- 无关文档或脚本

## Publish Flow

1. 为 `@zmice/zc` 准备 changeset。
2. 运行 `pnpm release:check`。
3. 运行 `pnpm changeset version`。
4. 运行 `pnpm install`。
5. 运行 `pnpm release:check:post-version`。
6. 运行 `pnpm verify`，确认 vendored runtime 正常。
7. 运行 `pnpm release`。

## Boundaries

- Always:
  - 只把 `@zmice/zc` 作为公开发布单元
  - 保留内部包的独立开发边界
  - 用 vendoring 解决公开包的运行时依赖
- Ask first:
  - 改变 `@zmice/zc` 的包名、scope 或公开发布方式
  - 再次把内部包暴露成独立公网包
- Never:
  - 手工修改版本替代 changeset
  - 在发布时遗漏 vendored runtime
  - 把内部包误写回公开 release batch

## Success Criteria

- `pnpm changeset status` 默认只聚焦 `@zmice/zc`
- `pnpm release:check` 和 `pnpm release:check:post-version` 与单包发布模型一致
- `apps/cli` build 后可以在脱离 monorepo 的目录中执行 `toolkit` 和 `platform` 命令
- 仓库文档统一描述为“只发布 zc，内部包不单独公开”
