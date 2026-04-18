# Spec: CI/CD Stage 1

## Objective

本阶段只定义 CI/CD 的验证边界和命令契约，不落地 workflow 实现。

目标是把三条路径说清楚：

1. PR 提交时要跑什么
2. release 准备时要跑什么
3. publish 时要跑什么

成功标准：

- PR、release、publish 三类门禁有明确分工
- `pnpm verify` 继续作为 workspace 级基础质量门禁
- `pnpm changeset status` 继续作为 release 资格检查
- `pnpm release` 继续作为 publish 入口
- 不引入新的根级命令名来替代现有脚本，避免在 Stage 1 扩大变更面

### Assumptions I’m making

1. Stage 1 只产出规格文档，不修改 `package.json`、workflow 文件或发布脚本。
2. CI provider 先保持中立，文档只定义门禁语义，不绑定 GitHub Actions 或其他平台。
3. 现有 root `pnpm verify` 已经是各 workspace package 的总验证入口，规格不重写其内部逻辑。
4. `changeset publish` 是当前 publish 机制的唯一权威入口，Stage 1 不引入额外的发布工具链。

## Commands

### Root commands

| Command | Purpose | Gate |
| --- | --- | --- |
| `pnpm verify` | 运行 workspace 级 lint / test / build / generate 验证 | PR 必跑，release 也必跑 |
| `pnpm changeset status` | 检查 changeset / release 状态是否可进入发布流程 | release 必跑，release 相关 PR 需要跑 |
| `pnpm release` | 执行 `changeset publish`，作为 publish 入口 | publish 专用 |

### Package-level commands

这些命令不作为 Stage 1 的主门禁，但保留为排障和局部验证手段：

- `pnpm --dir packages/toolkit verify`
- `pnpm --dir packages/platform-qwen verify`
- `pnpm --dir packages/platform-codex verify`
- `pnpm --dir packages/platform-qoder verify`
- `pnpm --dir apps/cli verify`

## Project Structure

Stage 1 只定义命令和门禁，不要求新增代码目录，但需要把责任边界写清楚：

- `package.json`
  - 保持 root `verify`、`changeset`、`release` 作为首要入口
- `scripts/run-workspace-task.mjs`
  - 继续承担 root `verify` 的 workspace fan-out
- `.changeset/`
  - 作为 release 资格与版本变更的事实来源
- `docs/architecture/ci-cd-plan.md`
  - 作为本阶段的规范来源
- `.github/workflows/`
  - 后续 Stage 2 再落地，不在本阶段修改

## Code Style

本规格使用“门禁矩阵 + 命令契约”的写法，而不是描述性散文。

```yaml
pr_gate:
  required:
    - pnpm verify
  conditional:
    - pnpm changeset status # 仅当 PR 触及 release 元数据时运行

release_gate:
  required:
    - pnpm verify
    - pnpm changeset status

publish_gate:
  required:
    - pnpm release
```

约定：

- PR gate 只关心“代码是否健康”
- release gate 关心“版本/changeset 状态是否可以进入发布”
- publish gate 只关心“是否已经具备发布条件并执行发布”

## Testing Strategy

本阶段不写代码测试，但要定义后续实现时的验证顺序：

1. PR 路径先验证 `pnpm verify`
2. release 路径再验证 `pnpm changeset status`
3. publish 路径最后执行 `pnpm release`

后续 workflow 落地时的最低验证要求：

- 任一 workspace package 的 lint/test/build/generate 失败，`pnpm verify` 必须失败
- 任一 release 元数据异常，`pnpm changeset status` 必须失败
- 未经过 release gate 的环境不得执行 `pnpm release`

## Boundaries

- Always:
  - PR 以 `pnpm verify` 作为基础质量门禁
  - release 以 `pnpm changeset status` 作为发布资格检查
  - publish 以 `pnpm release` 作为唯一发布入口
  - 在文档里明确区分“代码质量检查”和“发布资格检查”
- Ask first:
  - 是否要把 `pnpm changeset status` 作为所有 PR 的强制门禁，而不是只对 release 相关 PR 启用
  - 是否要在后续阶段新增 `pnpm release:check` / `pnpm release:prep` 之类的 root 封装命令
  - 是否要在 Stage 2 采用 GitHub Actions 还是其他 CI provider
- Never:
  - 在 Stage 1 修改任何脚本或 workflow 文件
  - 用新的根级命令名替换 `verify`、`changeset`、`release`
  - 把 publish 逻辑分散到多个入口，导致 release 行为不唯一

## Success Criteria

- 读者可以直接从本文件判断 PR、release、publish 各自跑什么
- `pnpm verify` 被明确为 PR 和 release 的共同基础门禁
- `pnpm changeset status` 被明确为 release 资格检查，而不是普通 PR 的默认门禁
- `pnpm release` 被明确为 publish 唯一入口
- 文档没有要求修改现有代码文件，符合 Stage 1 的只写规格范围

## Open Questions

- release 流程是否需要一个单独的 release PR，还是直接在 main 分支完成 version / publish 流程
- 是否需要为 release 预留一个 root 级只读命令封装，还是继续直接调用 `pnpm changeset status`
- CI provider 选型是否会影响后续 workflow 的拆分粒度
