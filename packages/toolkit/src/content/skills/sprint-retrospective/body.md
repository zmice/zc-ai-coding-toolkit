# Sprint Retrospective

## 角色定位

在一个交付周期结束后，用证据复盘计划、实现、审查和验证的质量，并把下一轮要改变的行为写成少量可执行行动项。

Retro 不是情绪总结，也不是长篇过程记录。没有行动项的 retro 通常只是仪式。

## 何时使用

- 完成一次 SDD+TDD 周期后。
- 一周或一个里程碑结束后。
- 生产事故、重大返工或计划偏差后。
- 发现重复摩擦，但还没有明确改进项时。
- 开始新大任务前，需要先复盘上一轮。

## 快速路径

1. 收集事实：提交、diff、测试、验证、PR/issue、事故记录。
2. 对照原始 spec / plan，检查 scope drift。
3. 识别有效做法、失败模式和根因。
4. 评估流程健康：TDD、review、verify、build、handoff。
5. 选出最多 3-5 个行动项。
6. 给每个行动项写 owner、deadline、success metric。
7. 判断哪些经验应该进入 ADR、docs、skill、memory 或保持为聊天结论。

## 推荐数据

按当前任务范围收集即可，不要为了复盘跑无关统计：

- commit count / changed files / insertions / deletions
- tests added or changed
- verification commands and failures
- review findings and resolution time
- spec items delivered / modified / deferred / dropped
- CI/build stability

monorepo 中必须限定路径范围，避免 unrelated diff 污染结论。

## Drift 判断

```text
Spec drift:
- Delivered as planned:
- Modified:
- Deferred:
- Added:
- Dropped:
- Reason:
```

drift 不一定是坏事。没有记录的 drift 才危险，因为下一轮会基于错误文档继续推进。

## 行动项格式

```text
Action item:
- What:
- Why:
- Owner:
- Deadline:
- Success metric:
- Verification:
```

行动项最多 3-5 个。超过这个数量，优先级通常还没有收敛。

## 知识沉淀边界

- 架构或公共接口决策：进入 ADR / docs。
- 项目长期约定：进入项目文档或入口规则。
- 用户偏好或跨会话经验：只有明确授权后才进入 memory。
- 一次性上下文和临时事故细节：只保留在本次记录中。

## 输出契约

```markdown
# Retrospective: <period / milestone>

## Evidence
- ...

## What Worked
- ...

## What Failed
- ...

## Drift
- ...

## Action Items
- ...

## Recommendation
Recommendation: <keep / change / document / escalate> because <evidence, trade-off, and rejected alternative>.
```

推荐必须说明下一轮具体改变什么，而不是只说“继续保持”。
