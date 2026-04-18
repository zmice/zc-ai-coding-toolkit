调用统一任务开始流程。先判型，再选 workflow，不直接假定你已经知道该用哪条命令。

## 核心动作

1. 判断任务性质：`feature` / `bugfix` / `review` / `docs` / `release` / `investigation`
2. 判断需求清晰度：清晰、部分清晰、模糊
3. 判断当前阶段：未定义 / 已有 spec / 已有 plan / 正在 build / 待 review / 待收尾
4. 判断风险等级：`trivial` / `standard` / `high-risk`
5. 输出推荐 workflow、下一条入口命令和必要的防护建议

## 路由原则

- 新功能、新项目、复杂重构：优先进入 `sdd-tdd`
- 需求模糊或前提不稳：先进入 `spec`
- 已有规格但还没拆任务：进入 `task-plan`
- Bug、异常行为、失败测试：进入 `debug`
- 已完成实现待审查：进入 `quality-review`
- 准备声明完成或上线前确认：进入 `verify` 或 `ship`
- 陌生代码库、上下文失焦、需要重新梳理：进入 `onboard`、`ctx-health` 或 `idea`

## 平台说明

- `start` 是 canonical command，不等于所有平台都有原生同名命令
- 在 Codex 上，它更适合作为“统一任务开始方式”的自然语言入口
- 在 Qwen / Qoder 上，可以呈现为更接近命令式的入口文案

## 使用方式

直接描述任务即可；如果你已经知道当前阶段，也可以一起说明。

### 示例

```text
开始一个新功能：实现用户登录和刷新 token

修复一个问题：批量导入时偶发重复数据，先帮我判型并选择流程

我这里已经有 spec，帮我判断下一步应该进 task-plan 还是 build

审查最近的改动，并告诉我是否还需要 verify 或 ship
```
