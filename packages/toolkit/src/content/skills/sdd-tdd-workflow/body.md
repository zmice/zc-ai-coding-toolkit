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

- **Manual（默认）**：你自己按任务串行实现。适合大多数改动。
- **Subagent-Driven**：任务彼此独立，但用户没有要求并行时，可作为串行委派建议。
- **Parallel**：用户明确要求多 agent / 并行 / team 模式，且任务有清晰文件所有权时，使用 `parallel-agent-dispatch`。
- **Team Orchestration**：需要 tmux + git worktree 文件系统隔离或多 CLI worker 时，使用 `team-orchestration`。

除非用户已经明确要求并行，否则只给并行建议，不直接启动子代理或 `zc team`。

推荐提示格式：

```text
Recommendation: 按 Manual / Parallel / Team 模式推进 because <证据与 trade-off>。
- 并行收益：
- 并行代价：
- 文件所有权：
- fan-in 验证：
```

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
