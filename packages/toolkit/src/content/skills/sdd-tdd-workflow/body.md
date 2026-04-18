# SDD + TDD 开发工作流

## 概览

这个技能编排完整的 Spec-Driven Development + Test-Driven Development 生命周期。所有非平凡开发任务都要经过带门控的阶段，前一阶段未验证，后一阶段不能前进。

```
[/idea] ──→ [brainstorm] ──→ /spec ──→ /task-plan ──→ /build ──→ /quality-review ──→ /commit ──→ /retro
 (optional)   (optional)       │          │            │          │                    │          │
                               ▼          ▼            ▼          ▼                    ▼          ▼
                            Specify    Plan        Build+TDD   Review              Commit     Reflect
                            (SDD)    (Tasks)      (Red→Green   (5-axis            (User      (Retro
                                                   →Refactor)   quality)          confirm)    +Learn)

 Build modes:  Manual (default) or Subagent-Driven (for independent tasks)
 On-demand:    /debug /ctx-health /verify /onboard /simplify /perf /secure
               /api /doc /ship /ci /commit /migrate /ui /idea /careful /freeze /guard /qa /plan-review
```

完整 Sprint 生命周期（v2）:

```
/spec → /plan-review → /task-plan → /build → /quality-review → /commit → /retro
  |         |              |           |            |              |          |
  v         v              v           v            v              v          v
Specify  Multi-View     Plan      Build+TDD     5-Axis        Commit      Retro
(SDD)    Review       (Tasks)   (Red→Green    Review       (User       (Reflect
                                 →Refactor)               confirm)     +Learn)
```

## 命令

| Command | Phase | What It Does |
|---------|-------|-------------|
| `/sdd-tdd` | Full workflow | 按顺序执行全部阶段，并带门控 |
| `/spec` | Phase 1 | 在写任何代码前先写规格 |
| `/task-plan` | Phase 2 | 把规格拆成可验证任务 |
| `/build` | Phase 3 | 用严格 TDD（Red-Green-Refactor）实现 |
| `/quality-review` | Phase 4 | 合并前做五轴代码审查 |
| `/debug` | On-demand | 系统化根因调试（Stop-the-Line） |
| `/ctx-health` | On-demand | 长会话中的上下文管理 |
| `/simplify` | On-demand | 代码简化，降低复杂度，保持行为不变 |
| `/perf` | On-demand | 性能优化，先测量，再优化 |
| `/secure` | On-demand | 安全加固，遵循 OWASP Top 10 和输入验证 |
| `/api` | On-demand | API 与接口设计，先定契约，错误一致 |
| `/doc` | On-demand | 文档与 ADR，记录决策，而不只是代码 |
| `/ship` | On-demand | 发布与上线，预发布检查、分阶段放量 |
| `/ci` | On-demand | CI/CD 管道搭建与优化，质量门禁配置 |
| `/commit` | Phase 5 | 审查通过后代理提交，需用户确认（follow `git-workflow-and-versioning`） |
| `/migrate` | On-demand | 废弃与迁移，strangler 模式，安全下线 |
| `/ui` | On-demand | 前端 UI 工程，组件模式与可访问性 |
| `/idea` | On-demand | 想法细化，把模糊想法变成可执行规格 |
| `/verify` | On-demand | 完成前验证，证据先于断言 |
| `/onboard` | On-demand | 代码库 onboarding，系统化理解新项目 |
| `/retro` | Phase 6 | Sprint 回顾，统计产出和改进项 |
| `/learn` | On-demand | 手动触发会话模式提取与学习 |
| `/careful` | On-demand | 激活危险命令预警模式 |
| `/freeze` | On-demand | 锁定指定目录/文件，禁止编辑 |
| `/guard` | On-demand | 同时激活 careful + freeze 的全面防护 |
| `/qa` | On-demand | 执行浏览器 QA 测试 |
| `/plan-review` | Phase 1→2 | 多视角计划评审（产品/工程/设计/DevEx） |

## 第 0 阶段（可选）：Brainstorm

当需求模糊或存在多个方案时，在写正式规格前先使用 `brainstorming-and-design` 技能：

1. **探索项目上下文** - 检查文件、文档、近期提交
2. **提出澄清问题** - 一次问一个，理解目标与约束
3. **给出 2-3 个方案** - 说明权衡并给出推荐
4. **展示设计** - 分段呈现，等待用户批准
5. **门控：** 人类批准设计后，再进入 spec

如果需求已经清晰明确，可以跳过此阶段。

## 第 1 阶段：Specify (`/spec`)

遵循 `spec-driven-development` 技能。关键动作：

1. **显式列出假设** - 把所有假设明确写出来，并请求确认
2. **编写规格**，覆盖：目标、技术栈、命令、项目结构、代码风格、测试策略、边界
3. **把模糊需求重写为具体、可测试的成功标准**
4. **门控：** 人类审阅并批准 spec 后，才能进入下一阶段

```
ASSUMPTIONS I'M MAKING:
1. [assumption about requirements]
2. [assumption about tech stack]
3. [assumption about scope]
→ Correct me now or I'll proceed with these.
```

**输出：** 保存到仓库中的一个 spec 文档。

## 第 2 阶段：Plan (`/task-plan`)

遵循 `planning-and-task-breakdown` 技能。关键动作：

1. **只读模式** - 分析 spec 和代码库，不要写代码
2. **映射依赖图** - 识别谁依赖谁
3. **纵向切片** - 每个任务交付一条可工作的、可测试的功能路径
4. **写任务**，包含验收标准、验证步骤和文件预估
5. **门控：** 人类审阅并批准计划后，才能进入下一阶段

**任务大小规则：** 单个任务不要触达超过约 5 个文件。XL 任务必须继续拆分。

**输出：** 一份带有排序任务和检查点的计划文档。

## 第 3 阶段：Build (`/build`)

同时遵循 `incremental-implementation` 与 `test-driven-development` 技能。

### 每个变更的强制 TDD 循环

```
RED ──→ GREEN ──→ REFACTOR ──→ (repeat)
 │         │          │
 ▼         ▼          ▼
Write    Write      Clean up
failing  minimal    while tests
test     code       still pass
```

**构建模式：**

- **Manual（默认）：** 你直接逐个实现任务
- **Subagent-Driven：** 当任务彼此独立时，使用 `subagent-driven-development` 为每个任务派一个新子代理，并做两阶段审查（spec 合规 → 代码质量）
- **Parallel：** 当任务彼此独立且数量 >2 时，使用 `parallel-agent-dispatch` 并行执行
- **Cascade：** 当任务是分层依赖时，使用 `parallel-agent-dispatch` 的 Cascade 模式，在每层内并行、层与层之间串行，并在每层做门控验证

**构建规则：**
1. **永远先写测试。** 在任何实现代码之前，先写一个会失败的测试
2. **一次只做一片。** 实现 → 测试 → 验证 → 提交 → 下一个切片
3. **保持可编译。** 每次增量后，构建和测试都必须通过
4. **简单优先。** 先问“最简单可行的方案是什么？”
5. **范围纪律。** 只做任务要求的事，不做额外支线
6. **Git 纪律。** 每个切片一个原子提交，提交信息清晰（遵循 `git-workflow-and-versioning`）
7. **先验证，再说完成。** 遵循 `verification-before-completion` —— 先跑命令，读输出，再下结论（见 `/verify`）

**Bug 修复使用 Prove-It 模式：**
```
Bug reported → Write reproduction test (FAILS) → Fix code → Test PASSES → Run full suite
```

**质量检查点：** 每完成 3-5 个任务，触发一次 mini `/quality-review`，尽早发现偏差。

**门控：** 所有测试通过、构建成功、每个切片都已提交。运行 `/verify` 用证据确认。

**上下文预算检查：** 如果会话变长，运行 `context-budget-audit` 评估上下文余量再继续。

## 第 4 阶段：Review (`/quality-review`)

遵循 `code-review-and-quality` 技能。五轴审查：

1. **Correctness** - 是否符合 spec？边界情况处理了吗？
2. **Readability** - 命名清晰、逻辑直白、没有花活？
3. **Architecture** - 是否遵循现有模式？边界是否清晰？
4. **Security** - 输入是否验证？有没有 secrets？
5. **Performance** - 有没有 N+1？有没有无界操作？

**门控：** 所有 Critical/Important 问题都要解决后才能合并。

## 第 5 阶段：Commit (`/commit`)

遵循 `git-workflow-and-versioning` 技能。审查通过后，代理协助完成规范化提交：

1. **收集未提交变更** - 检查工作区中未暂存/未提交的变更
2. **原子性评估** - 判断是否需要拆成多个原子提交
3. **提交前检查** - 无密钥泄露、测试通过、Lint 通过、类型检查通过
4. **生成提交消息** - `<type>: <中文简述>` 格式，说明“为什么”
5. **展示摘要并等待确认** - 向用户展示变更摘要和提交消息，**等待用户确认后才执行 `git commit`**

```
READY TO COMMIT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Commit message: <type>: <简述>

Changes:
- [file]: [what changed]

Pre-checks: ✅ Tests | ✅ Lint | ✅ No secrets
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ Confirm to commit, or request changes.
```

**门控：** 需要用户确认后才能继续执行提交。

## 第 6 阶段：Reflect (`/retro`)

遵循 `sprint-retrospective` 技能。关键动作：

1. **收集数据** - git 统计、测试覆盖率变化、LOC 指标
2. **回顾结果** - 哪些做得好，哪些没做好，关键决策是什么
3. **检查 spec 偏差** - 对比最终交付与原始 spec
4. **评估流程健康度** - TDD 合规性、验证通过率、审查通过率
5. **生成行动项** - 具体改进项，明确负责人和截止时间
6. **沉淀学习** - 记录本次周期的经验
7. **提炼 instincts** - 运行 `/learn`，把可复用模式提炼成 instincts；高置信度 instincts 自动同步到 Agent Memory，跨会话持久化

**门控：** 在开始下一轮 sprint 之前，行动项必须被审阅并分配。

## 按需：Debug (`/debug`)

遵循 `debugging-and-error-recovery` 技能。遇到任何意外情况时使用。

**Stop-the-Line 规则：**
```
1. STOP adding features or making changes
2. PRESERVE evidence (error output, logs, repro steps)
3. DIAGNOSE using triage: Reproduce → Localize → Reduce → Fix → Guard
4. GUARD against recurrence with a regression test
5. RESUME only after full verification passes
```

**关键原则：** 修根因，不修表象。永远不要跳过失败测试去做新功能。

## 按需：Context Management (`/ctx-health`)

遵循 `context-engineering` 技能。用于维持长会话中的输出质量。

**使用场景：**
- 代理输出质量下降（错误模式、幻觉 API）
- 在代码库的不同部分之间切换
- 在长会话里开始新任务

**上下文层级（从最持久到最短暂）：**
```
1. Rules Files        ← Always loaded, project-wide
2. Spec / Architecture ← Loaded per feature/session
3. Relevant Source     ← Loaded per task
4. Error Output        ← Loaded per iteration
5. Conversation History ← Accumulates, compacts
```

## 长会话保活协议

为了维持长时间开发会话中的质量：

### 每完成一个任务后，输出结构化摘要：

```
TASK COMPLETE: [Task N - Title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Changes made:
- [file]: [what changed]
- [file]: [what changed]

Tests: [X passed, Y added]
Build: [clean/warnings]

Decisions made:
- [key decision and rationale]

Next task: [Task N+1 - Title]
Dependencies satisfied: [yes/no]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 在开始每个新任务前，重载上下文：

```
CONTEXT RELOAD for Task [N]:
- Spec section: [relevant section]
- Files to modify: [list]
- Pattern to follow: [existing example in codebase]
- Constraints: [from spec boundaries]
```

### 质量检查点：

每完成 3-5 个任务，执行一次 mini review：
```
QUALITY CHECKPOINT after Tasks [X-Y]:
- [ ] All tests still pass (full suite)
- [ ] Build is clean
- [ ] No accumulated tech debt or shortcuts
- [ ] Spec compliance verified
- [ ] No scope creep beyond plan
→ Issues found? Address before continuing.
```

## 完整工作流 (`/sdd-tdd`)

当该命令被触发时，按顺序执行全部 6 个阶段，并设置明确门控：

```
1. /spec        → Write and validate spec              → [Human approves]
2. /plan-review → Multi-view review (optional)         → [Human approves]
3. /task-plan   → Break into tasks                     → [Human approves]
4. /build       → Implement each task with TDD         → [Tests pass per slice]
   ├── After every 3-5 tasks: Quality Checkpoint
   └── On any failure: /debug (Stop-the-Line)
5. /quality-review → Five-axis review                   → [All issues resolved]
6. /commit      → Agent-assisted commit (user confirms) → [Human confirms]
7. /retro       → Sprint retrospective                 → [Action items assigned]
```

在每个门口，**必须停下来等待人类确认**，然后才能继续。

## 不要在以下场景使用完整工作流

- **单行修复 / 拼写修正：** 直接修复即可
- **纯配置变更：** 没有行为影响，不需要 TDD
- **纯文档更新：** 不需要 spec

这类情况使用单独命令即可（小改动可用 `/build`，任何变更都可用 `/quality-review`）。

## 核心行为（始终有效）

1. **显式暴露假设** - 永远不要悄悄补全歧义
2. **管理困惑** - 遇到不一致时立即停下，先问再继续
3. **明确反对** - 直接指出问题，并给出替代方案
4. **强制简洁** - 如果 100 行就够，1000 行就是失败
5. **验证，不要臆测** - 每个阶段都有验证步骤；“感觉对了”不算完成
6. **范围纪律** - 只做任务要求的事；注意到但不要顺手修无关问题
7. **上下文意识** - 切换任务时重载相关上下文，并在边界处总结进展

## 按需技能（扩展工具箱）

| Command | Skill | When to Use |
|---------|-------|------------|
| `/simplify` | code-simplification | 代码能工作，但比应有的复杂，想做清晰化重构 |
| `/perf` | performance-optimization | 有性能要求、用户反馈慢、或需要 Core Web Vitals |
| `/secure` | security-and-hardening | 处理用户输入、认证、数据存储或外部集成 |
| `/api` | api-and-interface-design | 设计新 API、模块边界或组件接口 |
| `/doc` | documentation-and-adrs | 做架构决策、改公共 API、记录未来所需上下文 |
| `/ship` | shipping-and-launch | 准备上线，做发布前检查、灰度和回滚策略 |
| `/ci` | ci-cd-and-automation | 搭建或优化 CI/CD 管道，配置质量门禁、部署策略、CI 失败反馈循环 |
| `/commit` | git-workflow-and-versioning | 审查通过后代理提交，需用户确认；原子提交、描述性消息、提交前检查 |
| `/migrate` | deprecation-and-migration | 替换旧系统、下线功能或删除死代码 |
| `/ui` | frontend-ui-engineering | 构建 UI 组件、处理可访问性和响应式设计 |
| `/idea` | idea-refine | 把模糊想法转成可执行规格 |
| `/verify` | verification-before-completion | 在声称完成之前，先拿证据而不是断言 |
| `/onboard` | codebase-onboarding | 进入陌生代码库时，系统化理解项目 |
| `/careful` | safety-guardrails | 操作生产环境或关键基础设施，需要预防破坏性误操作 |
| `/freeze` | safety-guardrails | 需要锁定关键文件/目录，防止意外修改 |
| `/guard` | safety-guardrails | 组合防护模式，同时激活预警和锁定 |
| `/qa` | browser-qa-testing | 前端开发完成后，需要真实浏览器 QA 验证 |
| `/plan-review` | multi-perspective-review | Spec/Plan 完成后，需要多视角评审发现盲点 |
| `/retro` | sprint-retrospective | Sprint/开发周期结束后，回顾总结和持续改进 |
| `/learn` | continuous-learning | 手动触发会话模式提取，生成 instincts 并持久化到 Memory |

这些命令是按需触发的，不需要完整 SDD-TDD 门控流程。

## 子代理技能（高级）

| Skill | When to Use |
|-------|------------|
| `subagent-driven-development` | 用于执行可独立的计划任务 - 每个任务派一个新子代理，并做两阶段审查 |
| `parallel-agent-dispatch` | 多个彼此独立、可并行的任务 - fan-out/fan-in 模式、Worktree 隔离或 Cascade 分层执行 |
| `brainstorming-and-design` | 当需求模糊、需要在 spec 前先做协作式设计探索时使用 |
| `context-budget-audit` | 会话开始变慢，或者加了更多组件后，用于量化上下文开销 |

## 红旗

- 在写 spec 之前就开始写代码
- 为了“省时间”而跳过测试
- 没有实现却第一次运行就通过的测试
- 未提交变更越积越多
- “我最后再测”
- 实现了 spec 里没写的功能
- 代理输出质量下降却不重载上下文
- 出问题后继续往前推，而不是停下来调试
- 长会话中没有任务间的结构化摘要
- 没有测量就做优化
- 把安全当成事后补丁
- 没有采用 contract-first 的 API 设计
- 没有跑验证命令就声称“完成”
- 相信子代理的成功报告，却不做独立验证
- 多个并行任务修改了同一批文件
- 开发周期结束时跳过 `/learn`（错过学习机会）
- Cascade 模式没有层级门控验证
