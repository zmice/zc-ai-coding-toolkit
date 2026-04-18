# Toolkit Naming And Source Identity

## Objective

在不牺牲上游同步效率和准确性的前提下，优化 `toolkit` 内部资产的命名体验。

本规则解决两个经常互相冲突的目标：

1. 用户希望看到更短、更清晰、更一致的命名
2. 治理层仍然需要稳定追踪“本地资产对应上游什么对象”

结论：

- 不把“用户显示名”直接等同于“上游对象名”
- 不把“本地 canonical id”直接等同于“用户看到的标题”
- 通过三层身份分离，同时满足可读性和可追溯性

## Three Identity Layers

### 1. Source Identity

用于上游同步与审阅匹配。

字段放在 `meta.yaml -> source`：

```yaml
source:
  upstream: agent-skills
  strategy: adapted
  origin_name: planning-and-task-breakdown
  origin_path: skills/planning-and-task-breakdown/SKILL.md
  origin_id: skill:planning-and-task-breakdown
```

语义：

- `upstream`
  - 本地资产来自哪个已登记上游
- `origin_name`
  - 上游对象原始名称
- `origin_path`
  - 上游对象路径或目录
- `origin_id`
  - 如已知，记录上游对象的稳定标识

这层的目标不是“好看”，而是“能对上游”。

### 2. Workspace Identity

用于本仓库内部 canonical 引用：

- 目录名
- `meta.name`
- 资产 `id`
- `requires / suggests / conflicts_with / supersedes`

规则：

- 保持稳定
- 风格统一
- 只在收益显著时重命名

当前阶段不对已有 `id/name/path` 做大规模 breaking rename。

### 3. Display Title

用于用户可见展示：

- CLI `show/search/recommend`
- platform 生成产物
- 文档和说明

规则：

- 中文优先
- 尽量短
- 一眼能看懂功能定位

`title` 可以与 `name` 不同，不承担上游映射职责。

## Naming Rules

### Skills

- `name/id` 保持与上游语义接近
- `title` 可以中文化和简化
- 不轻易为“好看”改 skill slug

示例：

- `planning-and-task-breakdown`
  - title: `任务拆解`
- `verification-before-completion`
  - title: `完成前验证`
- `using-agent-skills`
  - title: `技能发现`
- `brainstorming-and-design`
  - title: `方案探索`

### Commands

- 作为产品入口，优先优化显示名
- `title` 可短于 `name`
- 仅在后续确有必要时再考虑 workspace 级 rename

示例：

- `task-plan`
  - title: `计划`
- `quality-review`
  - title: `审查`
- `plan-review`
  - title: `方案评审`
- `ctx-health`
  - title: `上下文`
- `doc`
  - title: `文档`
- `secure`
  - title: `安全`
- `sdd-tdd`
  - title: `工作流`

### Agents

- 保持角色语义
- 用中文 title 提高可理解性
- 不急于修改内部 slug

示例：

- `backend-specialist`
  - title: `后端工程师`
- `frontend-specialist`
  - title: `前端工程师`
- `code-reviewer`
  - title: `代码审查`

## Sync Rules

### When Source Mapping Is Required

以下情况应尽量补齐 `origin_name/origin_path`：

- 资产直接改写自上游某个明确对象
- 该资产后续很可能继续参考上游演进
- 该资产是核心 workflow / command / principle

### When Source Mapping Can Stay Coarse

以下情况允许仅保留 `upstream + strategy + notes`：

- 只是抽取了上游思想，没有明确单一源文件
- 属于本仓库自创整理入口
- 当前 snapshot 还无法精确定位对象

### Accuracy Over Coverage

不要为了“字段齐全”而虚构 `origin_path`。

如果路径不确定：

- 可以先写 `origin_name`
- 或仅保留 `notes`
- 等 snapshot 和审阅材料更完整后再补

## First Batch

本轮先处理高频资产：

### Skills

- `planning-and-task-breakdown` -> `任务拆解`
- `verification-before-completion` -> `完成前验证`
- `using-agent-skills` -> `技能发现`
- `brainstorming-and-design` -> `方案探索`
- `sdd-tdd-workflow` -> 保持 slug，补 `origin_*`

### Commands

- `spec` -> `规格`
- `task-plan` -> `计划`
- `quality-review` -> `审查`
- `plan-review` -> `方案评审`
- `ctx-health` -> `上下文`
- `doc` -> `文档`
- `secure` -> `安全`
- `sdd-tdd` -> `工作流`

### Agents

- `backend-specialist` -> `后端工程师`
- `frontend-specialist` -> `前端工程师`
- `code-reviewer` -> `代码审查`

## Success Criteria

- 用户可见名称更短、更统一
- 上游同步仍能明确知道“本地资产从哪里来”
- `toolkit` 不需要为了改名破坏内部关系图
- 后续 upstream diff/report/import 能基于 `source.origin_*` 逐步提高匹配精度
