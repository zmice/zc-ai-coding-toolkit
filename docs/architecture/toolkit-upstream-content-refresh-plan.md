# Implementation Plan: Toolkit Upstream Content Refresh

## Overview

本计划把 [toolkit-upstream-content-refresh.md](/mnt/e/workspace/apps/ai-coding/docs/architecture/toolkit-upstream-content-refresh.md) 拆成可执行任务。

目标不是继续扩充 `toolkit` 表面面积，而是补齐 4 类内容闭环：

1. review response / branch closure
2. documentation drift closure
3. DevEx live audit
4. verification / principle reinforcement

## Architecture Decisions

- 以 `skill` 为主战场，不优先新增 `command` 或 `agent`
- 新增轻量闭环 skill，增强少量高频既有 skill
- 所有新增或增强资产都必须进入关系图
- `engineering-principles` 继续保持轻量原则层，不扩成大全技能
- 多 agent 并发只发生在写入面明确不重叠的任务上

## Dependency Graph

```text
Workstream A contract
  ├── review-response-and-resolution
  │    └── code-review-and-quality / quality-review
  └── branch-finish-and-cleanup
       ├── git-workflow-and-versioning
       ├── parallel-agent-dispatch
       └── team-orchestration

Workstream B contract
  ├── release-documentation-sync
  │    ├── documentation-and-adrs
  │    └── shipping-and-launch

Workstream C contract
  ├── developer-experience-audit
  │    └── multi-perspective-review

Workstream D contract
  ├── engineering-principles
  │    ├── verification-before-completion
  │    ├── ci-cd-and-automation
  │    ├── browser-qa-testing
  │    └── context-engineering

All workstreams
  └── relation graph + lint + verify
```

## Parallel Lanes

### Serial Foundation

- 定 4 个新/增强 workstream 的边界、命名和 source identity
- 定原则映射表和 relation graph 策略

### Parallel Lane A

- `review-response-and-resolution`
- `code-review-and-quality`
- `quality-review`

### Parallel Lane B

- `branch-finish-and-cleanup`
- `git-workflow-and-versioning`
- `parallel-agent-dispatch`
- `team-orchestration`

### Parallel Lane C

- `release-documentation-sync`
- `documentation-and-adrs`
- `shipping-and-launch`

### Parallel Lane D

- `developer-experience-audit`
- `multi-perspective-review`

### Parallel Lane E

- `engineering-principles`
- `verification-before-completion`
- `ci-cd-and-automation`
- `browser-qa-testing`
- `context-engineering`

### Serial Integration

- 统一 `meta.yaml` 关系图
- 跑 lint / tests / verify
- 校准文档口径

## Task List

## Task 1: 定义新增资产 contract 与原则映射表

**Description:** 先锁定 4 个新增轻量 skill 的命名、职责边界、source strategy 和与既有资产的关系；同时定义 `engineering-principles` 到下游 skill 的映射表，避免并发实现时发生重复和漂移。

**Acceptance criteria:**
- [ ] 明确 4 个新增 skill 的 canonical 名称和职责边界
- [ ] 明确每个新增 skill 的 `source.strategy`
- [ ] 明确 `engineering-principles` 的原则到下游资产的映射表
- [ ] 明确哪些关系用 `requires`，哪些用 `suggests`

**Verification:**
- [ ] 计划文档边界完整，无重叠定义
- [ ] 实现阶段不会出现两个 lane 争写同一新资产

**Dependencies:** None

**Files likely touched:**
- `docs/architecture/toolkit-upstream-content-refresh.md`
- `docs/architecture/toolkit-upstream-content-refresh-plan.md`

**Estimated scope:** Small

## Task 2: 新增 review response 闭环技能

**Description:** 新增 `review-response-and-resolution`，把收到 review 反馈后的分类、修复顺序、回归验证和回复 reviewer 变成独立 skill。

**Acceptance criteria:**
- [ ] 新 skill 包含 `meta.yaml` 和 `body.md`
- [ ] 正文覆盖反馈分类、修复优先级、回归验证、重新提交门槛
- [ ] `source` 字段符合当前治理规则

**Verification:**
- [ ] `node apps/cli/dist/cli/index.js toolkit lint --json`
- [ ] `pnpm --dir packages/toolkit test`

**Dependencies:** Task 1

**Files likely touched:**
- `packages/toolkit/src/content/skills/review-response-and-resolution/meta.yaml`
- `packages/toolkit/src/content/skills/review-response-and-resolution/body.md`

**Estimated scope:** Small

## Task 3: 接入 review response 到现有审查链

**Description:** 把 `review-response-and-resolution` 接入 `code-review-and-quality` 和 `quality-review`，形成 review -> response 的显式闭环。

**Acceptance criteria:**
- [ ] `code-review-and-quality` 写清 review 后进入 response 闭环
- [ ] `quality-review` 入口补到 response 闭环
- [ ] 关系图体现 review -> response

**Verification:**
- [ ] `node apps/cli/dist/cli/index.js toolkit lint --json`
- [ ] `pnpm --dir apps/cli test -- src/cli/__tests__/toolkit.test.ts`

**Dependencies:** Task 1, Task 2

**Files likely touched:**
- `packages/toolkit/src/content/skills/code-review-and-quality/meta.yaml`
- `packages/toolkit/src/content/skills/code-review-and-quality/body.md`
- `packages/toolkit/src/content/commands/quality-review/meta.yaml`
- `packages/toolkit/src/content/commands/quality-review/body.md`

**Estimated scope:** Medium

## Task 4: 新增 branch/worktree 收尾技能

**Description:** 新增 `branch-finish-and-cleanup`，统一 merge / PR / keep / discard / cleanup 的收尾规则。

**Acceptance criteria:**
- [ ] 新 skill 包含 `meta.yaml` 和 `body.md`
- [ ] 正文覆盖分支完成态、worktree 清理、失败分支处置
- [ ] 不被 `team-orchestration` 的 zc 细节绑死

**Verification:**
- [ ] `node apps/cli/dist/cli/index.js toolkit lint --json`
- [ ] `pnpm --dir packages/toolkit test`

**Dependencies:** Task 1

**Files likely touched:**
- `packages/toolkit/src/content/skills/branch-finish-and-cleanup/meta.yaml`
- `packages/toolkit/src/content/skills/branch-finish-and-cleanup/body.md`

**Estimated scope:** Small

## Task 5: 接入 branch closure 到 git / parallel / team 内容

**Description:** 把 branch/worktree 收尾规则接入 `git-workflow-and-versioning`、`parallel-agent-dispatch`、`team-orchestration`。

**Acceptance criteria:**
- [ ] Git workflow 写清 branch finish / cleanup checklist
- [ ] Parallel dispatch 写清 fan-in 后的 success/failure closure
- [ ] Team orchestration 写清 shutdown 前后收尾协议
- [ ] 三处口径一致

**Verification:**
- [ ] `node apps/cli/dist/cli/index.js toolkit lint --json`
- [ ] `pnpm --dir apps/cli test -- src/cli/__tests__/toolkit.test.ts`

**Dependencies:** Task 1, Task 4

**Files likely touched:**
- `packages/toolkit/src/content/skills/git-workflow-and-versioning/meta.yaml`
- `packages/toolkit/src/content/skills/git-workflow-and-versioning/body.md`
- `packages/toolkit/src/content/skills/parallel-agent-dispatch/meta.yaml`
- `packages/toolkit/src/content/skills/parallel-agent-dispatch/body.md`
- `packages/toolkit/src/content/skills/team-orchestration/meta.yaml`
- `packages/toolkit/src/content/skills/team-orchestration/body.md`

**Estimated scope:** Large

## Checkpoint: After Tasks 2-5

- [ ] Workstream A 新增资产已存在
- [ ] 审查闭环和分支闭环都已显式进入关系图
- [ ] `toolkit lint` 通过

## Task 6: 新增发布文档同步技能

**Description:** 新增轻量 `release-documentation-sync`，承接代码/发布完成后的长期文档同步清单和 drift closure。

**Acceptance criteria:**
- [ ] 新 skill 包含 `meta.yaml` 和 `body.md`
- [ ] 正文明确同步对象、最小验收、与 docs/release skill 的边界
- [ ] skill 保持轻量，不膨胀成通用文档大全

**Verification:**
- [ ] `node apps/cli/dist/cli/index.js toolkit lint --json`
- [ ] `pnpm --dir packages/toolkit test`

**Dependencies:** Task 1

**Files likely touched:**
- `packages/toolkit/src/content/skills/release-documentation-sync/meta.yaml`
- `packages/toolkit/src/content/skills/release-documentation-sync/body.md`

**Estimated scope:** Small

## Task 7: 接入 documentation drift closure

**Description:** 强化 `documentation-and-adrs` 与 `shipping-and-launch`，让发布后文档 drift 成为显式收尾 gate。

**Acceptance criteria:**
- [ ] `documentation-and-adrs` 覆盖文档同步清单和 drift 触发条件
- [ ] `shipping-and-launch` 覆盖发布说明、安装/升级指引、回滚说明的同步收尾
- [ ] 两者与 `release-documentation-sync` 的关系清晰

**Verification:**
- [ ] `node apps/cli/dist/cli/index.js toolkit lint --json`
- [ ] `pnpm --dir packages/toolkit test`

**Dependencies:** Task 1, Task 6

**Files likely touched:**
- `packages/toolkit/src/content/skills/documentation-and-adrs/meta.yaml`
- `packages/toolkit/src/content/skills/documentation-and-adrs/body.md`
- `packages/toolkit/src/content/skills/shipping-and-launch/meta.yaml`
- `packages/toolkit/src/content/skills/shipping-and-launch/body.md`

**Estimated scope:** Medium

## Task 8: 新增 DevEx 实测审计技能

**Description:** 新增 `developer-experience-audit`，覆盖实现后从 onboarding、安装、首次成功路径出发的真实开发者体验审计。

**Acceptance criteria:**
- [ ] 新 skill 包含 `meta.yaml` 和 `body.md`
- [ ] 正文覆盖 getting started、安装链、首次成功路径、失败回流
- [ ] 通过/阻断标准明确

**Verification:**
- [ ] `node apps/cli/dist/cli/index.js toolkit lint --json`
- [ ] `pnpm --dir packages/toolkit test`

**Dependencies:** Task 1

**Files likely touched:**
- `packages/toolkit/src/content/skills/developer-experience-audit/meta.yaml`
- `packages/toolkit/src/content/skills/developer-experience-audit/body.md`

**Estimated scope:** Small

## Task 9: 接入 DevEx 审计到计划评审链

**Description:** 强化 `multi-perspective-review`，明确 DevEx 视角是实现前评审；同时把实现后的 DevEx audit 接入关系图。

**Acceptance criteria:**
- [ ] `multi-perspective-review` 写清计划态 DevEx 边界
- [ ] `developer-experience-audit` 与其衔接清晰
- [ ] 不混淆实现前评审与实现后实测

**Verification:**
- [ ] `node apps/cli/dist/cli/index.js toolkit lint --json`
- [ ] `pnpm --dir packages/toolkit test`

**Dependencies:** Task 1, Task 8

**Files likely touched:**
- `packages/toolkit/src/content/skills/multi-perspective-review/meta.yaml`
- `packages/toolkit/src/content/skills/multi-perspective-review/body.md`

**Estimated scope:** Small

## Checkpoint: After Tasks 6-9

- [ ] 文档同步和 DevEx audit 闭环都已进入关系图
- [ ] 新增 skill 职责没有与既有 skill 重叠
- [ ] `toolkit lint` 通过

## Task 10: 加强原则层与验证门禁映射

**Description:** 调整 `engineering-principles`，补 `no uncontrolled drift after release`，并把原则落点映射到验证类 skill。

**Acceptance criteria:**
- [ ] `engineering-principles` 保持轻量
- [ ] 明确 5-6 条原则及其下游落点
- [ ] 关系图能看出原则层到验证层的影响

**Verification:**
- [ ] `node apps/cli/dist/cli/index.js toolkit lint --json`
- [ ] `pnpm --dir packages/toolkit test`

**Dependencies:** Task 1

**Files likely touched:**
- `packages/toolkit/src/content/skills/engineering-principles/meta.yaml`
- `packages/toolkit/src/content/skills/engineering-principles/body.md`

**Estimated scope:** Small

## Task 11: 增强 verification / CI skill

**Description:** 强化 `verification-before-completion` 与 `ci-cd-and-automation`，吸收 evidence-first、minimal gates、release drift control 等内容。

**Acceptance criteria:**
- [ ] `verification-before-completion` 强化 fresh evidence、二次核验、声明粒度规则
- [ ] `ci-cd-and-automation` 强化最小可维护门禁和发布后 drift 校验
- [ ] 两者都显式接入 `engineering-principles`

**Verification:**
- [ ] `node apps/cli/dist/cli/index.js toolkit lint --json`
- [ ] `pnpm --dir packages/toolkit test`

**Dependencies:** Task 1, Task 10

**Files likely touched:**
- `packages/toolkit/src/content/skills/verification-before-completion/meta.yaml`
- `packages/toolkit/src/content/skills/verification-before-completion/body.md`
- `packages/toolkit/src/content/skills/ci-cd-and-automation/meta.yaml`
- `packages/toolkit/src/content/skills/ci-cd-and-automation/body.md`

**Estimated scope:** Medium

## Task 12: 增强 browser QA / context skill

**Description:** 强化 `browser-qa-testing` 与 `context-engineering`，把“证据、最小关键路径、谨慎推进、精确装载上下文”写成明确方法。

**Acceptance criteria:**
- [ ] `browser-qa-testing` 明确最小关键路径、失败回归和证据化原则
- [ ] `context-engineering` 明确复杂任务先校准、最小充分上下文、避免上下文漂移
- [ ] 两者都显式接入 `engineering-principles`

**Verification:**
- [ ] `node apps/cli/dist/cli/index.js toolkit lint --json`
- [ ] `pnpm --dir packages/toolkit test`

**Dependencies:** Task 1, Task 10

**Files likely touched:**
- `packages/toolkit/src/content/skills/browser-qa-testing/meta.yaml`
- `packages/toolkit/src/content/skills/browser-qa-testing/body.md`
- `packages/toolkit/src/content/skills/context-engineering/meta.yaml`
- `packages/toolkit/src/content/skills/context-engineering/body.md`

**Estimated scope:** Medium

## Task 13: 统一关系图并完成总验证

**Description:** 对所有新增/增强资产统一做关系图收口、lint、tests 和根级验证，确保没有闭环漂移和来源失真。

**Acceptance criteria:**
- [ ] `toolkit lint` 为 0 warnings / 0 errors
- [ ] `packages/toolkit` tests 通过
- [ ] `apps/cli toolkit` tests 通过
- [ ] `pnpm verify` 通过
- [ ] 文档口径与实现一致

**Verification:**
- [ ] `node apps/cli/dist/cli/index.js toolkit lint --json`
- [ ] `pnpm --dir packages/toolkit test`
- [ ] `pnpm --dir apps/cli test -- src/cli/__tests__/toolkit.test.ts`
- [ ] `pnpm verify`

**Dependencies:** Tasks 2-12

**Files likely touched:**
- `packages/toolkit/src/content/**/meta.yaml`
- `packages/toolkit/src/content/**/body.md`
- `docs/architecture/toolkit-upstream-content-refresh.md`

**Estimated scope:** Medium

## Multi-Agent Execution Plan

### Wave 1: Serial Contract

- Task 1

### Wave 2: Parallel Implementation

- Agent A: Tasks 2-3
- Agent B: Tasks 4-5
- Agent C: Tasks 6-7
- Agent D: Tasks 8-9
- Agent E: Tasks 10-12

说明：

- Wave 2 之前必须先完成 Task 1
- Wave 2 各 lane 写入面已尽量隔离
- Task 13 由主线串行收口

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 新增 skill 与既有 skill 职责重叠 | High | 先做 Task 1，写死边界后再实现 |
| 多 agent 并发导致关系图互相覆盖 | High | 严格按 lane 写入面隔离，关系图统一在 Task 13 收口 |
| `engineering-principles` 膨胀成方法大全 | Medium | 只保留母原则和落点，不复制下游正文 |
| 文档同步 skill 与发布 skill 重复 | Medium | `release-documentation-sync` 保持轻量，`shipping-and-launch` 只保留 gate |
| DevEx 计划态/实测态混淆 | Medium | `multi-perspective-review` 与 `developer-experience-audit` 相位明确分离 |
| Workstream A 被 team-specific 细节绑死 | Medium | `branch-finish-and-cleanup` 先定义通用规则，再回写 team/git/parallel 内容 |

## Open Questions

- `release-documentation-sync` 是否最终需要配一个轻量 command 入口，还是先只做 skill？
- `developer-experience-audit` 是否需要在后续阶段再接 `codebase-onboarding` 和 `browser-qa-testing` 的更多显式连边？
