# Continuous Learning

## Overview

将开发会话转化为可复用知识。通过 hooks 自动观察工具使用、用户纠正和错误修复模式，提取为原子化的"本能"（instinct），并随时间演化为正式的技能和命令。

**核心模式：观察（Observe）→ 提取（Extract）→ 持久化（Persist）→ 演化（Evolve）**

## When to Use

- 启用自动学习（配置 hooks）
- 手动触发会话模式提取（`/learn`）
- 审查和管理已学习的 instincts
- 将高频 instincts 演化为正式 skills/commands
- Sprint 回顾时自动触发学习提取（`/retro` 集成）

## 架构

```
会话活动（工具调用、用户输入、错误修复）
    │
    │  Hooks 自动捕获（100% 可靠，确定性执行）
    │  PostToolUse / UserPromptSubmit / Stop
    ▼
┌──────────────────────────────────────────────┐
│  observations.jsonl（本地文件）                │
│  记录：工具调用、用户纠正、错误解决路径        │
│  项目级：projects/<project-hash>/              │
└──────────────────────────────────────────────┘
    │
    │  /learn 触发模式分析（手动或 Stop hook 提醒）
    ▼
┌──────────────────────────────────────────────┐
│  模式检测（Pattern Detection）                │
│  · 用户纠正 → instinct（0.8+）               │
│  · 错误→修复 → instinct（0.6-0.7）           │
│  · 重复工作流 → instinct（0.5-0.6）          │
│  · 项目约定 → instinct（0.4-0.5）            │
└──────────────────────────────────────────────┘
    │
    │  双层持久化
    ▼
┌──────────────────────────────────────────────┐
│  本地文件层                                    │
│  instincts/personal/*.yaml（项目或全局）       │
├──────────────────────────────────────────────┤
│  Agent Memory 层                               │
│  高置信度 instinct → learned_skill_experience  │
│  跨会话智能检索，跨项目共享                     │
└──────────────────────────────────────────────┘
    │
    │  /learn evolve — 聚类演化
    ▼
┌──────────────────────────────────────────────┐
│  演化产物                                      │
│  · skills/*.md（新技能）                      │
│  · commands/*.md（新命令）                    │
│  · 全局 instinct（多项目出现时自动提升）       │
└──────────────────────────────────────────────┘
```

## Instinct 模型

一个 instinct 是最小的学习单元 — 一个触发条件对应一个行动：

```yaml
---
id: prefer-named-exports
trigger: "when creating new TypeScript modules"
action: "Use named exports instead of default exports"
confidence: 0.8
domain: code-style
scope: project
project_id: "a1b2c3d4e5f6"
evidence:
  - "User corrected default export to named export on 2026-04-10"
  - "Observed 4 instances of named export preference in codebase"
created: "2026-04-10T14:30:00Z"
updated: "2026-04-12T09:15:00Z"
---
```

### Instinct 属性

| 属性 | 说明 |
|------|------|
| **id** | 唯一标识符，kebab-case |
| **trigger** | 何时触发此本能 |
| **action** | 具体要做什么 |
| **confidence** | 置信度（0.3=试探性，0.6=中等，0.9=近乎确定） |
| **domain** | 领域标签：code-style / testing / git / debugging / workflow / security / performance |
| **scope** | 作用域：project（默认）/ global |
| **project_id** | 项目 hash（scope=project 时） |
| **evidence** | 支持此 instinct 的观察证据列表 |

### 置信度规则

| 来源 | 初始置信度 | 增长规则 |
|------|-----------|---------|
| 用户纠正 | 0.8 | 每次重复 +0.05，上限 0.95 |
| 错误→修复路径 | 0.6 | 每次观察到 +0.05 |
| 重复工作流 | 0.5 | 3+ 次观察后 +0.1 |
| 项目约定推断 | 0.4 | 需 5+ 次观察确认 |

**衰减规则：** 如果后续观察与 instinct 矛盾，置信度 -0.1。置信度 <0.3 的 instinct 自动归档。

### 作用域决策

| 模式类型 | 作用域 | 示例 |
|---------|--------|------|
| 语言/框架约定 | project | "使用 React Hooks"、"遵循 Django REST 模式" |
| 文件结构偏好 | project | "测试放在 `__tests__/`"、"组件放在 `src/components/`" |
| 代码风格 | project | "使用函数式风格"、"偏好 dataclasses" |
| 安全实践 | global | "验证用户输入"、"清理 SQL" |
| 通用最佳实践 | global | "先写测试"、"始终处理错误" |
| 工具工作流 | global | "编辑前先搜索"、"写入前先读取" |
| Git 实践 | global | "约定式提交"、"小而专注的提交" |

## Hook 观察层

### 工作原理

Hooks 是确定性的 — 只要事件触发，脚本就一定执行，不受模型理解偏差影响。与 prompt 指令不同，hooks 提供 100% 可靠的观察能力。

### 支持的 Hook 事件

**核心事件（Qoder + Qwen Code 均支持）：**

| Hook 事件 | 用途 | 触发频率 |
|-----------|------|---------|
| `PostToolUse` | 记录工具调用模式 | 每次工具调用后 |
| `UserPromptSubmit` | 捕获用户纠正和偏好 | 每次用户输入后 |
| `Stop` | 会话结束时触发汇总分析 | 每次 Agent 完成响应 |

**扩展事件（仅 Qwen Code）：**

| Hook 事件 | 用途 |
|-----------|------|
| `SessionStart` | 会话开始时加载已有 instincts |
| `SessionEnd` | 会话结束时执行完整分析 |
| `SubagentStop` | 子代理完成时记录其行为模式 |

### 观察数据格式

每条观察记录为一行 JSON（JSONL 格式）：

```json
{
  "timestamp": "2026-04-14T10:30:00Z",
  "session_id": "sess_abc123",
  "event": "PostToolUse",
  "project_id": "a1b2c3d4e5f6",
  "tool_name": "Edit",
  "tool_input_summary": "Modified src/auth/login.ts: added input validation",
  "tool_outcome": "success",
  "context": "User had previously corrected missing validation"
}
```

**存储不存原始数据 — 只存摘要。** 工具输入和输出可能很大，只提取关键信息。

### 文件结构

```
~/.zc/homunculus/
├── observations.jsonl          # 全局观察（无项目时的 fallback）
├── instincts/
│   ├── personal/               # 全局自动学习的 instincts
│   └── inherited/              # 全局导入的 instincts
├── projects/
│   ├── a1b2c3d4e5f6/           # 项目 hash（git remote URL）
│   │   ├── project.json        # 项目元数据
│   │   ├── observations.jsonl  # 项目级观察
│   │   └── instincts/
│   │       └── personal/       # 项目级 instincts
│   └── f6e5d4c3b2a1/           # 另一个项目
│       └── ...
└── projects.json               # 项目注册表：hash → name/path/remote
```

### 项目检测

系统自动检测当前项目：

1. `git remote get-url origin` — hash 后生成可移植项目 ID（同仓库不同机器相同 ID）
2. `git rev-parse --show-toplevel` — 备选，使用仓库路径（机器特定）
3. 全局 fallback — 无法检测项目时，观察存入全局作用域

## Hook 安装

### 快速安装

运行安装脚本自动配置 hooks：

**macOS / Linux:**
```bash
# 自动检测平台并安装
bash skills/continuous-learning/hooks/setup.sh

# 指定平台适配器（按脚本支持情况选择）
bash skills/continuous-learning/hooks/setup.sh --platform codex
bash skills/continuous-learning/hooks/setup.sh --platform qwen-code
```

**Windows (PowerShell 7+):**
```powershell
# 自动检测平台并安装
.\skills\continuous-learning\hooks\setup.ps1

# 指定平台适配器（按脚本支持情况选择）
.\skills\continuous-learning\hooks\setup.ps1 -Platform codex
.\skills\continuous-learning\hooks\setup.ps1 -Platform qwen-code

# 卸载
.\skills\continuous-learning\hooks\setup.ps1 -Uninstall
```

### 手动配置

在你所使用平台支持的 hooks / automation 配置文件中接入观察脚本。下面只给出一个通用示意，实际键名和事件名应以目标平台官方文档为准：

**macOS / Linux:**
```json
{
  "hooks": {
    "PostToolUse": [{"matcher": "*", "hooks": [{"type": "command", "command": "~/.zc/hooks/continuous-learning/observe.sh"}]}],
    "UserPromptSubmit": [{"hooks": [{"type": "command", "command": "~/.zc/hooks/continuous-learning/observe.sh"}]}],
    "PostToolUseFailure": [{"matcher": "*", "hooks": [{"type": "command", "command": "~/.zc/hooks/continuous-learning/observe.sh"}]}],
    "Stop": [{"hooks": [{"type": "command", "command": "~/.zc/hooks/continuous-learning/session-end.sh"}]}]
  }
}
```

**Windows:**
```json
{
  "hooks": {
    "PostToolUse": [{"matcher": "*", "hooks": [{"type": "command", "command": "pwsh -NoProfile -File \"~/.zc/hooks/continuous-learning/observe.ps1\""}]}],
    "UserPromptSubmit": [{"hooks": [{"type": "command", "command": "pwsh -NoProfile -File \"~/.zc/hooks/continuous-learning/observe.ps1\""}]}],
    "PostToolUseFailure": [{"matcher": "*", "hooks": [{"type": "command", "command": "pwsh -NoProfile -File \"~/.zc/hooks/continuous-learning/observe.ps1\""}]}],
    "Stop": [{"hooks": [{"type": "command", "command": "pwsh -NoProfile -File \"~/.zc/hooks/continuous-learning/session-end.ps1\""}]}]
  }
}
```

> **依赖要求**: macOS/Linux 版需要 `jq`，Windows 版使用 PowerShell 内置 JSON 处理，无额外依赖。

## 模式检测

### 检测类型

| 模式类型 | 检测方法 | 置信度 |
|---------|---------|--------|
| **用户纠正** | UserPromptSubmit 中检测到"不要..."、"改用..."、纠正性指令 | 0.8+ |
| **错误修复路径** | PostToolUseFailure → 后续成功的工具调用序列 | 0.6-0.7 |
| **重复工作流** | 同一工具调用序列出现 3+ 次 | 0.5-0.6 |
| **项目约定** | 代码风格/结构在多文件中保持一致 | 0.4-0.5 |
| **明确教学** | 用户使用 `/learn save` 手动标记 | 0.9 |

### 检测示例

```
观察：用户三次在 Agent 使用 default export 后纠正为 named export

提取的 Instinct：
  id: prefer-named-exports
  trigger: "when creating TypeScript modules"
  action: "Use named exports, not default exports"
  confidence: 0.85
  domain: code-style
  scope: project
  evidence:
    - "User corrected default→named export (2026-04-10 session)"
    - "User corrected default→named export (2026-04-11 session)"
    - "User corrected default→named export (2026-04-12 session)"
```

## 双层持久化

### 本地文件层

**优势：** 高频写入、低延迟、hooks 直接操作、跨会话持久。

- `observations.jsonl` — 原始观察，append-only
- `instincts/personal/*.yaml` — 提炼后的 instincts

### Agent Memory 层

**优势：** 智能检索、跨项目共享、会话启动时自动加载。

当 instinct 置信度 >= 0.7 时，自动同步到 Agent Memory：

```
Memory 存储格式：
  category: learned_skill_experience
  title: "Instinct: [trigger 摘要]"
  content: "[action] — 置信度 [confidence] — 证据: [evidence 摘要]"
  keywords: "[domain], instinct, [project_name]"
  scope: project | global（对应 instinct 的 scope）
```

### 同步策略

- **文件 → Memory：** `/learn` 执行时，将高置信度 instincts 写入 Memory
- **Memory → 文件：** 会话启动时，从 Memory 恢复 instincts（如果本地文件丢失）
- **去重：** 使用 instinct ID 作为唯一键

## 演化路径

### Instinct → Skill/Command

当一组相关 instincts 满足以下条件时，可以演化为正式 skill 或 command：

1. **聚类条件：** 3+ 个相关 instincts，同一 domain
2. **置信度条件：** 平均置信度 >= 0.7
3. **覆盖条件：** instincts 覆盖一个完整的工作流或决策领域

### 提升规则（Project → Global）

当同一 instinct 在 2+ 个项目中出现且平均置信度 >= 0.8 时，自动提升为全局：

```
项目 A: prefer-explicit-errors (0.85)
项目 B: prefer-explicit-errors (0.80)
                 │
                 ▼
全局: prefer-explicit-errors (0.83) — 自动提升
```

## 命令接口

| 命令 | 说明 |
|------|------|
| `/learn` | 分析当前会话，提取并展示 instincts |
| `/learn status` | 显示所有 instincts（项目级 + 全局）及置信度 |
| `/learn evolve` | 聚类相关 instincts，建议演化为 skill/command |
| `/learn save [描述]` | 手动创建一个高置信度 instinct |
| `/learn promote [id]` | 将项目级 instinct 提升为全局 |
| `/learn export` | 导出 instincts 为文件 |
| `/learn import [file]` | 从文件导入 instincts |

## 与其他技能的衔接

- **sprint-retrospective** — Retro 的 Phase 7（Knowledge Capture）自动调用 `/learn` 提取本周期学习
- **context-engineering** — 会话启动时自动加载相关 instincts 作为上下文
- **sdd-tdd-workflow** — Phase 5 Reflect 中包含学习提取步骤
- **verification-before-completion** — 验证过程中发现的模式（常见失败原因）自动记录

## Red Flags

- Hook 脚本执行时间 > 2 秒（影响 Agent 响应速度）
- Instincts 数量 > 100 个未清理（信息过载）
- 相互矛盾的 instincts 同时存在（应合并或归档低置信度的）
- 全局 instincts 包含项目特定内容（作用域错误）
- 观察数据无限增长未归档（定期清理 observations.jsonl）
- 跳过 `/learn` 直接手动创建 Memory（绕过置信度评估）

## Verification

设置完成后确认：

- [ ] Hook 脚本已安装且有执行权限
- [ ] `~/.zc/homunculus/` 目录结构已创建
- [ ] PostToolUse hook 能正常记录观察（检查 observations.jsonl）
- [ ] `/learn` 命令能正确分析并提取 instincts
- [ ] 高置信度 instincts 已同步到 Agent Memory
- [ ] 项目检测正常工作（检查 project.json）
