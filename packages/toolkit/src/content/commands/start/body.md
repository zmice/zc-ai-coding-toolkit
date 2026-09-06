按当前目标、阶段和风险选择 workflow，并进入实际可执行的下一步。已有清晰任务和上下文时直接推进，不为分诊先读完整仓库。

## 快速路径

1. 判断用户要的是研究、方案、实现、修复还是审查，保留范围与完成条件。
2. 按下表选 workflow；已有 spec 或 plan 时从相应阶段进入。
3. 只读取当前步骤需要的指导与项目证据。
4. 在已授权范围内完成工作和必要验证；只有缺失决策或授权才暂停。

## 固定 workflow

| workflow | 适用任务 | 默认 entry |
| --- | --- | --- |
| `product-analysis` | 目标、价值、范围或验收尚未收敛 | `product-analysis` |
| `full-delivery` | 已明确要做，需定义、实现、审查与验证的完整交付 | `sdd-tdd` |
| `bugfix` | 可复现异常、失败测试、构建失败 | `debug` |
| `review-closure` | 已有变更，需审查或收敛反馈 | `quality-review` |
| `docs-release` | 文档、ADR、发布说明或上线准备 | `doc` |
| `investigation` | 上游吸收、技术摸底或需要理解项目 | `onboard` |

`sdd-tdd` 是 `full-delivery` 的入口，不是所有任务的起点。小修复、文案和只读研究不套完整交付流程。

### 判型优先级

多个信号同时出现时，以用户当前交付目标为准：

1. 显式 review findings：进入 `review-closure`；要求修复反馈时用 `review-response-and-resolution`。
2. CI 失败、错误日志或可复现异常：进入 `bugfix`。
3. 上游更新、依赖升级或陌生能力吸收：先 `investigation` 获取当前证据，再决定内容或实现改动。
4. 文档误导：仅文案进入 `docs-release`；暴露实现不一致则先 `bugfix`。
5. 新功能：目标与验收明确才进入 `full-delivery`；否则先 `product-analysis`。

生产数据、凭据、破坏性或持久化写入按实际风险选 `guard` / `careful` / `freeze`。这些风险不改变主 workflow，也不自动授权写入。

### 阶段内切入

- `product-analysis`：探索用 `idea` / `brainstorming-and-design`；规格用 `spec`；评审用 `plan-review`。
- `full-delivery`：已有 spec 用 `task-plan`；已有可执行 plan 用 `build`；待审查用 `quality-review`；待验证用 `verify`。
- `review-closure`：反馈修复用 `review-response-and-resolution`，保留 finding 与回归证据。
- `docs-release`：发布准备可用 `ship`，发布动作按已有授权边界执行。
- `investigation`：上下文漂移用 `ctx-health`；只探索任务相关区域，不要求全仓地图。

## 输出契约

简单任务用一句话给出 `workflow`、`entry`、理由和必要验证后继续，不输出空字段。未决假设仅在影响结果时说明。
复杂任务补充风险、完成条件与协作判断；有真实取舍再解释替代方案，不为格式重复提问。

## 并行与 agent 判断

按独立子问题和预期收益评估协作，不凭“优化、审查”等词或文件数量自动展开流程：

- 用户明确要求 agent 时，在可用且任务边界允许的情况下真实派发；无法派发要说明原因。
- 有可独立验证的问题、需要专项风险审查或互斥实现任务，且主线程能同时推进有用工作时，考虑 `readonly-consult` / `context-fanout`。
- 强耦合、小任务或缺少独立子问题时由主线程处理；复杂或高风险任务仍应评估协作，不能把精简输出当成跳过风险判断。

无派发时只需 `agent_opportunity: mode=none, dispatch_now=no` 和理由；简单任务可省略。准备派发时记录：

```text
agent_opportunity:
- mode: readonly-consult | serial-subagent | context-fanout | worktree-team
- dispatch_now: yes | no
- dispatch_evidence:
- agents:
- ownership:
- fan-in:
- loop_budget: 轮数与 stop condition
- needs_confirmation: 已有授权或缺失授权
```

实际派发前读取 `parallel-agent-dispatch` 的共享 agent opportunity contract，按需补容量、隔离、上下文维护与 fallback，不重复已有计划。

- `dispatch_now: yes` 必须真实派发；平台不支持时明确 `fallback=main-thread`。
- 只使用当前 host 存在的 agent。Codex 优先使用可用 custom agents，不把 Codex 专有能力写成全平台默认。
- 写入 agent 必须有互斥文件所有权、验证命令、loop budget 和 fan-in gate；边界不成立时降级串行，无法确定安全路线再回到 `task-plan`。
- 高风险动作与 `worktree-team` 需要覆盖该动作的显式授权；已有授权不重复请求。只读分析不等于执行敏感写入。

## 提问与持续执行

- 能从现有证据或用户要求确定的，不问；例行、可逆步骤按合理假设推进。
- 只有缺失信息会改变关键路线、数据安全、外部契约、不可逆操作或用户目标时才问，聚焦所需决定。
- 阶段证据满足后继续到已授权任务的完成条件；用户只要方案、研究或评审时，不擅自进入实现。
- 用户明确要求优先于 skill 指导；若指导导致暂停，指出具体文件、条款及缺失授权或决策。

## 上下文与持久化边界

- `AGENTS.md` 等入口只放长期约定和稳定路由，skill 与详细流程按需加载。
- 用户偏好不等于写入长期配置或跨会话记忆的授权；用户级配置、跨项目路由和跨机器同步需明确覆盖范围。
- 只有本次确实改变长期项目事实且有独立维护范围时才考虑 `agent:context-steward`，在 fan-in 核对结果。
- 平台不支持的能力不可用文案暗示支持。

## 平台说明

`start` 是 canonical command；Codex 通过对应 skill 使用，不代表存在 `zc start` CLI。其他平台沿用各自可用的命令或文件入口。
