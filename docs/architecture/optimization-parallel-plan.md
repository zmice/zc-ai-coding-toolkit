# Implementation Plan: 四大优化点并行执行总计划

## Overview

本计划覆盖接下来四个优化方向的并行推进与收口策略：

1. `platform` 深化
2. `release / versioning`
3. `upstream automation`
4. `CI/CD`

目标是在保持 monorepo 主线稳定的前提下，利用多 agent 并行推进独立写入面，避免重新引入结构耦合、版本漂移和流水线反复返工。

## Architecture Decisions

- 四个优化点可以并行，但不能无序同时到底
- 先并行做 spec / contract / scaffold，再分批实现
- 最终版本策略、CI 命令和根级验证收口必须串行
- 所有 agent 都必须有明确写入面，避免跨目录互相踩踏
- `platform` 是最高优先级，因为它会影响 release 面和后续 CI 接线

## Dependency Graph

```text
platform 深化
   │
   ├── 影响 release / versioning 的包边界与发布面
   │
   ├── 影响 upstream automation 的导入/生成目标
   │
   └── 影响 CI/CD 的验证和发布命令

release / versioning
   │
   └── 影响 CI/CD 的 version / publish 流程

upstream automation
   │
   └── 依赖稳定的 toolkit / platform 结构，但可先并行做设计和骨架

CI/CD
   └── 最适合最后接线，避免流水线在中途频繁返工
```

## Parallel Execution Strategy

### Stage 1: 并行规格与契约

这一阶段不追求大规模代码落地，重点是先把边界定死。

## Task 1: Platform 深化规格与共享 contract

**Description:** 定义 platform core、artifact plan、install plan、overwrite policy、template context 和 CLI platform UX contract。

**Acceptance criteria:**
- [ ] 明确哪些逻辑平台共享
- [ ] 明确哪些逻辑平台特化
- [ ] 明确 `zc platform generate/install` 的统一 contract

**Verification:**
- [ ] 规格文档可审阅
- [ ] 没有与现有 monorepo 结构冲突

**Dependencies:** None

**Files likely touched:**
- `docs/architecture/**`
- 后续共享模块的占位目录（如需要）

**Estimated scope:** Medium

## Task 2: Release / Versioning 规格

**Description:** 定义多包版本策略、changeset 规则、首轮 release 流程与包之间的版本关系。

**Acceptance criteria:**
- [ ] 定义哪些包独立发版
- [ ] 定义 internal dependency 升级策略
- [ ] 定义首轮 release 的命令与步骤

**Verification:**
- [ ] `pnpm changeset status` 逻辑与规格一致

**Dependencies:** None

**Files likely touched:**
- `docs/architecture/**`
- `.changeset/**`

**Estimated scope:** Small

## Task 3: Upstream Automation 规格

**Description:** 定义 `zc upstream` 后续要支持的 diff / snapshot / report / import-dry-run contract。

**Acceptance criteria:**
- [ ] 明确自动化边界，仍保持人工审阅为最终决策
- [ ] 明确 `references` 与 toolkit/platform 的接口关系

**Verification:**
- [ ] 规格文档可审阅

**Dependencies:** None

**Files likely touched:**
- `docs/architecture/**`
- `references/**`

**Estimated scope:** Small

## Task 4: CI/CD 规格

**Description:** 定义 PR 验证、release 验证、publish 流程和需要接入的根级命令。

**Acceptance criteria:**
- [ ] 明确 PR 质量门禁
- [ ] 明确 release 前检查
- [ ] 明确 publish workflow 入口

**Verification:**
- [ ] 规格文档可审阅

**Dependencies:** Task 1, Task 2 的关键命令面需要已知

**Files likely touched:**
- `docs/architecture/**`

**Estimated scope:** Small

### Checkpoint: Specs Ready

- [ ] 四个方向的 spec/contract 都已可审阅
- [ ] 并发实现的写入面已经清晰
- [ ] 用户确认进入实现

### Stage 2: 并行实现第一批

## Task 5: Platform 深化实现

**Description:** 按新 contract 实现 platform core、模板上下文统一、install target resolver、overwrite policy、CLI platform UX 深化。

**Acceptance criteria:**
- [ ] 共享逻辑不再在 3 个平台包中重复散落
- [ ] `zc platform generate/install` 更强健
- [ ] 各平台模板渲染上下文统一

**Verification:**
- [ ] `pnpm verify`
- [ ] 三个平台 generate/install smoke check 通过

**Dependencies:** Task 1

**Files likely touched:**
- `packages/platform-*/**`
- `apps/cli/src/cli/platform.ts`
- 共享层文件（如新增）

**Estimated scope:** Large

## Task 6: Upstream Automation 第一批实现

**Description:** 在不做全自动吸收的前提下，实现 `zc upstream diff/show/report/import --dry-run` 的基础能力。

**Acceptance criteria:**
- [ ] 可生成 upstream diff/report
- [ ] 可做 import 候选 dry-run
- [ ] 仍然保持人工审阅闭环

**Verification:**
- [ ] `zc upstream` 子命令 smoke check
- [ ] `pnpm verify`

**Dependencies:** Task 3

**Files likely touched:**
- `apps/cli/src/cli/upstream.ts`
- `references/**`
- `scripts/**`

**Estimated scope:** Medium

## Task 7: Release / Versioning 第一批实现

**Description:** 基于 versioning spec，补 release guide、changeset 规则、初始版本矩阵和必要的 package metadata。

**Acceptance criteria:**
- [ ] release 文档可执行
- [ ] changeset 规则与包关系一致
- [ ] 版本策略不再依赖口头约定

**Verification:**
- [ ] `pnpm changeset status`
- [ ] 必要时 dry-run `changeset version`

**Dependencies:** Task 2

**Files likely touched:**
- `.changeset/**`
- `package.json`
- `apps/cli/package.json`
- `packages/*/package.json`
- `README.md` / `docs/architecture/**`

**Estimated scope:** Medium

### Checkpoint: Midpoint

- [ ] Platform 深化主功能完成
- [ ] Upstream automation 有可用骨架
- [ ] Release/versioning 规则已落地
- [ ] 用户确认进入最终收口

### Stage 3: 串行收口

## Task 8: 固化版本与发布策略

**Description:** 在 platform 和 release 规则都稳定后，串行定稿版本策略并准备首次规范化发布。

**Acceptance criteria:**
- [ ] 首次发布版本矩阵明确
- [ ] release checklist 可执行

**Verification:**
- [ ] `pnpm changeset status`
- [ ] 如需要，`changeset version` dry-run 验证

**Dependencies:** Task 5, Task 7

**Estimated scope:** Small

## Task 9: CI/CD 接线

**Description:** 将稳定下来的根级命令和发布规则接入流水线。

**Acceptance criteria:**
- [ ] PR workflow 跑 `pnpm verify`
- [ ] release workflow 跑 `changeset status` / version checks
- [ ] publish 流程可审计

**Verification:**
- [ ] workflow lint / dry-run
- [ ] 文档与实际命令一致

**Dependencies:** Task 5, Task 7, Task 8

**Estimated scope:** Medium

## Task 10: 全链路回归验证

**Description:** 对 4 个优化点的合并结果做根级验证，确认结构、版本、upstream 和平台链路全部自洽。

**Acceptance criteria:**
- [ ] `pnpm verify` 通过
- [ ] `pnpm changeset status` 正常
- [ ] 关键 CLI / platform / upstream 流程可用

**Verification:**
- [ ] `pnpm verify`
- [ ] `pnpm changeset status`
- [ ] `git diff --check`

**Dependencies:** Task 6, Task 8, Task 9

**Estimated scope:** Small

### Checkpoint: Complete

- [ ] 四个优化方向全部完成
- [ ] 功能与工程化闭环打通
- [ ] 可以进入提交 / 推送

## Multi-Agent Ownership

### Agent A: Platform Track

- 负责 `packages/platform-*/**`
- 负责共享 platform contract 的实现部分
- 可协同修改 `apps/cli/src/cli/platform.ts`

### Agent B: Release / Versioning Track

- 负责 `.changeset/**`
- 负责版本策略文档与包元数据
- 负责 release guide

### Agent C: Upstream Automation Track

- 负责 `references/**`
- 负责 `apps/cli/src/cli/upstream.ts`
- 负责相关脚本与报告生成

### Agent D: CI/CD Track

- 负责 `.github/workflows/**` 或对应 CI 目录
- 负责流水线相关文档
- 不改业务逻辑代码

### Mainline Integrator

- 串行维护总规格
- 做 fan-in 收口
- 负责根级验证、冲突处理、提交与推送

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Platform 先实现、contract 后补 | High | 先做 Task 1，再允许并行大规模改代码 |
| Release 与 CI 提前绑定未稳定命令 | High | CI/CD 放在最后接线 |
| Upstream 自动化做成全自动吸收 | Medium | 强制保留 dry-run 与 manual-review |
| 多 agent 写入面冲突 | Medium | 每个 agent 限定目录所有权 |
| 根级验证链中途频繁变化 | Medium | 只在 checkpoint 后统一调整 |

## Open Questions

- 是否需要在 platform 深化阶段引入单独共享包，例如 `packages/platform-core`
- release 这一轮是否只做 dry-run，不做真实 publish
- CI/CD 使用 GitHub Actions 还是对接 Codeup 的流水线体系
