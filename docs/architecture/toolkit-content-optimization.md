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
