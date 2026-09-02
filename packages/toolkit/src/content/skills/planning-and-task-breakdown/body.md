# 规划与任务拆解

## 何时使用

- 已有规格，需要拆成可执行单元
- 任务太大、太模糊或依赖顺序不明显
- 需要并行推进多个切片
- 需要向人类清楚表达范围、风险和检查点

不适用于单文件且边界显而易见的小改动。

## 输入前提

- 已有规格，或至少有清楚的问题定义
- 已读相关代码并识别主要约束
- 愿意在规划阶段保持只读，不边做边改

## 未完成计划保护

写入计划文件或外部任务系统前，先检查是否已有未完成计划：

- 属于同一工作且本轮是修订：在原计划上更新，并保留仍有效的任务和决策。
- 属于不同工作：停止写入，报告冲突，并由用户选择先完成、废弃旧计划或使用新承载位置。
- 不批量关闭、删除或覆盖外部任务项；只有用户明确指定范围时才改变其状态。

不要用新计划静默覆盖未完成计划。

## 执行步骤

1. 进入只读分析模式，先看规格和现有代码
2. 识别依赖图，确定哪些必须先做
3. 优先做纵向切片，而不是按数据库、API、UI 横向分层
4. 为每个任务写清：
   - 描述
   - Acceptance criteria
   - Verification
   - Dependencies
   - Files likely touched
5. 排出顺序，并设置阶段性检查点
6. 如果发现会改变计划路线的阻塞问题，先进入 `stop gate`，不要把问题静默写进计划后继续推进
7. 把 multi-agent 模式作为执行决策写入计划：先评估 Codex native 只读协助，再判断是否需要串行子代理、context fan-out、可选 `zc agent plan` artifacts、Codex 临时 worktree 或 `zc team`

## 提问纪律

- 能从规格、代码、配置、测试或用户原话判断的，不问。
- 只有缺失信息会改变架构、数据模型、任务顺序、破坏性操作或并行边界时才问。
- 一轮最多问 1-3 个关键问题，问题要说明选择会避免什么风险或解锁什么能力。
- 用户已经给出偏好时，把它写进计划假设；不要把偏好扩展成长期配置或跨会话记忆授权。

## 计划产物要求

计划不是任务名列表，至少要包含：

- `decision log`：关键取舍和采用原因
- `evidence`：读取过的规格、代码、配置、测试或上游证据
- `open risks`：尚未证明的风险和验证方式
- `stop gates`：会改变架构、数据模型、破坏性边界、并行边界或验收口径的阻塞决策
- `agent_opportunity`：本计划是否需要只读协助、串行子代理、上下文级并行、可选 `zc agent plan`、Codex 临时 worktree 或 `zc team`，并列出匹配的 Codex agents / workers、runtime capacity、确认边界和 fan-in gate
- `fan-out eligibility`：是否能并行、按哪些文件或模块拆、是否有确认边界、是否需要 `zc agent plan` 或 `zc team plan`
- `fan-in gate`：实现后如何合流、审查、回归、验证和清理
- `loop_budget`：多 agent、review finding、worker 补交或验证失败最多允许几轮，何时停线回到计划或调试
- `implementation tasks`：从计划或评审发现转化来的可执行任务列表

## 决策日志格式

每个关键取舍都要写成可审查的推荐，而不是只写“建议这样做”：

```text
Recommendation: <chosen action> because <evidence and trade-off>.
- Chosen:
- Rejected alternative:
- Evidence:
- Cost / risk:
- Verification gate:
```

理由必须说明被放弃的替代方案，以及当前选择为什么更适合本任务。不能只写“更稳”“更简单”“更符合最佳实践”。

## Stop Gate

以下发现必须先停下来收敛，不允许直接写进计划然后继续：

- 现有证据推翻了原始目标或核心假设
- 任务顺序、数据模型、权限边界、破坏性操作或并行边界需要重新选择
- 评审发现如果不处理会导致后续实现返工
- route-changing finding、agent mode 变化或 fan-out 边界变化会改变后续任务顺序
- 缺少验证方式，导致任务无法判断完成

Stop gate 输出格式：

```text
STOP: <阻塞发现>
- Evidence:
- Impact:
- Options:
- Recommendation:
- Required decision:
```

只有用户已经给出明确偏好，或仓库证据能支持保守路线时，才把 `Required decision` 写成显式假设并继续；否则先问。

## Implementation Tasks

从计划或评审发现生成任务时，统一使用这个可执行格式：

```text
- [ ] T1 (P1) — <component> — <imperative title>
  - Source finding:
  - Files likely touched:
  - Acceptance criteria:
  - Verification:
  - Dependencies:
```

规则：

- `P1`：阻塞当前交付，必须本轮处理
- `P2`：应在同一分支处理，否则会留下明显质量缺口
- `P3`：可延后的跟进项，必须说明为什么不阻塞当前目标
- 每个任务必须来自具体发现、需求或证据；不能为了填表新增空任务
- 任务标题用动作开头，能直接交给实现阶段

## Definition of Done 分层

不要把任务验收和项目级 DoD 混在一起。

- `Acceptance criteria`：只写这个任务本身必须满足的可观察行为、文件边界和局部验证。
- `Verification`：只写证明这个任务完成所需的命令或人工检查。
- `Project DoD`：只在计划末尾写一次，覆盖整体回归、lint/build、文档同步、上下文维护、发布检查、提交范围和清理要求。
- 任务之间共享的门禁不要复制到每个任务；用 `fan-in gate` 或 `Project DoD` 引用，避免计划膨胀。

每个任务的 acceptance criteria 必须可独立判断；Project DoD 必须能回答“整批变更是否可以交付”。

## Agent Opportunity

计划阶段必须给出明确的多 agent 结论，而不是只写“可并行”：

```text
agent_opportunity:
- mode: none | readonly-consult | serial-subagent | context-fanout | worktree-team
- dispatch_now: yes | no
- trigger:
- dispatch_evidence:
- recommended Codex agents/workers:
- runtime capacity:
- isolation: shared | codex-temp-worktree | zc-team-worktrees
- context_maintenance:
- ownership:
- confirmation:
- fan-in gate:
- loop_budget:
```

字段语义、mode、授权和默认 loop 统一遵循 `parallel-agent-dispatch` 的 agent opportunity contract。计划不复制 policy，只记录本次解析后的完整字段：

- agent / worker 必须是当前平台真实可执行角色；不可用时记录主线程 fallback。
- `runtime capacity` 写当前快照，不写跨版本固定上限。
- `ownership` 列互斥文件或只读问题边界；`fan-in gate` 列整合者、回归责任、验证和清理。
- `context_maintenance` 记录是否需要 sidecar 及本次 owned files，不重复定义其长期权限。
- `confirmation` 明确本次是通知式、已预授权或 explicit；高风险和 `worktree-team` 只能是 explicit。
- `loop_budget` 记录本次轮数、stop condition 和 degraded path。

## 成功标准

- 每个任务都能独立实现、测试和验证
- 任务粒度足够小，不会一次触碰过多文件
- 依赖顺序和可并行项是显式的
- 人类看完计划后能明确判断“方案对不对”
- 计划中的问题和风险都能落到后续验证命令或审查项
- `agent_opportunity` 已给出 mode、触发原因、确认边界和 fan-in gate
- `loop_budget` 已给出最大轮次、停线条件和降级入口
- 并行任务必须有明确文件所有权或隔离理由
- 阻塞发现已经进入 stop gate 或被转成 P1 implementation task

## 相关原则

- 计划服务实现，不是形式化文档
- 先控制复杂度，再讨论并行度
- 任务必须能验证，不能只写动作名
- 计划阶段发现的问题要进入计划本身，不能只留在聊天里

## 与其他技能的衔接

- 接在 `spec-driven-development` 之后
- 计划确认后交给 `incremental-implementation`
- 涉及方案争议时，可搭配 `multi-perspective-review`
