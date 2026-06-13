# SDD + TDD 开发工作流

## 角色定位

这是完整交付的编排 skill，不是每个阶段的详细教程。它负责把需求按阶段推进，并在进入具体阶段时再读取对应专项 skill。

渐进式披露规则：

- 当前只需要路由和门控时，只读取本文。
- 进入某个阶段时，再加载该阶段 skill。
- 不把所有阶段规则同时塞进上下文。
- 发现任务变成 bug、文档、发布或上下文问题时，切换到对应入口，不继续硬走完整流程。

## 快速路径

1. 判断任务是否需要完整交付；简单修复、文档或调查任务不要套完整流程。
2. 若需求模糊，先进入 `brainstorming-and-design` 或 `spec-driven-development`。
3. 若规格清楚，进入 `planning-and-task-breakdown`。
4. 计划确认后，进入 `incremental-implementation` + `test-driven-development`。
5. 实现完成后，进入 `code-review-and-quality`。
6. 准备声明完成前，进入 `verification-before-completion`。
7. 需要提交时，进入 `git-workflow-and-versioning`，并等待用户确认。
8. 周期结束或需要沉淀经验时，进入 `sprint-retrospective`。

## 阶段门控

| 阶段 | 默认入口 | 通过条件 |
|---|---|---|
| Brainstorm（可选） | `brainstorming-and-design` | 目标、约束、方案方向已收敛 |
| Specify | `spec-driven-development` | 规格可测试，假设已显式列出 |
| Plan | `planning-and-task-breakdown` | 任务有依赖、文件边界和验证方式 |
| Plan Review（可选） | `multi-perspective-review` | `GO / REVISE / NO-GO` 结论明确 |
| Build | `incremental-implementation` + `test-driven-development` | 每个切片实现、测试、回归通过 |
| Review | `code-review-and-quality` | Critical/Important 已处理或有明确延后理由 |
| Verify | `verification-before-completion` | 新鲜验证命令通过，输出已读 |
| Commit（可选） | `git-workflow-and-versioning` | 用户确认提交范围和消息 |
| Retro（可选） | `sprint-retrospective` | 偏差、复盘和行动项已记录 |

## 构建模式选择

进入 Build 前先选择执行模式，而不是直接默认手动实现。复杂任务先评估 `Readonly Consult`，用低风险只读审查发现路线、测试、安全、性能或平台适配问题，再决定是否需要更重的写入型并行：

- **Manual**：简单任务、小修复或同一文件内紧耦合改动，主线程直接实现。
- **Readonly Consult**：复杂任务需要架构、测试、安全、性能、产品、上游吸收、Codex 适配、安装/更新或审查侧评；只有用户已授权本会话或项目默认启用只读 agent 时，才可通知式启动，不改文件。
- **Serial Subagent**：已有计划，任务彼此独立但有依赖顺序；使用 `subagent-driven-development` 串行委派。
- **Context Fan-Out**：任务可以按文件、模块或证据问题并行，且有清晰文件所有权和 fan-in gate；使用 `parallel-agent-dispatch`。低风险写入 fan-out 在计划已接受时可通知式启动，高风险或边界不清时仍必须确认。
- **Team Orchestration**：需要 tmux + git worktree 文件系统隔离、长时间多 worker 或 Codex / Qwen 多 CLI 协作；使用 `team-orchestration`，必须用户明确要求或确认。
- **Context Steward Sidecar**：如果本轮会改变模块结构、验证命令、上下文索引或长期项目约定，派 `agent:context-steward` 维护上下文；主线程继续实现，它在自有边界内 scoped_write，fan-in 时交付写入证据。

主线程是 controller / integrator：

- 主线程负责目标、计划、分派、文件所有权、stop gate、fan-in 和最终验证。
- 只读 agent 只汇报结构化结论，不改文件。
- 写入 agent 只处理被分配的任务和文件，并返回修改文件、验证结果、风险和待 fan-in 项。
- 写入型 agent 不共享文件所有权；无法划清所有权时降级为 Manual 或 Serial Subagent。
- 写入型并行的放松只适用于已接受计划中的低风险切片；涉及生产、敏感数据、破坏性操作、同文件修改或超过 2 个 worker 时仍走显式确认。
- 审查 agent 默认只读；提出 finding 后负责回归确认。
- context steward 默认 scoped_write；只要写入限制在 `.codex/context/**` 和 `AGENTS.md` managed block，就可以直接维护项目上下文。发生同文件冲突、需要改用户手写规则或越过项目上下文边界时，必须停在 fan-in。
- 主线程可以处理小任务、集成冲突、最终修补和验证失败分析，但在已经选择多 agent 模式后，不抢占已分配给 worker 的任务。

进入任一多 agent 模式前，必须有 bounded loop contract：

- `loop_budget`：每个 task、worker、review finding 或验证失败最多几轮。
- `stop condition`：同类失败重复、两轮无法关闭同一 finding、同文件冲突、agent 状态不明或验证方式缺失时停止。
- `degraded path`：只读 agent 不可用时主线程复核；写入 worker 失败时缩小任务或改串行；`zc team` 不满足启动条件时回到 Context Fan-Out 或 Manual。
- `fan-in evidence`：所有 agent 状态、修改文件、验证结果、finding fingerprint、回归结论、context stewardship 报告和最终验证命令。

推荐提示格式：

```text
Recommendation: 按 Manual / Readonly Consult / Serial Subagent / Context Fan-Out / Team 模式推进 because <证据与 trade-off>。
- agent_opportunity:
- 只读协助:
- 写入边界:
- fan-in 验证:
- loop_budget:
- 是否需要确认:
```

## 审查与回归闭环

多 agent 任务必须遵循闭环所有权：

```text
producer owns fix
reviewer owns regression
controller owns fan-in
```

- 实现方或产生方负责优先修复自己引入的问题。
- 审查方或提出方负责给出复现条件、断言、期望行为、风险等级，并在修复后复验原 finding。
- 主线程负责判断 finding 是否成立、优先级是否阻塞、是否转派、是否接受结果。
- 实现方两次修不好时，主线程可以缩小问题后转给更合适的 agent 或自己接手。
- 审查方默认不直接修；机械小修或用户明确要求时，主线程可以把 finding 转成修复任务。

审查等级：

- `light review`：实现方自审 + 主线程检查。
- `standard review`：实现方自审 + 独立 reviewer + 提出方回归。
- `strict review`：规格审查 + 代码质量审查 + 测试 / 安全 / 性能按风险加入。

中等以上任务默认 `standard review`，高风险任务默认 `strict review`。

## 阶段切换纪律

- 进入新阶段前，说明当前阶段已满足的证据。
- 阶段中发现前提失真时，回退到上游阶段，不继续堆实现。
- 长会话变慢或内容开始混乱时，切到 `context-budget-audit` / `context-engineering`。
- 变更涉及浏览器体验时，在单元/API 测试之外补 `browser-qa-testing`。
- 涉及高风险命令、生产数据或敏感文件时，先切到 `safety-guardrails`。

## 停线条件

立即停止当前阶段并重新定位：

- 测试、构建或 lint 失败但原因未读清。
- 用户纠正了需求、范围或安全边界。
- 计划要求修改的文件和实际代码结构明显不一致。
- 出现破坏性操作、凭据、生产数据或不可逆迁移风险。
- 需要并行但没有文件所有权、隔离策略和 fan-in 验证。
- review finding 未闭环，或提出方尚未完成回归确认。

## 输出契约

完整交付过程中的关键结论都要使用可审查的推荐格式：

```text
Recommendation: <下一步动作> because <具体证据、取舍和被放弃的替代方案>。
```

不要只说“更稳”“更好”“建议继续”。必须说明为什么这个动作优于至少一个替代方案，以及如何验证它成立。

## 验证

声明完成前至少给出：

- 实际运行的验证命令
- 退出结果
- 与本次任务相关的关键输出
- 未运行的验证及原因

不能用历史结果、主观判断或“应该没问题”替代验证证据。
