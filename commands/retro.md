---
name: retro
description: 触发 Sprint 回顾，统计产出数据、总结决策效果、识别瓶颈、输出改进清单。
---

调用 sprint-retrospective 技能。回顾本轮开发，提取改进项。

1. 采集数据 — Git 统计、任务完成情况、构建和 CI 指标
2. What Went Well / What Didn't — 识别好的实践和遇到的问题
3. Spec 偏差检查 — 对比最终实现与原始 Spec，记录偏差原因
4. 流程健康度 — TDD 遵循率、验证通过率、审查覆盖率
5. 输出 Action Items — 具体改进行动 + 负责人 + 截止时间
6. 运行 `/learn` 提取可复用模式

## 使用方式

在 Sprint 结束时执行 `/retro`，自动采集数据并引导回顾。

### 示例

```
# Sprint 结束
/retro

# 指定回顾范围
/retro 回顾过去一周的支付模块重构

# 事故后回顾
/retro 回顾昨天的线上故障处理过程
```
