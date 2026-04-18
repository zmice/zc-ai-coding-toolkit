# @zmice/zc

> **让多个 AI CLI 组队干活。** 一条命令，将 Codex、Qwen Code 等 AI 编码工具编排为协作团队，并行处理开发任务。

`@zmice/zc` 是一个多 CLI 智能体团队编排运行时（Multi-CLI Agent Team Orchestration Runtime）。它解决的核心问题是：**单个 AI CLI 一次只能做一件事，而真实项目需要多个任务并行推进。**

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🤖 **多 CLI 适配** | 统一适配 Codex CLI、Qwen Code 等主流 AI 编码工具，通过适配器层无缝切换 |
| 🚀 **任务并行编排** | 多个 Worker 并行执行任务，自动分派、状态追踪、失败回滚 |
| 🧠 **智能技能匹配** | 三模式技能注入——关键词匹配（中英文）/ AI 智能匹配 / 手动指定 |
| 🌿 **Git Worktree 隔离** | 每个 Worker 在独立 worktree 中执行，互不干扰，安全合并 |
| 💬 **团队消息通信** | 内置 Mailbox 系统，Worker 间实时消息传递与广播 |
| 📋 **任务队列管理** | 优先级队列、任务认领、状态流转（pending → running → done/failed） |

## 📦 安装

```bash
# npm 全局安装（推荐）
npm install -g @zmice/zc

# 验证
zc --version
```

## 🚀 快速开始

```bash
# 1. 检查环境依赖
zc doctor

# 2. 单任务运行
zc run "实现用户登录功能"

# 3. 启动团队 — 2 个 Worker 并行处理 3 个任务
zc team start \
  -w "w1:codex,w2:qwen-code" \
  -t "实现登录API" \
  -t "编写登录页面" \
  -t "添加认证中间件"

# 4. 查看团队状态
zc team status <team-name>

# 5. 团队内通信
zc msg send w1 "优先处理API端点"

# 6. 关闭团队
zc team shutdown <team-name>
```

## 🧠 智能技能匹配

zc 为每个任务自动注入相关 Skill 上下文，支持三种匹配模式：

```bash
# 默认：关键词匹配（支持中英文任务描述）
zc team start -w "w1:codex" -t "修复登录bug"

# 手动指定 Skills
zc team start -w "w1:codex" -t "任务描述" \
  --skills debugging-and-error-recovery security-and-hardening

# AI 智能匹配（自动分析任务意图）
zc team start -w "w1:codex" -t "任务描述" \
  --skill-match ai
```

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────┐
│                   CLI 命令层                      │
│   doctor │ setup │ run │ team │ task │ msg       │
├─────────────────────────────────────────────────┤
│                  团队引擎层                       │
│   Orchestrator ← TaskQueue + WorkerManager      │
│                    ↕ Mailbox                     │
├─────────────────────────────────────────────────┤
│                  运行时基础设施                    │
│   SessionManager (tmux) + WorktreeManager (git) │
├─────────────────────────────────────────────────┤
│                  适配器层                         │
│         CodexAdapter │ QwenCodeAdapter │ ...     │
└─────────────────────────────────────────────────┘
```

- **适配器层**：统一封装不同 AI CLI 的调用接口，新增 CLI 只需实现适配器
- **运行时**：基于 tmux 的会话管理 + 基于 git worktree 的执行隔离
- **团队引擎**：Orchestrator 协调任务分派、Worker 生命周期、消息路由
- **CLI 命令层**：基于 Commander.js，提供 6 组子命令

## 📖 命令速览

| 命令 | 说明 |
|------|------|
| `zc doctor` | 检查环境依赖（Node.js、git、tmux、CLI 工具） |
| `zc setup` | 初始化项目配置 |
| `zc run <prompt>` | 单 Worker 运行任务 |
| `zc team start` | 启动多 Worker 团队 |
| `zc team status` | 查看团队运行状态 |
| `zc team shutdown` | 关闭团队 |
| `zc team log` | 查看 Worker 日志 |
| `zc task list/claim/done/fail` | 任务管理（查看 / 认领 / 完成 / 标记失败） |
| `zc msg send/read/broadcast` | 团队消息（发送 / 读取 / 广播） |

## ⚙️ 系统要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 20 | 运行时环境 |
| git | 任意 | Worktree 隔离执行 |
| tmux | 任意 | 团队模式会话管理（macOS / Linux / WSL） |

## 🤝 支持的 AI CLI

- **Codex CLI** — OpenAI 官方命令行编码工具
- **Qwen Code** — 阿里云通义千问编码工具

> 通过适配器接口可扩展支持更多 CLI 工具。

## License

MIT
