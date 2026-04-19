这是 `command:start` 完成任务评估后的 **完整开发工作流入口**。

当任务属于新功能、较大改动或需要完整门控时，从 `command:start` 接力到这里，由 `sdd-tdd-workflow` 按阶段推进。

## 阶段顺序

1. **Spec**：澄清目标、假设、边界和成功标准
2. **Plan Review**（可选）：对 Spec 做多视角评审
3. **Task Plan**：拆成可验证、可并行、可落地的任务
4. **Build**：按 TDD 循环逐项实现
5. **Quality Review**：做五维度代码审查
6. **Commit**：审查通过后准备提交，等待用户确认
7. **Retro**（可选）：回顾本轮产出与改进项

每个阶段完成后都要停下，等待人类确认再进入下一阶段。

## 何时使用

- `command:start` 判断这是一个完整交付任务
- 需求还不够清晰，但后续会进入 Spec → Plan → Build 全流程
- 你不想手动判断下一步该进哪个阶段，而是希望按门控顺序推进

## 何时不要直接使用

- 已经有明确 Spec，只需要进入 `command:task-plan`
- 已经有计划，只需要进入 `command:build`
- 只需要做专项排查、文档更新或单点审查

## 当前入口之后的典型接力

- 需求未定型：进入 `command:spec`
- Spec 写完：进入 `command:plan-review` 或 `command:task-plan`
- 计划确认：进入 `command:build`
- 实现完成：进入 `command:quality-review`
- 审查收敛后：进入 `command:verify`

## 使用方式

描述你的任务目标，我会先确认这是否应该走完整 workflow；如果是，就按上面的阶段顺序推进。
