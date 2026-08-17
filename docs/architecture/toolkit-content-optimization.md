# Toolkit Content Optimization

## Objective

在不破坏当前 `toolkit` canonical source model 的前提下，把内容层从“已统一存储”升级到“可治理、可组合、可持续吸收上游”的状态。

本优化聚焦三个问题：

1. `toolkit` 当前元数据骨架过薄，难以表达内容优先级、依赖关系和来源
2. 外部 upstream 已经明确存在，但还没有系统映射到内容治理动作
3. 平台生成和 CLI 消费仍然更像“平铺资产”，还不够“按场景选择内容”

## Current Baseline

当前 `toolkit` 已经完成：

- 统一目录模型：`meta.yaml + body.md + assets/`
- 统一种类：`skill | command | agent`
- 基础元数据字段：
  - `kind`
  - `name`
  - `title`
  - `description`
  - `tags?`
  - `tools?`
  - `platforms?`

当前缺口：

- 没有 `tier / audience / stability`
- 没有 `requires / suggests / conflicts_with / supersedes`
- 没有 `source / provenance`
- 没有内容 lint
- 没有基于场景的索引和推荐

## Upstream Mapping

### `agent-skills`

定位：主 upstream，提供 skill/command 生命周期和方法论骨架。

应吸收：

- skill workflow 结构
- command 到 workflow 的入口映射
- lifecycle consistency

不应直接复制：

- 上游目录布局
- 未经筛选的原始提示词表述

对应优化：

- 建立 `requires / suggests`
- 建立 `aliases / entrypoints`
- 做 skill-command 显式映射

### `superpowers`

定位：方法学和 agentic execution 参考。

应吸收：

- composable skills 思路
- review / execution 分层
- 面向复杂任务的 methodology framing

对应优化：

- 建立内容分级：`core | recommended | optional | experimental`
- 建立“组合包”视角，而不是只看单个资产

### `everything-claude-code`

定位：治理与规模化经验参考。

应吸收：

- manifests / schemas / contexts 的治理意识
- 大规模内容资产下的组织和防膨胀策略
- research-first / memory / instinct 这类跨资产约束思路

对应优化：

- 建立 content lint
- 建立 provenance 字段
- 建立重复/冗余检测

### `gstack`

定位：产品化命令层和角色化工具体验参考。

应吸收：

- command surface 的产品化命名
- plan/review/design/devex 等高层任务入口
- 角色能力与命令体验之间的映射

对应优化：

- 建立按场景检索索引
- 建立“入口命令”和“底层 skill”之间的关系图
- 提升 CLI recommendation 能力

### `andrej-karpathy-skills`

定位：行为约束与最小原则参考。

应吸收：

- think before coding
- simplicity first
- surgical changes
- goal-driven execution

对应优化：

- 建立 cross-cutting principles 层
- 把通用行为原则从单个 skill 中抽离成可复用的治理约束
- 为内容 lint 增加“过度工程 / 越界修改 / 不明确成功标准”这类检查维度

## Recommended Model Upgrade

### 1. Meta Schema 扩展

为 `meta.yaml` 增加以下字段：

```yaml
tier: core
audience: default
stability: stable
aliases: []
requires: []
suggests: []
conflicts_with: []
supersedes: []
source:
  upstream: agent-skills
  strategy: adapted
  notes: ""
```

说明：

- `tier`
  - 解决“哪些内容默认暴露”
- `audience`
  - 解决“给普通用户还是维护者”
- `stability`
  - 解决“实验内容不应默认进入所有平台”
- `aliases`
  - 解决命令/技能入口别名
- `requires / suggests / conflicts_with / supersedes`
  - 解决组合关系
- `source`
  - 解决 upstream 可追溯性

来源追溯规则：

- `toolkit-original`
  - 允许没有 `origin_*`
  - 但要用 `strategy: curated` 说明它是仓库内部沉淀资产
- 外部 upstream + `strategy: adapted`
  - 必须补齐 `origin_name / origin_path / origin_id`
  - 因为后续 diff、snapshot 和人工同步需要精确落点
- 外部 upstream + `strategy: inspired`
  - 允许不做 1:1 对象映射
  - 但必须保留 `source.notes`，解释吸收边界和改写方式

### 2. Content Lint

新增内容治理校验，至少覆盖：

- 缺少中文摘要
- title / description 语义重复
- tags 为空或重复
- 依赖指向不存在资产
- conflict/supersede 形成循环
- 同类资产正文高度重复
- 缺少 source 字段
- `experimental` 内容被标为所有平台默认暴露

### 2.1 AI Asset Authoring Contract

`skills / commands / agents` 是 AI 资产，不是普通文档。每次改动都必须先说明它要修复哪类失败，再用证据证明 guidance 有效。

门禁：

- `meta.yaml.description` 只写触发条件和适用场景，不写命令清单、完整生命周期或平台安装细节。
- `body.md` 承载当前阶段 quick path、决策门、输出格式和验证要求；长 checklist、示例和平台细节放进 `assets/` 或专项 skill。
- 新增 guidance 前先记录 failure baseline：路由失败、越界写入、验证缺失、上下文过载、平台能力误判或输出不可消费。
- guidance 按失败类型分类，不用大段通用原则覆盖局部问题。
- 高影响 guidance 至少做一次 micro-test：同一个任务在 no-guidance control 和新 guidance 下比较首轮输出，确认误触发、token 成本和行为改善。
- 部署前必须留下证据：`toolkit lint`、相关测试、必要的平台生成 / 安装 dry-run 或人工审阅结论。

### 3. Search / Recommend Index

在 manifest 层增加索引：

- by tag
- by platform
- by tier
- by audience
- by alias
- by dependency graph

目标能力：

- `zc toolkit search`
- `zc toolkit show`
- `zc toolkit recommend`

### 4. Principle Layer

把跨资产重复出现的行为原则抽成单独治理层，而不是散落在多个 skill/command 中。

推荐先抽的原则：

- clarify before coding
- simplicity first
- surgical changes
- verify before claim
- manual review for high-risk syncs

这些原则不一定都变成单独 skill，但应该成为：

- lint 规则来源
- 平台模板可插入片段
- 高层 workflow 的共享约束

## Delivery Order

### Phase 1: Schema & Provenance

- 扩展 `ToolkitAssetMeta`
- 扩展 schema validator
- 给高优先资产补 `tier / audience / stability / source`

### Phase 2: Content Lint

- 增加 `toolkit lint`
- 校验依赖、来源、重复度、字段完整性

### Phase 3: Relationship Graph

- 增加 `requires / suggests / conflicts_with / supersedes`
- 建立 manifest graph

### Phase 4: Search / Recommend

- 增加 CLI 查询和推荐入口
- 平台生成开始按 `tier` 和 `audience` 选择内容

## Success Criteria

- 每个 `toolkit` 资产都有明确治理属性，而不是只有展示属性
- 每个外部 upstream 都能映射到明确的内容治理动作
- CLI 和 platform 不再被迫平铺全部内容
- `toolkit` 可以回答：
  - 这条内容来自哪里
  - 默认应该给谁
  - 它依赖谁
  - 它和什么冲突
  - 它是不是核心内容

## 2026-07-29 Upstream Review

本轮对全部已登记 upstream 执行远端 HEAD 与登记路径 diff，并为发生变化或新增候选的项目追加不可变 snapshot。结论：

- `agent-skills`、`andrej-karpathy-skills`：远端 HEAD 未变化，保留现有基线
- `superpowers`：吸收 plan-scoped scratch / ledger、原 producer 优先返工、scoped re-review、bounded circuit breaker 和 high-signal test 机制
- `everything-claude-code`：仅吸收大目录治理、平台边界与渐进式披露经验，不复制整套运行时
- `gstack`：修正已经失效的 `source_paths`，保留产品化入口和 DevEx 视角，不引入其浏览器运行时

联网候选按“维护主体、活跃度、可验证来源、许可证边界、与当前缺口的互补性”筛选：

| Upstream | 采用状态 | 吸收内容 | 边界 |
|---|---|---|---|
| `openai/plugins` | active | Codex plugin 原生 `commands / skills / agents` 结构，skill/plugin 评测闭环 | 不复制 connector、凭据、MCP 二进制或第三方插件内容 |
| `anthropics/skills` | active | baseline/candidate 行为对照、客观断言与人工判断分离 | 每个目录单独核对许可证，不复制文档类 skill |
| `github/awesome-copilot` | active | metadata、链接、目录身份和资产体量的机器校验 | 不镜像社区 prompt 大目录，不套用 Copilot 路径约定 |
| `vercel-labs/agent-skills` | reference-only content | 渐进式披露、脚本 stdout/stderr、清理与失败契约 | reviewed snapshot 无统一顶层许可证，具体内容不复制 |

明确拒绝：

- `openai/skills` 已被官方标为 deprecated，并指向 `openai/plugins`，不再登记为 active upstream
- `wshobson/agents` 虽然目录规模和社区关注度较高，但与现有资产重叠且会显著增加发现噪声，只作为市场观察，不纳入 registry
- 热度不是内容准入条件；不能确认许可证或需要平台专属运行时的内容，只吸收抽象机制或保留观察记录

### Delivered Upgrade

- 新增 `skill-authoring-and-evaluation`，把结构 lint 扩展为 baseline/candidate 行为评测
- `using-agent-skills` 与 `subagent-driven-development` 缩短常驻正文，把完整协议移入一层 reference
- TDD 增加高信号测试清单：可证伪、独立期望和 mutation sanity check
- Codex plugin bundle 原生生成 `commands/*.md`、`skills/*/SKILL.md`、`agents/*.md`
- local marketplace 不再通过 `.codex/config.toml` 注册 plugin agent；传统 direct install 仍保留 TOML companion 兼容路径
- `--force` 更新同时清理受管的 plugin `commands / skills / agents` 目录，避免旧资产残留

后续若要引入可执行 benchmark harness，必须先固定跨模型报告 schema、成本上限和维护责任人；当前只交付可移植的评测契约。

### 2026-08-17 Lifecycle Correction

`openai/plugins` 已由 OpenAI 于 2026-08-16 归档，远端 HEAD 仍为 `11c74d6ba24d3a6d48f54a194cd00ef3beea18f9`。上表保留 2026-07-29 当次审阅结论，但从本次起该仓库降为历史 plugin-layout reference；当前 Codex plugin、custom agent、subagent runtime 和权限行为以官方 Plugins、Subagents、Config Reference 及实际 runtime smoke 为准。

当前项目对齐状态和 Multi-agent V2 升级任务见 `references/notes/codex-multi-agent-execution-plan.md`。
