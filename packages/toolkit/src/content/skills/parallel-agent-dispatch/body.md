# Parallel Agent Dispatch

## 角色定位

把彼此独立的任务做上下文级 fan-out，并在结束时做 fan-in、冲突检测和集成验证。只读 fan-out 只有在用户已授权本会话或项目默认启用只读 agent 时，才可通知式启动；写入型 fan-out 默认先确认文件所有权、验证命令和 fan-in gate。若用户已接受包含这些边界的计划，低风险写入 fan-out 可通知式启动。

这个 skill 不是默认加速器。能并行不等于应该并行；并行会增加 token、延迟、集成和验证成本。

## 快速路径

1. 读取计划，列出所有任务、依赖和预计触达文件。
2. 判断任务是否彼此独立，是否有清晰文件所有权。
3. 先考虑只读 fan-out，用它低风险验证任务独立性、风险点和回归策略。
4. 区分只读通知式 fan-out、低风险写入预授权 fan-out 和写入显式确认 fan-out。
5. 为每个 worker 分配唯一责任范围、允许读取或修改的边界和验证命令。
6. fan-out 执行，期间不让多个写入 worker 修改同一文件。
7. fan-in 汇总，检查 diff、冲突、接口一致性、review finding 和回归结果。
8. 执行 bounded loop：补交、修复、回归都有最大轮次和停线条件。
9. 如需维护上下文，派 `agent:context-steward` 作为 sidecar scoped_write；它只维护 `.codex/context/**` 和 `AGENTS.md` managed block，冲突或越界时停在 fan-in。
10. 记录验收 transcript：谁做了什么、谁拥有哪个任务和文件、谁提出了什么、谁修复了什么、谁回归了什么、证据是什么、还有什么风险。

## 使用条件

适用：

- 多个任务互不依赖。
- 每个任务能在独立上下文中完成。
- 写入任务的文件所有权可以提前划清，或只读任务有明确问题边界。
- fan-in 后有集成测试或人工审查门禁。

不适用：

- 任务依赖同一个未完成设计。
- 多个任务必须改同一文件。
- 缺少测试或集成验证方式。
- 写入型并行没有显式确认，也没有已接受计划中的预授权边界。

## 模式选择

| 模式 | 适用场景 | 代价 |
|---|---|---|
| Readonly Consult | 多个只读 agent 分别评估架构、测试、安全、性能、产品、上游吸收、Codex 适配、安装/更新或 review 风险 | 需要主线程判断哪些结论成立 |
| Context Fan-Out | 只需要多个子代理分别分析或修改互不重叠文件 | 共享同一 worktree，fan-in 需谨慎检查 |
| Worktree Parallel | 任务可能触及相邻区域，或需要独立构建环境 | 需要分支和 worktree 清理 |
| Cascade | 任务有层级依赖，但每层内可并行 | 每层都要验证后再进下一层 |
| Team Orchestration | 需要 tmux + git worktree + 多 CLI worker | 运行时成本最高，需 `zc team` 收尾 |

如果需要文件系统级隔离，切到 `team-orchestration`；不要在本 skill 内展开完整 `zc team` 教程。

## 通知与授权

只读 fan-out 在已授权时使用通知式提示：

```text
Agent assist:
- <agent>：只读评估 <范围>，不改文件
fan-in：主线程汇总结论后再决定是否改代码
```

如果当前会话或项目没有只读 agent 默认授权，只输出上面的 `Agent assist` 预告并等待确认。

写入型 fan-out 启动前必须让用户看到这段信息的等价内容。若这些信息已经在本轮已接受计划中出现，可通知式启动，不必重复等待确认：

```text
Agent assist:
- worker 数：
- 文件所有权：
- fan-in 验证：
- 启动条件：已接受计划中的低风险写入 fan-out
```

没有预授权边界时，必须改用显式确认：

```text
Recommendation: 开启 <模式> because <并行收益> outweighs <集成代价>。
- worker 数：
- 文件所有权：
- 不并行的替代方案：
- fan-in 验证：

确认后我再启动；不确认则按串行推进。
```

不能用只读授权替代写入授权。只读 consult 发现“可以并行”也只是证据，真正让 worker 改文件前仍要有显式确认，或有已接受计划中的预授权边界。

## Context Steward Sidecar

上下文维护适合交给独立 sidecar，而不是让主实现 worker 顺手处理：

- 触发：模块结构、验证命令、安装方式、根入口规则或 `.codex/context/**` 可能过期。
- 默认模式：`agent:context-steward` scoped_write，先运行 `zc context init --plan --json` 或等价 dry-run；候选变更只涉及自有边界时，直接刷新 `.codex/context/**` 和 `AGENTS.md` 的 `zc-context:init` managed block。
- 降级边界：只有出现同文件冲突、来源不明、需要修改用户手写规则或越过项目上下文边界时，才停在 fan-in 等主线程确认。
- 隔离规则：context steward 不修改业务源码，不占用业务 worker 的文件所有权；如果主任务也要改 `AGENTS.md`，必须先停在 fan-in，由主线程统一处理。
- loop budget：context steward 默认 1 轮；如果需要补上下文，最多补交 1 次，仍无法判断时回到 `context-engineering`。

推荐派发片段：

```text
Agent assist:
- zc_context_steward：审计并维护项目上下文，不改业务文件
ownership：.codex/context/** + AGENTS.md managed block
fan-in：主线程读取写入证据；冲突、越界或来源不明时再决策
```

低风险写入 fan-out 预授权条件：

- 任务非生产、非敏感、非破坏性。
- 每个 worker 的修改文件或目录不重叠。
- worker 不超过 2 个。
- 计划已列出文件所有权、验证命令和 fan-in gate，并已被用户接受。
- 启动时用通知式提示复述 worker、文件边界和验证。

默认上限：

- 普通复杂任务默认 1-3 个只读 agent。
- 用户明确要求多 agent、且任务天然可按来源、模块、风险面或验证面拆分时，只读 agent 最多 5 个；主线程必须保留 controller 角色。
- 写入型并行默认最多 2 个 worker。
- 文件所有权完全不重叠、计划已接受、验证明确时，写入 worker 最多 3 个。
- 超过默认数量必须说明收益、fan-in 成本、冲突风险和降级路径。
- `zc team` 必须用户明确要求或确认。

## 执行契约

当上游入口给出 `dispatch_now: yes` 时，本 skill 不能只写建议，必须实际派发可用 agent，或显式降级：

```text
dispatch_contract:
- dispatch_now: yes | no
- dispatch_evidence:
- mode:
- agents:
- ownership:
- loop_budget:
- fallback:
```

- Codex 可用时优先使用真实 custom agent / subagent，如 `zc_code_reviewer`、`zc_test_engineer`、`zc_security_auditor`、`zc_performance_engineer`、`zc_architect`、`zc_product_owner`。
- 只读 agent 必须明确“不改文件”。
- 写入 worker 必须收到完整任务文本、文件所有权、验证命令和返回格式。
- 平台没有可用 dispatch tool 时，记录 `fallback=main-thread`，不要把未执行的 agent assist 当成已执行。

## Worker 合约

每个子代理都必须收到：

- 任务目标和验收标准
- 允许读取的关键上下文
- 允许修改的文件或模块边界；只读 worker 必须明确“不改文件”
- 不得触碰其他 worker 文件的说明
- 任务内验证命令
- 返回格式：`DONE / BLOCKED / NEEDS_CONTEXT`

返回时必须列出：

- 修改文件
- 已运行验证
- 提出的 findings 或回归结论
- 未覆盖风险
- 需要主线程 fan-in 的事项

## Bounded Loop

并行不是无限循环。每个 fan-out 都必须有明确预算：

- 只读 consult 默认 1 轮；结论冲突时主线程先做 fan-in，不继续无差别加派。
- 单个 worker 缺失产物最多补交 2 次；每次补交必须改变上下文、任务范围或验证方式。
- 同一 review finding 最多 2 轮修复/回归；仍未关闭时停线，由主线程缩小范围、改派或回到计划。
- 同类失败、同一文件冲突、验证命令缺失、agent 状态不明或重复空输出，立即停止当前并行批次。
- 失败后优先保留已完成结果，再决定部分合入、串行补齐或回到 `planning-and-task-breakdown` / `debugging-and-error-recovery`。

## Fan-In 门禁

并行完成不等于任务完成。fan-in 必须检查：

- 所有子代理结果是否到齐。
- 是否出现同文件修改、命名冲突或接口冲突。
- 局部验证是否可信。
- review finding 是否由提出方完成回归。
- context stewardship 报告是否说明上下文是否需要刷新，以及刷新是否会触碰主流程文件。
- 主线程是否运行集成测试或目标平台验证。
- 是否需要清理分支、worktree、临时文件或保留待审查分支。

闭环所有权：

- `producer owns fix`：谁引入问题，谁优先修复。
- `reviewer owns regression`：谁提出问题，谁负责复验原 finding 是否关闭。
- `controller owns fan-in`：主线程负责接受、转派、整合和最终验证。

推荐记录格式：

```text
Parallel acceptance transcript:
- Plan:
- Workers:
- Task ownership:
- Changed files:
- Findings:
- Fixes:
- Regression:
- Loop budget:
- Evidence:
- Verification:
- Conflicts:
- Follow-up:
```

## 失败处理

- 单个 worker 失败时，不要自动丢弃其他成功结果。
- 先收集成功结果，再判断是否可以部分合入。
- 失败任务优先缩小范围、补上下文或改为串行处理。
- 如果失败暴露计划不成立，回到 `planning-and-task-breakdown`。

## 与相关技能的边界

- `subagent-driven-development`：串行委派，不做并行 fan-out。
- `team-orchestration`：进程级 + 文件系统级隔离。
- `branch-finish-and-cleanup`：fan-in 后处理分支、worktree 和残留状态。
- `verification-before-completion`：声明完成前读取验证输出。
