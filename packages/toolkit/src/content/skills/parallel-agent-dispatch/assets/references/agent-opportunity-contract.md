# Agent Opportunity 共享契约

本文件是 `agent_opportunity` 字段语义、授权边界和默认循环规则的唯一 owner。`start` 负责判型，`planning-and-task-breakdown` 负责记录本次解析结果，`sdd-tdd-workflow` 负责阶段路由，`parallel-agent-dispatch` 负责执行。

## 字段

先按独立子问题、专项审查价值和预期收益判断是否协作；文件数量和“优化”等泛词不单独触发派发。用户明确要求 agent 时，在平台能力和安全边界内执行。无需派发时用 `mode=none`、`dispatch_now=no` 和理由即可；简单任务可省略该块。实际派发才展开下列字段，不重复已记录且仍有效的计划。

除非用户明确限制协作，存在边界明确的独立子任务，派发预计能节省时间或改善质量，且主线程有可同步推进的工作时，应使用可用协作工具实际派发；不要仅因用户未说“多 agent”而降级为建议。只为凑并行数拆分、重复调查同一问题或让主线程空等，不构成协作收益。

```text
agent_opportunity:
- mode: none | readonly-consult | serial-subagent | context-fanout | worktree-team
- dispatch_now: yes | no
- dispatch_evidence:
- agents:
- runtime capacity:
- isolation: shared | codex-temp-worktree | zc-team-worktrees
- context_maintenance:
- ownership:
- confirmation / needs_confirmation:
- fan-in / fan-in gate:
- loop_budget:
- fallback / degraded path:
```

`confirmation` 与 `needs_confirmation`、`fan-in` 与 `fan-in gate` 是不同承载面的兼容名称，不在单次计划中重复输出。

## 模式与授权

- `none`：任务简单、强耦合、同文件冲突或缺少验证方式。
- `readonly-consult`：任务范围已授权且 host 可用时，通知后直接派发；必须明确“不改文件”。
- `serial-subagent`：任务独立但有依赖顺序，由主线程逐个委派并 fan-in。
- `context-fanout`：任务可按问题或互斥文件边界并行。已授权实现、低风险、所有权和验证清楚时可通知式启动；否则显式确认或降级串行。
- `worktree-team`：仅在用户明确要求或确认、并且 tmux / worktree / 多 CLI 确有收益时使用；它是 `zc agent plan --mode` 的 machine enum，实际运行由 `zc team` 承担。

高风险、生产数据写入、敏感操作、破坏性操作、外部副作用及 `worktree-team` 必须有覆盖该动作的显式授权；已有授权不重复确认。只读授权不能替代写入授权。同文件写入应串行或重新分配所有权；边界不清时先收敛，不能靠确认允许冲突并写。

## 容量、所有权与上下文

- 按 host session limit、活跃 child threads 和 ready tasks 计算容量；不写死跨版本 worker 上限，主线程保留 controller / integrator 职责。
- 容量只是上限。只派当前有独立交付物且收益覆盖上下文与协调开销的最小批次；新增 worker 必须说明新增证据或交付物，不能只因有空位就补位。
- 容量允许不等于允许同文件并写。写入 worker 必须有互斥文件所有权、验证命令和返回格式。
- `agent:context-steward` 是 sidecar，不是 mode。它只拥有 `.codex/context/**` 和 `AGENTS.md` managed block；同文件冲突、来源不明或越界时停在 fan-in。
- 临时独立构建环境使用 `codex-temp-worktree`；tmux / 多 CLI 才使用 `zc-team-worktrees`。

## Fan-in 与有界循环

- `producer owns fix`，`reviewer owns regression`，`controller owns fan-in`。
- 只读 consult 默认 1 轮；单 worker 缺失产物最多补交 2 次；同一 finding 最多 2 轮修复与回归。
- `loop_budget` 同时写返工轮数与任务内检查点：默认只读任务在 10 次工具调用或 5 分钟、写入任务在 20 次工具调用或 10 分钟时检查进展，以先到者为准。这是可按范围调整的工作检查点，不是 host 硬限制或套餐 token 上限；长测试先收集已有进程结果，不为计数中断健康验证。
- 检查点返回已完成结果、剩余问题、验证状态及下一步依据。controller 可在原授权内基于新证据续跑；连续两次检查点没有新增证据、有效修改或验证进展时停止该分支，保留产物并缩小范围或接手，不自动放弃用户目标或要求重新授权。
- 验收满足立即返回，不自行扩展到相邻功能。新需求先由 controller 重新划分范围；同一缺陷的返工保留 owner，新独立任务只传必要交接。
- 协调消息只发送会改变执行的新事实、阻塞、接口决策或合并后的 findings；不发送“继续”“加快”“再检查一遍”等无新信息催问。无变化时使用有界等待，不反复轮询或唤醒已完成任务。
- 合并独立读取和检查，输出摘要与证据定位；不反复回灌完整日志。已有可信验证仅在修改、失败、证据过期或新风险时重跑；保留必要的最终集成、安全和真实用户流程验证。
- 同类失败、同文件冲突、验证缺失、agent 状态不明或重复空输出时停止当前批次，保留已完成结果并缩小范围、改串行或回到计划/调试。
- fan-in 必须核对 agent 终态、修改文件、冲突、局部证据、回归结论、上下文维护结果、集成验证和清理状态。
- `dispatch_now: yes` 必须真实派发可用 agent；平台无 dispatch 能力时记录 `fallback=main-thread`，不能把建议描述成已执行。
