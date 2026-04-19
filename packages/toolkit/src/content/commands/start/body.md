调用统一任务开始流程。先评估任务，再在固定 workflow 中选路，不直接假定你已经知道该用哪条命令。

## 核心动作

1. 判断任务主类型：产品分析、完整交付、Bug 修复、审查收尾、文档发布、调查摸底
2. 判断需求清晰度：清晰、部分清晰、模糊
3. 判断当前阶段：未定义 / 已有 spec / 已有 plan / 正在 build / 待 review / 待收尾
4. 判断风险等级：`trivial` / `standard` / `high-risk`
5. 输出推荐 workflow、该 workflow 的默认入口和必要的防护建议

## 固定 workflow

### 1. `product-analysis`

适用：

- 需求还模糊
- 目标用户、价值、范围或验收标准不稳定
- 需要先把想法压成可执行方案

使用现有资产：

- `idea`
- `product-owner`
- `brainstorming-and-design`
- `spec`
- `plan-review`

默认入口：

- `idea`

### 2. `full-delivery`

适用：

- 已确认要做
- 准备进入完整交付门控
- 需要走定义、计划、实现、审查、验证的主线

默认入口：

- `sdd-tdd`

说明：

- `sdd-tdd` 是 `full-delivery` 的 workflow-entry
- 它不是统一分诊入口

### 3. `bugfix`

适用：

- Bug
- 失败测试
- 构建失败
- 异常行为

默认入口：

- `debug`

### 4. `review-closure`

适用：

- 已有改动
- 当前重点是审查、反馈处理、分支收尾

默认入口：

- `quality-review`

### 5. `docs-release`

适用：

- 文档、ADR、发布说明
- 上线准备与发布后同步

默认入口：

- `doc`

### 6. `investigation`

适用：

- 陌生代码库
- 上下文失焦
- 需要先做项目理解或技术摸底

默认入口：

- `onboard`

## 路由原则

- 需求模糊、价值与范围未收敛：优先进入 `product-analysis`
- 已明确要做且需要完整交付：进入 `full-delivery`
- Bug、异常行为、失败测试：进入 `bugfix`
- 已完成实现待审查或待响应 review：进入 `review-closure`
- 重点是文档、ADR、发布与同步：进入 `docs-release`
- 当前先要理解项目、修复上下文、摸清约束：进入 `investigation`

## 在 workflow 内部的切入点

- `product-analysis`
  - 模糊想法：`idea`
  - 需要产品判断：`product-owner`
  - 需要方案探索：`brainstorming-and-design`
  - 需要沉淀规格：`spec`
  - 需要做方案评审：`plan-review`
- `full-delivery`
  - 主入口：`sdd-tdd`
  - 已有 spec：`task-plan`
  - 已有 plan：`build`
  - 待审查：`quality-review`
  - 待验证：`verify`
- `bugfix`
  - 主入口：`debug`
- `review-closure`
  - 主入口：`quality-review`
- `docs-release`
  - 文档优先：`doc`
  - 发布优先：`ship`
- `investigation`
  - 陌生项目：`onboard`
  - 上下文漂移：`ctx-health`
  - 需要重新收敛问题：`idea`

## 平台说明

- `start` 是 canonical command，不等于所有平台都有原生同名命令
- 在 Codex 上，它更适合作为“统一任务开始方式”的自然语言入口
- 在 Qwen / Qoder 上，可以呈现为更接近命令式的入口文案
- 当前阶段没有 `zc start` CLI

## 使用方式

直接描述任务即可；如果你已经知道当前阶段，也可以一起说明。`start` 的职责是帮你先选固定 workflow，再给出下一条入口。

### 示例

```text
开始一个新需求：实现用户登录和刷新 token，先判断该直接进 full-delivery 还是先做 product-analysis

修复一个问题：批量导入时偶发重复数据，先帮我判型并选择流程

我这里需求还比较散，先帮我做 product-analysis，整理成可落地方案

我这里已经有 spec，帮我判断下一步应该进 task-plan 还是 build

审查最近的改动，并告诉我是否还需要 verify 或 ship
```
