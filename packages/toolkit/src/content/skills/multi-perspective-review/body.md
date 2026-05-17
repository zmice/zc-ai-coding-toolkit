# 多视角评审

## 何时使用

- Spec 或 Plan 写完、实现还没开始时
- 架构决策牵涉产品、工程、设计和开发体验多个面向时
- 团队觉得方案“好像没问题”，但还没经过压力测试时
- 需要尽早发现范围、体验或维护性盲区时

## 输入前提

- 已有可评审的规格、计划或方案草案
- 愿意在实现前先暴露问题
- 接受同一个方案需要经过多种视角拷问
- 明确这里评审的是“计划态假设”，不是实现后的真实走查

## 执行步骤

1. 用 **产品视角** 检查是否在解决正确问题
2. 用 **工程视角** 检查架构、数据流、状态、失败模式、边界条件、性能和测试策略
3. 用 **设计视角** 检查交互、可用性、响应式和无障碍
4. 用 **DevEx 视角** 检查计划中的集成成本、配置复杂度、文档前提、学习曲线和维护负担
5. 把四个视角发现的问题改写成可执行的修订项、约束或验收标准
6. 对会改变路线的发现触发 `stop gate`，先收敛决策，不把问题静默写进计划后继续
7. 输出 `Implementation Tasks`，把需要修订的发现转成可执行任务
8. 汇总结论，明确需要修订的点，再决定是否进入实现

## 评审产物

评审结果必须能回写到 plan / spec，而不是只形成聊天意见：

- `GO / REVISE / NO-GO` 结论
- 分级发现：`Critical / Warning / Suggestion`
- 每条发现对应的证据、影响和修订动作
- 对应的验收标准或验证命令
- 会改变路线的 stop gate 决策及当前状态
- `Implementation Tasks`：每条待修问题对应的 P1/P2/P3 任务
- 如果需要提问，最多 1-3 个会改变方案的关键问题

## 推荐结论格式

最终结论必须包含明确推荐和取舍：

```text
Recommendation: <GO / REVISE / NO-GO + next action> because <specific cross-perspective trade-off>.
```

推荐理由至少说明：

- 哪个视角的证据最关键
- 放弃了什么替代方案
- 接受了什么代价或风险
- 下一步用什么验证或修订来收敛

如果需要提问，每个问题都要说明它会解锁哪个决策，避免只收集背景信息。

## Stop Gate

以下情况不能直接给 `GO`：

- Critical 发现会改变架构、数据模型、权限、破坏性操作或用户可见承诺
- 不同视角的结论互相冲突，且会改变任务顺序或验收标准
- 计划缺少关键验证方式，导致实现完成后无法判定是否通过
- 发现明显过度设计，但当前计划仍按高复杂度方案推进

Stop gate 输出：

```text
STOP: <route-changing finding>
- Perspective:
- Evidence:
- Impact:
- Options:
- Recommendation:
- Required decision or assumption:
```

如果用户已给出偏好，写成 `Assumption` 并继续；否则先提问。不要把 stop gate 伪装成普通 Suggestion。

## Implementation Tasks

评审发现必须能转成 plan 可吸收的任务：

```text
### Implementation Tasks
- [ ] T1 (P1) — <component> — <imperative title>
  - Surfaced by: <perspective> — <specific finding>
  - Files likely touched:
  - Acceptance criteria:
  - Verification:
```

规则：

- P1 阻塞进入实现或合并
- P2 应进入当前计划
- P3 可以作为 follow-up，但要说明不阻塞的理由
- 没有 actionable task 的发现，要明确写 `_No implementation task; informational only._`

## 边界说明

- 这里的 DevEx 只评估“实现前是否想清楚”，不替代实现后的真实安装和上手走查
- 如果代码已经落地，需要确认 getting started、安装链和首次成功路径是否真的成立，转到 `developer-experience-audit`
- 不要把这里当成发布前体验签收清单；它的价值是提前暴露盲点，而不是事后补测
- 不引入重型运行时、遥测、自动升级或跨会话记忆作为评审前提；这些只能作为显式 opt-in 的后续能力讨论

## 成功标准

- 方案不再只从工程角度自证合理
- 关键风险能在写代码前暴露
- 每个视角都有具体 concern，而不是泛泛评价
- DevEx 问题被表达为计划假设、约束或验收条件，而不是模糊感受
- 最终结论可以明确是 `GO / REVISE / NO-GO`
- 评审输出能直接变成 plan 修订、任务依赖或验证门禁
- Critical 或 route-changing 发现没有被跳过；要么进入 stop gate，要么转成 P1 任务

## 相关原则

- 越早发现问题，修复成本越低
- 单一视角的“没问题”不算通过
- 评审输出必须能转化为具体修订动作
- 计划态评审与实现后实测必须分相位处理

## 与其他技能的衔接

- 常接在 `spec-driven-development` 或 `planning-and-task-breakdown` 之后
- 评审通过后再进入 `incremental-implementation`
- 实现完成后，如需验证 DevEx 假设是否成立，继续进入 `developer-experience-audit`
- 产品或架构争议较大时，可结合 `product-owner` 和 `architect`
