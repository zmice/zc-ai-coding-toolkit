# Toolkit Upstream Content Refresh

## Objective

在不破坏当前 `toolkit` canonical source model、来源追溯规则和平台生成链路的前提下，基于已登记 upstream 的近期内容演进，系统评估并更新本仓库内容层。

本轮优化的目标不是扩大资产数量，而是补齐当前内容系统仍然偏弱的闭环：

1. 补足 workflow 在“评审后响应、分支/工作树收尾、发布后文档同步、开发者体验实测”上的内容空缺
2. 把 upstream 最近新增的高价值方法入口，转译成适合本仓库的 skill / command / agent 内容增强
3. 保持 `toolkit` 的高治理密度，不把仓库重新做成“上游命令表镜像”

## Scope

本轮只覆盖 `packages/toolkit/src/content/**` 及其长期文档说明。

重点评估并优化：

- `skills`
- `commands`
- `agents`
- 相关 `docs/architecture/**` 中的长期内容治理说明

不在本轮范围内：

- 新 CLI 子命令设计
- 平台生成逻辑改造
- `references` 自动同步策略改造
- 重新设计 `toolkit` schema

## Upstream Inputs

当前活跃参考 upstream：

- `agent-skills`
- `superpowers`
- `everything-claude-code`
- `gstack`
- `andrej-karpathy-skills`

本轮只吸收“方法、角色、闭环和原则”，不直接镜像目录结构或整段提示词。

### Expected Value By Upstream

#### `agent-skills`

继续作为主 workflow 骨架来源。

关注点：

- 生命周期一致性
- 命令到 skill 的入口映射
- 浏览器验证和质量门禁的结构化表达

#### `superpowers`

关注点：

- `review` 前后两个阶段的闭环
- `using-git-worktrees`
- `receiving-code-review`
- `finishing-a-development-branch`

本轮优先吸收其“评审后如何处理、分支如何收尾”的方法，而不是扩展命令数量。

#### `everything-claude-code`

关注点：

- eval-driven quality 思路
- workflow ergonomics
- 质量门禁解释层

本轮优先吸收到现有验证类内容中，不新建大型技能包。

#### `gstack`

关注点：

- `document-release`
- `plan-devex-review`
- `devex-review`
- 更产品化的角色入口

本轮优先吸收“文档同步”和“DevEx 从计划评审到真实走查”的闭环。

#### `andrej-karpathy-skills`

关注点：

- caution over speed
- simplicity first
- goal-driven execution
- 任务边界和最小变更原则

本轮优先加强原则层向现有技能正文的反向渗透，而不是新增大量原则型资产。

## Current Baseline

当前本地基线：

- 资产总数：`69`
- 内容 lint：`0 warnings / 0 errors`
- 已具备：
  - 来源追溯
  - 关系图
  - 中文显示层
  - 查询与推荐
  - 核心 workflow 内容骨架

当前真正的内容缺口主要有四类：

1. **Review closure 不完整**
   - 已有 review 和 verify
   - 缺少“收到 review 反馈后如何分类、修复、回归验证、再提交”的显式内容单元

2. **Branch / worktree closure 不完整**
   - 已有 `git-workflow-and-versioning`、`parallel-agent-dispatch`、`team-orchestration`
   - 但缺少专门描述“任务完成后如何 merge / PR / keep / discard / cleanup”的收尾内容

3. **Document-release drift 闭环不足**
   - 已有 `documentation-and-adrs` 和 `shipping-and-launch`
   - 但“发布后哪些文档应同步更新、如何检查 drift”仍偏薄

4. **DevEx live audit 缺位**
   - 已有 `multi-perspective-review` 的 DevEx 视角
   - 缺少实现后从 onboarding、安装、docs、首次成功路径出发的真实开发者体验审计

## Proposed Content Workstreams

### Workstream A: Review And Branch Closure

目标：补齐“计划 -> 实现 -> 审查 -> 响应 -> 收尾”的内容闭环。

建议动作：

- 新增或拆出一个专门处理 review 响应的 skill
  - 暂定方向：`review-response-and-resolution`
- 新增或拆出一个专门处理分支/worktree 收尾的 skill
  - 暂定方向：`branch-finish-and-cleanup`
- 将其与现有内容显式连边：
  - `code-review-and-quality`
  - `git-workflow-and-versioning`
  - `parallel-agent-dispatch`
  - `team-orchestration`

吸收来源：

- `superpowers`
- `gstack`

### Workstream B: Documentation Drift Closure

目标：把“代码已完成”扩展到“文档已同步”。

建议动作：

- 强化 `documentation-and-adrs`
- 强化 `shipping-and-launch`
- 明确发布后文档同步清单：
  - README
  - 架构说明
  - 使用说明
  - 平台安装说明
  - 关键行为变更记录

如有必要，可新增轻量 skill：

- 暂定方向：`release-documentation-sync`

吸收来源：

- `gstack`
- `everything-claude-code`

### Workstream C: DevEx Audit Closure

目标：补上开发者体验从“计划评审”到“真实实测”的闭环。

建议动作：

- 保留 `multi-perspective-review` 作为计划态评审
- 新增一个实现后 DevEx 审计 skill
  - 暂定方向：`developer-experience-audit`
- 覆盖内容：
  - getting started 是否顺畅
  - 安装链是否清晰
  - CLI 首次成功路径是否明确
  - 文档是否支持新用户完成最小成功路径

吸收来源：

- `gstack`

### Workstream D: Verification And Principle Reinforcement

目标：把 upstream 的最新质量观念回灌到现有 skill，而不是平铺更多资产。

建议动作：

- 强化：
  - `verification-before-completion`
  - `ci-cd-and-automation`
  - `browser-qa-testing`
  - `context-engineering`
- 强化 `engineering-principles` 与下游 skill 的显式关系
- 明确以下原则在正文中的落点：
  - evidence before claims
  - caution over speed on non-trivial work
  - simplicity first
  - surgical changes
  - no uncontrolled drift after release

吸收来源：

- `everything-claude-code`
- `andrej-karpathy-skills`

## Canonical Contract

本轮新增资产的 canonical contract 固定如下：

| Asset | Role | Source Strategy | Upstream Basis |
|------|------|-----------------|----------------|
| `review-response-and-resolution` | review 后处理闭环 | `inspired` | `superpowers` |
| `branch-finish-and-cleanup` | branch/worktree 收尾闭环 | `inspired` | `superpowers` |
| `release-documentation-sync` | 发布后文档同步收尾 | `inspired` | `gstack` |
| `developer-experience-audit` | 实现后 DevEx 实测审计 | `inspired` | `gstack` |

说明：

- 这四个资产都不是对单一上游对象的 1:1 改写
- `source.upstream` 使用最主要参考 upstream
- `source.strategy` 统一使用 `inspired`
- `source.notes` 必须说明吸收边界，避免伪造 `origin_*`

## Boundary Rules

### `review-response-and-resolution`

- 只负责 review 之后的响应、修复、回归验证和回复 reviewer
- 不替代 `code-review-and-quality` 本身
- 不承担 commit / branch cleanup 的职责

### `branch-finish-and-cleanup`

- 只负责 branch/worktree 的收尾判定和清理
- 必须保持通用，不绑定 `zc`、tmux 或单一并行模型
- 可以被 `git-workflow-and-versioning`、`parallel-agent-dispatch`、`team-orchestration` 共同引用

### `release-documentation-sync`

- 只负责发布后的文档同步与 drift closure
- 不替代 `documentation-and-adrs` 的“记录决策”职责
- 不替代 `shipping-and-launch` 的“发布 gate”职责

### `developer-experience-audit`

- 只负责实现后的真实 DevEx 审计
- 不替代 `multi-perspective-review` 的实现前评审
- 不膨胀成 onboarding、QA 或 release 的总集线器

## Principle Mapping Table

`engineering-principles` 在本轮按下表回灌到既有 skill：

| Principle | Target Skills |
|----------|---------------|
| `evidence before claims` | `verification-before-completion`, `ci-cd-and-automation`, `browser-qa-testing` |
| `caution over speed on non-trivial work` | `verification-before-completion`, `context-engineering` |
| `simplicity first` | `ci-cd-and-automation`, `browser-qa-testing`, `context-engineering` |
| `surgical changes` | `ci-cd-and-automation`, `context-engineering` |
| `goal-driven execution` | `verification-before-completion`, `context-engineering` |
| `no uncontrolled drift after release` | `ci-cd-and-automation`, `release-documentation-sync`, `shipping-and-launch` |

关系图规则：

- 原则层默认使用 `suggests`
- 只有当下游资产缺失该原则就无法成立时，才使用 `requires`
- 若新增连边会与既有 workflow 图形成循环，则原则映射保留在 `body.md` 的“原则落点/衔接”中，不强行进入 `meta.yaml`
- 本轮预计：
  - 新增 skill 对其上游闭环 skill 以 `suggests` 为主
  - `code-review-and-quality` -> `review-response-and-resolution` 使用 `suggests`
  - `git-workflow-and-versioning` / `parallel-agent-dispatch` / `team-orchestration` -> `branch-finish-and-cleanup` 使用 `suggests`
  - `documentation-and-adrs` / `shipping-and-launch` -> `release-documentation-sync` 使用 `suggests`
  - `multi-perspective-review` -> `developer-experience-audit` 使用 `suggests`
  - `engineering-principles` 的下游映射以正文落点表为主，仅在不会制造循环时才进入 `meta.yaml`

## Delivery Strategy

本轮按“先补闭环，再补表达”的顺序推进：

1. Review / Branch closure
2. Documentation drift closure
3. DevEx audit closure
4. Verification / principle reinforcement

原因：

- 这四项优先修的是当前系统缺失的闭环
- 它们比“再加更多命令或角色”更能提升整体质量
- 完成后再决定是否需要新增其他入口

## Commands

主要验证命令：

```bash
node apps/cli/dist/cli/index.js toolkit lint --json
node apps/cli/dist/cli/index.js toolkit manifest
pnpm --dir packages/toolkit test
pnpm --dir apps/cli test -- src/cli/__tests__/toolkit.test.ts
pnpm verify
```

辅助检查命令：

```bash
rg -n "source:|requires:|suggests:|origin_" packages/toolkit/src/content -g 'meta.yaml'
rg -n "文档|发布|审查|验证|DevEx|worktree|review" packages/toolkit/src/content -g 'body.md'
```

## Project Structure

本轮核心工作区：

```text
packages/toolkit/src/content/
  skills/
  commands/
  agents/

docs/architecture/
  toolkit-content-optimization.md
  toolkit-naming-and-source-identity.md
  toolkit-upstream-content-refresh.md

references/
  upstreams.yaml
  notes/
  snapshots/
```

## Code Style

内容层遵循当前仓库的内容写作风格：

- `title` 中文优先，简短可展示
- `meta.yaml` 负责治理信息
- `body.md` 负责执行步骤与成功标准
- 先写“何时使用 / 输入前提 / 执行步骤 / 成功标准 / 衔接”，避免散文化长文

示例：

```md
## 何时使用

- 任务已经通过审查，但收到明确反馈需要修正时

## 执行步骤

1. 将反馈分为 critical / important / optional
2. 先修阻塞项，再做回归验证
3. 记录偏差和影响面
```

## Testing Strategy

本轮以内容验证为主：

- 内容 lint 必须保持 `0 warnings / 0 errors`
- `toolkit` 测试确保查询、关系图和治理规则不回退
- `apps/cli` 测试确保 `show / search / recommend / lint` 输出仍稳定
- 根级 `pnpm verify` 作为最终门禁

## Boundaries

- Always:
  - 保持 `source` 映射准确
  - 只吸收 upstream 的方法和原则，不直接镜像结构
  - 所有新增内容必须进入关系图和 lint 规则
- Ask first:
  - 是否新增全新 command
  - 是否对现有高频 command 做 breaking rename
  - 是否把某个 upstream 角色直接等价成本地 agent
- Never:
  - 不为了“功能丰富”复制上游整个命令面
  - 不破坏 `toolkit` 现有 canonical source model
  - 不伪造 `origin_*` 字段来凑齐来源映射

## Success Criteria

- 本轮识别出的四类内容闭环至少有明确落地方案
- `toolkit` 对上游的吸收体现为“更完整的闭环”，而不是“更多的表面命令”
- 现有内容系统仍保持高治理密度和清晰边界
- 验证链保持通过：
  - `toolkit lint`
  - `packages/toolkit` tests
  - `apps/cli toolkit` tests
  - `pnpm verify`

## Open Questions

1. `review-response-and-resolution` 和 `branch-finish-and-cleanup` 应拆成两个 skill，还是先合并为一个收尾 skill？
2. `document-release` 更适合增强已有 `documentation-and-adrs` / `shipping-and-launch`，还是独立成新 skill？
3. `DevEx live audit` 是否先作为 `multi-perspective-review` 的后置补充，还是直接独立成 skill？
