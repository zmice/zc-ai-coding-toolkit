# Context Budget Audit

## Overview

分析当前加载的所有组件的 Token 开销，找出膨胀点和冗余项，输出可操作的优化建议。与 `instructions.md` 中的 40% 上下文法则配合使用。

**核心问题：你的上下文窗口里有多少是信号，多少是噪声？**

## When to Use

- 会话表现迟缓或输出质量下降
- 最近添加了新的 Skills、Agents 或 MCP 服务
- 想知道实际还有多少上下文空间可用
- 计划添加更多组件，需要确认是否有空间
- 执行 `/ctx-health` 命令时的辅助审计

## 审计流程

### 阶段 1：盘点（Inventory）

扫描所有组件目录，估算 Token 消耗：

**Agents（agents/*.md）**
- 统计每个文件的行数和 Token 数（单词数 × 1.3）
- 提取 description 前置数据长度
- 标记：文件 >200 行（过重）、description >30 词（前置数据臃肿）

**Skills（skills/*/SKILL.md）**
- 统计每个 SKILL.md 的 Token 数
- 标记：文件 >400 行
- 检查是否有重复副本

**Instructions（instructions.md 和平台指令文件）**
- 统计 Token 数
- 标记：合计 >300 行

**Commands（commands/*.md）**
- 统计每个命令文件的 Token 数
- 标记：单文件 >50 行

### 阶段 2：分类（Classify）

将每个组件归入分类桶：

| 分类 | 标准 | 建议 |
|------|------|------|
| **始终需要** | 在 instructions 中引用、支撑活跃命令、或匹配当前项目类型 | 保留 |
| **按需需要** | 领域特定（如特定语言模式），未在 instructions 中引用 | 考虑按需激活 |
| **很少需要** | 无命令引用、内容重叠、或与项目无明显关联 | 移除或延迟加载 |

### 阶段 3：检测问题（Detect Issues）

识别以下问题模式：

- **臃肿的 Agent 描述** — description >30 词，会在每次 Agent 调用时加载
- **过重的 Agent** — 文件 >200 行，膨胀每次子代理的上下文
- **冗余组件** — Skill 重复 Agent 的逻辑、命令重复 Instructions 的内容
- **过量工具** — MCP 服务器过多，或包装了本就可用的 CLI 工具
- **Instructions 膨胀** — 冗长解释、过时章节、应该是规则的指令

### 阶段 4：报告（Report）

输出结构化报告：

```
上下文预算报告
═══════════════════════════════════════

总估算开销：~XX,XXX tokens
模型上下文窗口：XXX K
有效可用上下文：~XXX,XXX tokens (XX%)

组件分解：
┌─────────────────┬────────┬───────────┐
│ 组件             │ 数量   │ Tokens    │
├─────────────────┼────────┼───────────┤
│ Agents          │ N      │ ~X,XXX    │
│ Skills          │ N      │ ~X,XXX    │
│ Commands        │ N      │ ~X,XXX    │
│ Instructions    │ N      │ ~X,XXX    │
│ MCP 工具        │ N      │ ~XX,XXX   │
└─────────────────┴────────┴───────────┘

⚠ 发现问题 (N 个)：
[按 Token 节省量排序]

前 3 项优化建议：
1. [操作] → 节省 ~X,XXX tokens
2. [操作] → 节省 ~X,XXX tokens
3. [操作] → 节省 ~X,XXX tokens

潜在节省：~XX,XXX tokens (当前开销的 XX%)
```

## Token 估算方法

| 内容类型 | 估算公式 |
|---------|---------|
| 散文/文档 | 单词数 × 1.3 |
| 代码密集文件 | 字符数 / 4 |
| MCP 工具 | 每个工具 ~500 tokens（Schema 开销）|

## 常见优化杠杆

按影响大小排序：

1. **MCP 工具是最大杠杆** — 每个工具 Schema 约 500 tokens；一个 30 工具的服务器比所有 Skills 加起来还贵
2. **Agent 描述永远加载** — 即使 Agent 从未被调用，其 description 字段也存在于每次 Agent 调用的上下文中
3. **Skills 相对轻量** — 通常只在触发时加载
4. **Instructions 是常驻成本** — 每条指令都始终存在

## 与其他技能的衔接

- **context-engineering** — 提供上下文管理策略，本技能提供量化审计
- **sdd-tdd-workflow** — 长会话中定期触发预算检查
- `/ctx-health` 命令 — 可在上下文健康检查时同时运行预算审计

## 最佳实践

- 添加任何新 Agent、Skill 或 MCP 服务后运行审计
- 保持总上下文开销在 40% 以下（与全局指令的 40% 法则一致）
- 优先削减 MCP 工具和臃肿 Agent 描述
- 定期审计，防止渐进式膨胀

## Red Flags

- 总上下文开销超过 40% 但继续添加组件
- Agent 描述超过 30 词但不精简
- 存在从未被触发的 Skill 但一直加载
- MCP 服务包装了本就可用的 CLI 命令（如 git、npm）
- 多个组件的内容高度重叠
