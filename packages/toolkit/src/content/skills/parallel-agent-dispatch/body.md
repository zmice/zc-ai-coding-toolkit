# Parallel Agent Dispatch

## 角色定位

把彼此独立的任务做上下文级 fan-out，并在结束时做 fan-in、冲突检测和集成验证。在 Codex 中，用户请求多 agent、`AGENTS.md` 的 `dispatch_now: yes` 或本 skill 的适用条件命中后，只读 fan-out 可通知式直接启动；低风险写入 fan-out 在任务授权和所有权边界明确时也可直接作为实现步骤推进。

这个 skill 不是默认加速器。能并行不等于应该并行；并行会增加 token、延迟、集成和验证成本。

## 快速路径

1. 读取当前任务或已有计划，确认独立子问题及协作收益；不要为了只读咨询另建完整计划。
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
- 写入型并行缺少覆盖实现的授权、互斥所有权或验证方式；已有任务授权且边界清楚时，不要求额外接受一份计划才能派发。

## 模式选择

| 模式 | 适用场景 | 代价 |
|---|---|---|
| Readonly Consult | 多个只读 agent 分别评估架构、测试、安全、性能、产品、上游吸收、Codex 适配、安装/更新或 review 风险 | 需要主线程判断哪些结论成立 |
| Context Fan-Out | 只需要多个子代理分别分析或修改互不重叠文件 | 共享同一 worktree，fan-in 需谨慎检查 |
| Codex Temp Worktree | 需要独立构建环境或相邻目录隔离，但不需要 tmux / 多 CLI | OS temp lease、branch 与 receipt 需要 fan-in 清理 |
| Cascade | 任务有层级依赖，但每层内可并行 | 每层都要验证后再进下一层 |
| Agent Controller | 需要先生成 task brief、report、ledger 和 fan-in gate，但暂不启动真实 worker | 只生成 `.codex/work/agent-runs/<run-id>/` artifacts |
| Team Orchestration | 需要 tmux + git worktree + 多 CLI worker | 运行时成本最高，需 `zc team` 收尾 |

普通 Codex 只读 fan-out 直接使用 host 原生 lifecycle，不强制先生成 controller artifacts。线程、容量、context fork、复用、中断和临时 worktree 的精确映射见 `references/codex-native-lifecycle.md`。`zc agent plan` 只用于写入较重、需要恢复或审计 transcript 的运行；需要 tmux / 多 CLI 才切到 `team-orchestration`。

## 共享决策契约

mode、授权、runtime capacity、ownership、context steward、fan-in 和默认 loop budget 统一见 `references/agent-opportunity-contract.md`。本 skill 不再维护第二套字段定义，只消费上游已记录的决策并执行。

未派发时只保留判断与理由；实际派发才展开执行契约。用户明确要求协作时在能力与安全边界内执行；用户明确要求不使用 agent 时由主线程完成。已有计划与授权仍有效时直接复用，不因阶段切换再次索取。

只读 fan-out 使用通知式提示：

```text
Agent assist:
- <agent>：只读评估 <范围>，不改文件
fan-in：主线程汇总结论后再决定是否改代码
```

写入型 fan-out 在共享契约允许通知式启动时复述本次解析结果：

```text
Agent assist:
- worker 数：
- 文件所有权：
- fan-in 验证：
- 启动条件：实现已授权、低风险、所有权和验证清楚
```

共享契约要求显式确认时使用：

```text
Recommendation: 开启 <模式> because <并行收益> outweighs <集成代价>。
- worker 数：
- 文件所有权：
- 不并行的替代方案：
- fan-in 验证：

确认后我再启动；不确认则按串行推进。
```

具体 context steward lifecycle 仍按 `context-engineering` 和当前 host 能力执行；`zc agent plan` 是可选审计 artifact，不是 native dispatch 前置条件。

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
- 每次 native dispatch 记录 thread id、context fork、实际 role/model、状态和 fallback；同一任务 rework 复用 owning thread。
- 只读 agent 必须明确“不改文件”。
- 写入 worker 必须收到完整任务文本、文件所有权、验证命令和返回格式。
- 平台没有可用 dispatch tool 时，记录 `fallback=main-thread`，不要把未执行的 agent assist 当成已执行。

## Codex 临时 Worktree

共享树文件所有权难以隔离、或 worker 需要独立构建环境时，先运行 `zc agent worktree prepare` dry-run，再用 `--apply` 创建 OS 临时 worktree。它不使用仓库 `.worktrees/`，不占用 `$CODEX_HOME/worktrees`，也不等同于 `zc team`。

worker 收到绝对 worktree path；fan-in 收集完成且 agent 进入终态后，用 `zc agent worktree cleanup` 先看 plan，再 `--apply`。dirty、missing、receipt/branch mismatch 或 plan 后状态变化都会阻止清理。有未合入 commit 时只保留恢复 branch 与 receipt，不保留无用工作目录。

## Worker 合约

每个子代理都必须收到：

- 任务目标和验收标准
- 允许读取的关键上下文
- 允许修改的文件或模块边界；只读 worker 必须明确“不改文件”
- 不得触碰其他 worker 文件的说明
- agent role 和 model；没有特定模型时写明 `platform-default`
- 任务内验证命令
- 返回格式：`DONE / BLOCKED / NEEDS_CONTEXT`

返回时必须列出：

- 修改文件
- 已运行验证
- 提出的 findings 或回归结论
- 未覆盖风险
- 需要主线程 fan-in 的事项

文件交接必须走最小资产包：

| 文件 | 负责人 | 用途 |
|---|---|---|
| `tasks/<id>.md` | controller | 给 worker 的任务目标、所有权、验证和 loop budget |
| `reports/<id>.md` | worker | 记录变更、证据、风险和 fan-in 事项 |
| `review-packages/<id>.md` | controller | 给 reviewer 的 scoped diff、验证证据和未决风险 |
| `reviews/<id>.md` | reviewer | 记录 finding、复验标准和回归结论 |
| `ledger.md` / `fan-in.md` | controller | 记录状态、接受/拒绝、最终验证和清理 |

- 不把完整聊天历史粘给 reviewer；reviewer 读 brief、report、changed files 和 scoped diff。
- 单任务 review 只审该任务，跨任务一致性由最终 fan-in review 处理。
- reviewer 默认不重跑 implementer 测试，除非证据缺失、过期、可疑或 finding 需要复现。
- findings 先作为待判定事实记录，不在转给 producer 前预设“有效/无效”。

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
- runtime thread 是否明确为 completed / failed / interrupted / blocked / missing，部分成功是否已保留。
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
