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
7. 把 multi-agent 模式作为执行决策写入计划：先评估只读协助，再判断是否需要串行子代理、context fan-out 或 `zc team`

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
- `agent_opportunity`：本计划是否需要只读协助、串行子代理、上下文级并行或 `zc team`，并列出匹配的 Codex agents / workers、确认边界和 fan-in gate
- `fan-out eligibility`：是否能并行、按哪些文件或模块拆、是否有确认边界、是否需要 `zc team plan`
- `fan-in gate`：实现后如何合流、审查、回归、验证和清理
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

## Agent Opportunity

计划阶段必须给出明确的多 agent 结论，而不是只写“可并行”：

```text
agent_opportunity:
- mode: none | readonly-consult | serial-subagent | context-fanout | zc-team
- trigger:
- recommended Codex agents/workers:
- ownership:
- confirmation:
- fan-in gate:
```

判断规则：

- `readonly-consult`：适合架构、测试、安全、性能、产品、上游吸收、Codex 适配、安装/更新或审查侧评；复杂计划应先考虑它，再考虑更重的并行。用户已授权只读 agent 默认启用时通知式启动，否则先预告并等待确认，不能改文件。
- `serial-subagent`：任务独立但存在依赖顺序，主线程逐个委派并 fan-in。
- `context-fanout`：任务可按文件、模块或证据问题拆开，写入前必须明确文件所有权、验证命令和 fan-in gate。若计划已被用户接受，低风险写入并行可视为本轮预授权，不必再次逐项确认。
- `zc-team`：只有用户明确要求或确认，且 `zc team plan` 返回可启动时才进入。
- `none`：任务简单、强耦合、同文件冲突或缺少验证方式。

Codex agents / workers 必须写成可执行角色或本地已知 agent 名；如果当前平台没有对应 agent，就写 `none` 或“主线程只读复核”，不要凭空造角色。

fan-in gate 必须说明：

- 主线程如何整合结果。
- 谁负责修复问题：`producer owns fix`。
- 谁负责回归确认：`reviewer owns regression`。
- 哪些命令或人工检查作为最终验证。
- 是否需要保留、合并或清理分支 / worktree / 临时文件。

低风险写入并行预授权只适用于非生产、非敏感、非破坏性任务，且文件所有权不重叠、worker 不超过 2 个；否则 `confirmation` 必须写成 explicit。

## 成功标准

- 每个任务都能独立实现、测试和验证
- 任务粒度足够小，不会一次触碰过多文件
- 依赖顺序和可并行项是显式的
- 人类看完计划后能明确判断“方案对不对”
- 计划中的问题和风险都能落到后续验证命令或审查项
- `agent_opportunity` 已给出 mode、触发原因、确认边界和 fan-in gate
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
