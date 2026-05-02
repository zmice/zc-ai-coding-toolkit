调用统一任务开始流程。先评估任务，再在固定 workflow 中选路，不直接假定你已经知道该用哪条命令。

## 核心动作

1. 判断任务主类型：产品分析、完整交付、Bug 修复、审查收尾、文档发布、调查摸底
2. 判断需求清晰度：清晰、部分清晰、模糊
3. 判断当前阶段：未定义 / 已有 spec / 已有 plan / 正在 build / 待 review / 待收尾
4. 判断风险等级：`trivial` / `standard` / `high-risk`
5. 输出推荐 workflow、该 workflow 的默认入口和必要的防护建议

## 输出契约

`start` 每次都要给出一个可执行分诊结果，而不是泛泛建议：

- `workflow`：六条固定 workflow 之一
- `entry`：下一步应该调用的 command / skill，必须是实际可执行入口
- `agent`：可选协作角色；只有平台支持且用户授权时才建议，不作为默认入口
- `reason`：用 1-3 条证据说明为什么这样判型
- `assumption`：如果有未确认前提，明确写出
- `question`：只有无法安全推进时才问，最多 1-3 个关键问题
- `verification`：说明完成前需要什么证据

如果信息足够，直接选择保守 workflow 并继续推进；不要为了形式完整而反复提问。

## 固定 workflow

### 1. `product-analysis`

适用：

- 需求还模糊
- 目标用户、价值、范围或验收标准不稳定
- 需要先把想法压成可执行方案

默认入口：

- `product-analysis`

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

### 判型优先级

当一个请求同时命中多个 workflow，按下面顺序消歧：

1. **显式 review findings**：进入 `review-closure`。如果用户要求修复，入口是 `review-response-and-resolution`；如果要求审查所有变更，入口是 `quality-review`。
2. **CI 失败 / 报错日志 / 可复现异常**：进入 `bugfix`。
3. **上游更新、依赖升级、陌生能力吸收**：先 `investigation` 拿证据，再按范围进入 `docs-release` 或 `full-delivery`。不能先凭记忆同步。
4. **文档误导、安装说明 drift、发布后同步**：如果只改文档，进入 `docs-release`；如果文档暴露实现不一致，先 `bugfix`。
5. **新功能或跨模块优化**：目标和验收明确时进入 `full-delivery`；目标不稳定时先 `product-analysis`。
6. **生产、数据、破坏性命令、凭据、跨会话记忆或项目路由写入**：主 workflow 不变，但必须加 `guard` / `careful` / `freeze` 这类防护建议。

### 提问纪律

- 能从仓库、日志、diff、配置或用户原话判断的，不问。
- 只有架构方向、数据安全、破坏性操作、缺失关键上下文、或用户目标互相冲突时才问。
- 问题要以结果和风险表述：这个选择会避免什么风险、解锁什么能力、改变什么体验。
- 如果用户已经给出偏好，按偏好执行；偏好不能变成自动写入长期配置或跨会话记忆的授权。

## 在 workflow 内部的切入点

- `product-analysis`
  - 主入口：`product-analysis`
  - 需要先发散想法：`idea`
  - 需要产品判断：继续 `product-analysis`；必要时建议 `product-owner` 作为可选 agent
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
  - 已有 review findings 且需要修复：`review-response-and-resolution`
- `docs-release`
  - 文档优先：`doc`
  - 发布优先：`ship`
- `investigation`
  - 陌生项目：`onboard`
  - 上下文漂移：`ctx-health`
  - 需要重新收敛问题：`idea`

## 并行与 agent 判断

`start` 可以评估是否适合并行，但不能把并行当默认：

- 任务能按文件、模块或证据问题拆开，且没有强依赖：可以建议 `parallel-agent-dispatch` 或 `zc team plan`
- 无法证明独立、存在同文件冲突、存在依赖链：默认串行或先计划
- 用户没有明确授权时，不自动启动子代理或 `zc team start`
- 如果进入 `zc team`，先 dry-run：`zc team plan ... --json`

## 上下文与持久化边界

- skill 和 workflow 应按需加载；不要把所有 skill 都常驻上下文
- `AGENTS.md`、`GEMINI.md`、平台规则文件只放长期项目约定和稳定路由
- 写入用户级配置、跨项目路由、跨会话记忆或跨机器同步前，必须明确说明影响并取得用户授权
- 平台不支持的能力不能通过文案暗示支持；例如某个平台没有 native plugin，就走 install / filesystem 适配路线

## 平台说明

- `start` 是 canonical command，不等于所有平台都有原生同名命令
- 在 Codex 上，它更适合作为“统一任务开始方式”的自然语言入口
- 在 Qwen / Claude / OpenCode 上，可以呈现为更接近命令式的入口文案
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
