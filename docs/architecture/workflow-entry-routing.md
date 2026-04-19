# Workflow Entry Routing

## 背景

当前 `toolkit` 的 workflow 内容已经覆盖了从想法澄清、规格编写、任务拆解、实现、审查到发布回顾的大部分阶段能力，但“任务开始入口”仍然偏分散：

- 完整流程入口是 `command:sdd-tdd`
- 阶段入口是 `command:spec / task-plan / build / quality-review / verify`
- 专项入口是 `command:debug / doc / ship / api / secure / perf / ui / ci ...`

这些入口本身都合理，但现在缺少一个统一的“先判型，再路由”的入口层。结果是：

- 用户需要先自己判断该用哪个命令
- `sdd-tdd` 更像全流程 workflow，而不是任务 intake / dispatch 入口
- `toolkit recommend` 当前基于关系图，只能回答“相关资产是什么”，还不能回答“这个任务应该从哪条 workflow 开始”

## 当前组织问题

### 1. 命令面按历史形成，未按任务判型组织

现在的命令主要分成三类，但这三类在内容层没有被明确标出来：

- 生命周期阶段命令
  - `sdd-tdd`
  - `spec`
  - `task-plan`
  - `build`
  - `quality-review`
  - `verify`
- 专项处理命令
  - `debug`
  - `doc`
  - `ship`
  - `ci`
  - `secure`
  - `perf`
  - `ui`
- 辅助/防护命令
  - `ctx-health`
  - `careful`
  - `freeze`
  - `guard`
  - `learn`
  - `retro`

问题不在数量，而在缺少“首入口层”。当前用户看到的是命令表，而不是工作流路由图。

### 2. `sdd-tdd` 是 workflow，不是路由器

`command:sdd-tdd` 现在承担的是“完整开发生命周期”入口。但它没有显式回答这些任务差异：

- 这是新功能还是 Bug
- 需求是否模糊
- 当前在 DEFINE / PLAN / BUILD / REVIEW 哪个阶段
- 是开发任务，还是调试、文档、发布、审查任务
- 是否需要完整六阶段门控，还是只需要局部 workflow

所以它适合作为“默认主流程”，但还不适合作为“统一开始入口”。

### 3. 阶段命令和任务命令混在一起

例如：

- `spec` 是阶段入口
- `debug` 是任务类型入口
- `quality-review` 是阶段入口
- `doc` / `ship` 是专项收尾入口

这会导致用户记的是“命令名”，而不是“任务类型 -> workflow”。

### 4. 缺少显式任务评估模型

当前内容里已经隐含有任务判型逻辑，但没有被结构化：

- 模糊需求 -> `brainstorming-and-design` / `spec`
- 非平凡开发 -> `sdd-tdd`
- Bug -> `debug` + `build`
- 实现完成 -> `quality-review`
- 准备声明完成 -> `verify`

这些规则分散在多个 skill 正文中，没有一张统一的 intake matrix。

## 目标

建立一个统一的任务开始入口，让用户先描述任务，再由系统进行任务评估，并路由到合适的 workflow。

目标不是再增加很多命令，而是增加一个明确的“入口层”。

## 设计原则

### 1. 统一入口优先，阶段入口保留

保留当前阶段命令，因为它们对熟练用户仍然高效。

但新增一个统一入口层，用于：

- 判断任务类型
- 判断阶段位置
- 推荐完整 workflow 或局部 workflow

### 2. 先判型，再选流程

入口层必须先做任务评估，至少回答：

- 任务类型是什么
- 是否需要完整 SDD+TDD
- 当前最合适的开始阶段是什么
- 是否应该先走专项 workflow

### 3. workflow 组织按“任务形状”而非“命令清单”

内容结构要从“列出所有命令”转成“定义几类标准 workflow”：

- 新功能 / 新项目
- Bug / 异常行为
- 审查 / 响应 / 收尾
- 文档 / 发布 / 运营
- 调查 / onboarding / context 修复

### 4. `sdd-tdd` 仍保留，但降为主 workflow，不再假定它是唯一开始方式

`sdd-tdd` 仍然是默认主开发 workflow。

但统一入口应该能告诉用户：

- 这次应该进 `sdd-tdd`
- 还是只进 `debug`
- 还是只进 `quality-review`
- 还是从 `doc` / `ship` / `ci` 开始

### 5. canonical command 与平台暴露方式分离

`toolkit` 中的 `command` 应视为统一任务语义，不应默认等于“每个平台都有这个原生命令”。

这点对 Codex 特别重要：

- Codex 依赖 `AGENTS.md` 与自然语言指令
- 它没有与 Qwen / Qoder 对等的自定义 slash command 机制

因此后续设计必须区分两层：

- canonical command
  - 仓库内部稳定入口语义
  - 用于关系图、lint、routing、recommend
- platform exposure
  - 各平台把这条入口怎么暴露给用户
  - 可能是命令式入口文案
  - 也可能是自然语言入口模板
  - 也可能只是 `AGENTS.md` / `QWEN.md` 中的“建议从这里开始”

## 统一入口模型

### 推荐新增入口

建议新增一个统一入口命令：

- `command:start`

显示名建议为：

- `开始`

它的职责不是直接执行所有事情，而是：

1. 对任务做 intake
2. 进行任务判型
3. 选择 workflow
4. 给出下一条推荐命令或直接进入对应 workflow

注意：

- 在 `toolkit` 中它可以叫 `command:start`
- 它是内容模型里的 canonical command，不是已实现的 CLI 子命令
- 当前阶段没有 `zc start`
- 在任何平台上，都不应先假定存在同名原生命令
- Codex 侧更合理的暴露方式是：
  - 在 `AGENTS.md` 中把它呈现为“统一任务开始方式”
  - 附自然语言触发模板
  - 强调“先判型，再进对应 workflow”

### `start` 应回答的 5 个问题

#### 1. 任务性质

- 新功能 / 新项目
- Bug / 异常行为
- 审查 / 验证
- 文档 / 发布 / CI
- 调研 / 理解 / 上下文修复

#### 2. 需求清晰度

- 清晰
- 部分清晰
- 模糊

#### 3. 当前阶段

- 还未定义
- 已有 spec
- 已有 plan
- 正在 build
- build 完成待 review
- review 后待收尾

#### 4. 风险等级

- trivial
- standard
- high-risk

#### 5. 交付类型

- code
- review
- docs
- release
- investigation

## 标准 workflow 家族

统一入口背后，应显式组织为几类 workflow family。

### A. Full Delivery Workflow

适用：

- 新功能
- 新项目
- 复杂重构
- 范围不小于一个垂直切片的需求

路由：

- `brainstorming-and-design`（必要时）
- `spec`
- `plan-review`（可选）
- `task-plan`
- `build`
- `quality-review`
- `verify`
- `commit`
- `retro`

默认入口：

- `sdd-tdd`

### B. Bugfix Workflow

适用：

- 异常行为
- 测试失败
- 构建失败
- 线上问题回放

路由：

- `debug`
- `build`
- `verify`
- `quality-review`

必要时补：

- `spec`

### C. Review Closure Workflow

适用：

- 代码审查
- review 响应
- 分支收尾

路由：

- `quality-review`
- `review-response-and-resolution`
- `branch-finish-and-cleanup`
- `verify`

### D. Documentation / Release Workflow

适用：

- 文档补齐
- ADR
- 发布说明
- 发布前后同步

路由：

- `doc`
- `release-documentation-sync`
- `ship`
- `verify`

### E. Investigation / Context Workflow

适用：

- 陌生代码库
- 会话质量下降
- 需要重新理解上下文
- 需要建立任务进入前的最小上下文

路由：

- `onboard`
- `ctx-health`
- `context-budget-audit`
- `idea`

## 内容层组织建议

`toolkit` 中与 workflow 有关的内容应重新按 4 层理解。

### Layer 1: Intake

统一入口层：

- `command:start`（新增）

职责：

- intake
- task classification
- workflow routing

### Layer 2: Core Lifecycle

主开发生命周期：

- `command:sdd-tdd`
- `command:spec`
- `command:plan-review`
- `command:task-plan`
- `command:build`
- `command:quality-review`
- `command:verify`
- `command:commit`
- `command:retro`

### Layer 3: Specialized Workflow

专项 workflow：

- `command:debug`
- `command:doc`
- `command:ship`
- `command:ci`
- `command:api`
- `command:secure`
- `command:perf`
- `command:ui`
- `command:migrate`
- `command:onboard`
- `command:ctx-health`

### Layer 4: Guardrails / Support

辅助与防护：

- `command:careful`
- `command:freeze`
- `command:guard`
- `command:learn`

## 平台适配约束

### Qwen / Qoder

这两个平台可以更接近“命令入口”心智，但当前仍应按“命令式入口文案”处理：

- 可以把 `command:*` 组织成用户可见入口能力
- 文案里可以用接近命令的表达
- 平台产物可以强调“输入该入口后会进入什么 workflow”

但不要提前承诺：

- 存在同名平台原生命令
- 已经存在统一的 `zc:*` 触发器
- 已经存在真正的 slash command 或内置命令机制

### Codex

Codex 不能直接套用 slash command 心智。

因此在 Codex 上应采用以下适配：

1. `command` 仍然保留在 `toolkit`
   - 它仍是统一任务语义
   - 也是关系图、recommend、lint 的基础对象

2. `platform-codex` 不暴露“命令清单 UI”
   - 而是把 command 渲染成：
     - 入口能力说明
     - 任务判型规则
     - 推荐自然语言启动模板

3. `start` 在 Codex 上应被呈现为：
   - “统一任务开始方式”
   - 而不是“Codex 有 `/start` 命令”
   - 也不是“Codex 已实现 `$zc-start` 之类的技能触发名”

4. 文案必须明确区分：
   - canonical command 名称
   - 该平台上的实际触发方式

## 平台暴露命名策略

为了避免与平台内置命令冲突，平台暴露层应采用“命令式入口文案”或“自然语言模板”，而不是把 canonical command 直接承诺为平台原生命令。

推荐映射矩阵：

| canonical command | Codex exposure | Qwen exposure | Qoder exposure |
| --- | --- | --- | --- |
| `start` | `AGENTS.md` 中的统一任务开始方式与自然语言模板 | `QWEN.md` 中的命令式入口文案 | `AGENTS.md` 中的命令式入口文案 |
| `spec` | 路由说明 + 自然语言示例 | 命令式入口文案 | 命令式入口文案 |
| `task-plan` | 路由说明 + 自然语言示例 | 命令式入口文案 | 命令式入口文案 |
| `build` | 路由说明 + 自然语言示例 | 命令式入口文案 | 命令式入口文案 |
| `quality-review` | 路由说明 + 自然语言示例 | 命令式入口文案 | 命令式入口文案 |
| `verify` | 路由说明 + 自然语言示例 | 命令式入口文案 | 命令式入口文案 |

其中：

- Codex 保持自然语言入口，不把 command 等同于 slash/skill trigger
- Qwen / Qoder 可以使用更接近命令的呈现方式，但不提前承诺真实触发机制

## 元数据优化建议

为了让统一入口可路由，当前 command/skill 元数据还需要补一层 workflow 路由字段。

建议新增字段：

```yaml
workflow_family: intake | lifecycle | specialized | support
workflow_role: intake-router | workflow-entry | stage-entry | specialized-entry | guardrail | support
task_types:
  - feature
  - bugfix
  - review
  - docs
  - release
  - investigation
platform_exposure:
  codex: prompt-entry
  qwen: command-style
  qoder: command-style
```

这层字段的作用不是给平台展示，而是为 `start`、`recommend` 和后续 CLI 路由提供结构化依据。

其中 `platform_exposure` 的职责是：

- 明确 command 在不同平台上的暴露方式
- 避免把 canonical command 误解释成平台原生命令
- 为 `platform-*` 生成器提供正确渲染策略

## CLI / 产品面建议

后续如果进入 CLI 实现阶段，可以考虑提供一个统一任务入口，用来接住：

- 新功能 / 新项目
- Bug / 异常行为
- 审查 / 收尾
- 文档 / 发布
- 调研 / 上下文修复

但这不是当前阶段的交付目标。当前阶段只要求：

- `toolkit` 中存在统一入口语义 `command:start`
- `recommend / show / search` 能消费 workflow 路由元数据
- 平台文档能表达“统一入口是内容模型，不是平台必然存在的原生命令”

如果未来真的实现 `zc start`，它返回的核心结果应包括：

- 判定的任务类型
- 推荐 workflow
- 当前建议起始命令
- 必需和建议资产
- 是否需要完整门控

## 对当前内容的结论

当前内容本身不是不足，而是“缺少入口编排层”。

已经有的内容：

- workflow 主干已齐
- 专项 skill 已齐
- review / release / branch closure 已齐
- principles / guardrails / context 已齐

真正缺的只有两件事：

1. 一个统一的 task intake / routing 入口
2. 一套显式的 workflow family / task type / platform exposure 元数据

## 实施顺序

### Phase 1

只做内容建模，不动 CLI：

- 新增 `command:start`
- 新增 workflow 路由规范
- 为核心 commands 补：
  - `workflow_family`
  - `workflow_role`
  - `task_types`
  - `platform_exposure`

### Phase 2

强化内容关系：

- 把 command/skill 按 workflow family 归组
- 调整 `recommend` 的输出结构

### Phase 3

再考虑 CLI 实现：

- 统一任务入口 CLI（例如 `zc start`）
- 更强的 `toolkit recommend`

## 不做的事

- 不把所有现有命令重命名一遍
- 不删掉阶段命令
- 不让统一入口替代所有高级用户的直接命令调用
- 不在这轮里同时改 CLI、toolkit schema、platform 文档

## 当前建议

当前最合理的下一步不是先改 CLI，而是：

1. 先在 `toolkit` 里引入统一入口命令 `start`
2. 先把 workflow family 元数据补齐
3. 再让 CLI 消费这套模型

这样可以保证：

- 内容先稳定
- CLI 不抢跑
- 平台层仍然只消费 `toolkit`
- Codex 适配不会被错误设计成“伪 slash command”
