# Team Orchestration

## Overview

zc 团队模式是一套基于 **tmux + git worktree** 的多 CLI worker 编排系统。它将多个 AI CLI（Codex CLI、Qwen Code）作为 worker 运行在独立的 tmux pane 和 git worktree 中，通过中央编排器（Orchestrator）自动分派任务、监控健康状态、协调通信。

**核心概念：**

| 概念 | 说明 |
|------|------|
| **Team** | 一组 worker 的运行实例，对应一个 tmux session 和一组 worktree |
| **Worker** | 一个运行中的 CLI 进程（Codex 或 Qwen Code），在独立 worktree 中工作 |
| **TaskQueue** | claim-safe 的任务队列，通过 token 机制防止竞态，支持依赖关系 |
| **Mailbox** | Worker 间的消息通信系统，支持点对点发送和广播 |
| **Orchestrator** | 编排控制器，负责启动团队、分派任务、监控 worker 健康、持久化状态 |

**支持的 CLI 适配器：**
- `codex` — OpenAI Codex CLI
- `qwen-code` — Qwen Code CLI

## When to Use

```
需要多个 AI agent 并行工作？ ─── 否 ──→ 用 zc run 单 worker 执行
    │
   是
    ▼
任务可以分配给不同 worker？ ─── 否 ──→ subagent-driven-development（串行委派）
    │
   是
    ▼
需要文件系统级隔离？ ─── 否 ──→ parallel-agent-dispatch（上下文级并行）
    │
   是
    ▼
team-orchestration ✓（tmux + worktree 隔离）
```

适用场景：
- 大型项目需要多个 agent 同时实现不同功能模块
- 不同任务需要不同 CLI 的能力（如 Codex 擅长生成、Qwen Code 擅长分析）
- 需要真正的文件系统隔离避免写入冲突
- 长时间运行的批量任务，需要并行加速

不适用场景：
- 单个简单任务 — 直接用 `zc run`
- 任务之间紧耦合、需要共享上下文 — 用串行子代理
- 不需要文件系统隔离的轻量并行 — 用 `parallel-agent-dispatch`

## 快速开始

```bash
# 1. 检查环境（git、tmux、Node.js、CLI 是否就绪）
zc doctor

# 2. 先 dry-run 分析并行边界
zc team plan \
  -w 2 \
  -t "实现用户认证 API | files=src/auth.ts,src/auth.test.ts" \
  -t "实现数据库模型 | files=src/schema.ts,src/schema.test.ts"

# 3. 确认 canStart=true 后启动一个 2 worker 团队
zc team start \
  -w "w1:codex,w2:qwen-code" \
  -t "实现用户认证 API | files=src/auth.ts,src/auth.test.ts" \
  -t "实现数据库模型 | files=src/schema.ts,src/schema.test.ts"

# 4. 查看团队状态
zc team status <team-name>

# 5. 查看 worker 输出日志
zc team log <team-name>
zc team log <team-name> -w w1    # 只看 w1 的输出

# 6. 关闭前先看 fan-in 收尾状态
zc team shutdown <team-name> --plan

# 7. 确认分支去向后关闭团队（清理 tmux session + worktree）
zc team shutdown <team-name>
```

团队名称默认按 `team-YYYYMMDD-HHmmss` 格式自动生成，也可用 `-n` 指定：

```bash
zc team start -n my-team -w "w1:codex,w2:codex" -t "任务A" -t "任务B"
```

指定模型：

```bash
zc team start -w "w1:codex" -t "任务A" -m o3
```

## 工作流详解

### 团队启动流程

```
zc team start
    │
    ▼
1. 创建状态目录 (.zc/<team-name>/)
    │
    ▼
2. 初始化子系统
    ├── TaskQueue  → 加载/创建 tasks.json
    └── Mailbox    → 加载/创建 mailbox.json
    │
    ▼
3. 创建 tmux session (zc-<team-name>)
    │
    ▼
4. 创建任务（每个 -t 参数 → 一条 pending 任务）
    │
    ▼
5. 启动 workers
    ├── 为每个 worker 创建 git worktree
    ├── 在 tmux 中创建 pane
    └── 通过 CLI 适配器 spawn 进程
    │
    ▼
6. 持久化初始状态 → state.json
    │
    ▼
7. 进入 dispatch 循环（每 3 秒一轮）
```

### 任务分派机制

Orchestrator 运行一个持续的 dispatch 循环，每轮执行：

1. **健康检查** — 检测 busy worker 是否存活；若 worker 死亡，将其任务标记为 `failed`
2. **匹配分派** — 获取就绪任务（`getReady`：pending 且依赖已完成）和空闲 worker（`getIdleWorkers`），按顺序配对
3. **Claim-safe 认领** — 使用 UUID token 认领任务，防止竞态条件：
   ```
   claim(taskId, workerId) → { task, token }
   transition(taskId, token, "in_progress")
   assignTask(workerId, taskId, description)
   ```
4. **状态持久化** — 每轮结束写入 `state.json`

**Claim Token 机制：** 每次认领生成唯一 token，后续的状态转换（完成/失败/释放）必须携带正确的 token，确保同一任务不会被两个 worker 同时操作。

### 任务状态流转

```
pending → claimed → in_progress → completed
                                → failed
         ↑                       │
         └── release(释放回队列) ──┘ (shutdown 时)
```

| 状态 | 含义 |
|------|------|
| `pending` | 等待分派 |
| `claimed` | 已被 worker 认领，等待开始执行 |
| `in_progress` | 正在执行中 |
| `completed` | 执行成功 |
| `failed` | 执行失败（worker 崩溃或主动标记） |

任务支持依赖关系：只有所有 `dependencies` 中的任务都已 `completed`，该任务才会进入就绪列表。

### Worker 间通信

Mailbox 提供两种通信模式：

**点对点发送：**
```bash
zc msg send <to-worker-id> "需要你在 API 层暴露 /users 端点"
```

**广播（发给所有 worker）：**
```bash
zc msg broadcast "数据库 schema 已更新，请 pull 最新代码"
```

消息状态流转：`pending → delivered → read`

消息持久化在 `.zc/<team-name>/mailbox.json` 中，每条消息包含发送者、接收者、内容、时间戳和状态。

## 命令参考

### `zc doctor` — 环境诊断

检查运行环境是否就绪：
- 操作系统（macOS / Linux / WSL / Windows native）
- Node.js 版本（≥ 20.0.0）
- git 是否可用
- tmux 是否可用
- Codex CLI / Qwen Code CLI 是否安装

```bash
zc doctor
```

### `zc run` — 单 Worker 执行

启动单个 CLI worker 执行任务，不创建团队：

```bash
zc run "实现用户登录功能"                    # 默认使用 codex
zc run "重构数据层" --cli qwen-code          # 使用 qwen-code
zc run "修复 bug" -m o3 -w ./src             # 指定模型和工作目录
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `[prompt]` | 任务描述 | — |
| `--cli <cli>` | CLI 适配器（codex \| qwen-code） | codex |
| `-m, --model <model>` | 模型名称 | — |
| `-w, --workdir <dir>` | 工作目录 | 当前目录 |

### `zc team start` — 启动团队

```bash
zc team start -w "w1:codex,w2:qwen-code" \
  -t "任务1 | files=src/a.ts" \
  -t "任务2 | files=src/b.ts"
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-w, --workers <spec>` | Worker 规格 `id:cli,...`（必需） | — |
| `-t, --tasks <task...>` | 任务描述（可重复，至少一个） | — |
| `-n, --name <name>` | 团队名称 | `team-YYYYMMDD-HHmmss` |
| `-m, --model <model>` | 模型名称 | — |

多 worker 启动前会执行保守并行检查：

- 多任务必须声明 `files=`，否则不能证明文件所有权
- 两个任务声明同一文件会被判定为冲突
- 声明了 `deps=` 的任务需要 cascade 计划，不能盲目并行启动
- worktree 目录优先使用 `.worktrees/`，其次 `worktrees/`；项目内目录必须被 git ignore

先用 `zc team plan` 查看这些判断。

### `zc team plan` — 干跑并行计划

```bash
zc team plan -w 2 \
  -t "任务1 | files=src/a.ts" \
  -t "任务2 | files=src/b.ts" \
  --json
```

输出包含：

- `canStart`：是否可直接并行启动
- `recommendedWorkers`：建议 worker 数
- `conflicts`：文件所有权冲突
- `batches`：按依赖分层后的执行批次
- `blockers`：阻止并行启动的原因

### `zc team status` — 查看团队状态

```bash
zc team status <team-name>
```

输出包含 Worker 列表（ID、CLI 类型、状态、当前任务）和任务汇总（pending/running/done/failed）。

### `zc team log` — 查看 Worker 日志

```bash
zc team log <team-name>              # 所有 worker
zc team log <team-name> -w w1        # 指定 worker
```

捕获 tmux pane 的最近 50 行输出。

### `zc team shutdown` — 关闭团队

```bash
zc team shutdown <team-name>
zc team shutdown <team-name> --plan   # 只查看 fan-in 状态，不删除
```

终止 tmux session，清理 git worktree。

在执行 `shutdown` 前，先完成收尾判定：

- 哪些 worker 分支已经可以合入或开 PR
- 哪些任务失败，需要保留证据后再清理
- 哪些 worktree 仍要继续使用，不应被误删

`--plan` 会输出每个受管 worktree 的 `clean/dirty/ahead/merged/unknown` 状态，并且不会关闭 tmux 或删除 worktree。没有明确去向时，只运行 `--plan`，不要直接 shutdown。

`shutdown` 是进程和环境层面的终止动作，不应代替 branch / worktree 去向决策。具体判定规则见 `branch-finish-and-cleanup`。

### `zc task` — 任务操作

```bash
zc task list                          # 列出所有任务
zc task claim <id>                    # 认领任务
zc task done <id>                     # 标记任务完成
zc task fail <id> -r "编译错误"        # 标记任务失败（附原因）
```

### `zc msg` — 消息通信

```bash
zc msg send <to> <body>               # 点对点发送
zc msg broadcast <body>               # 广播
zc msg list                           # 查看消息
```

## 架构简图

```
zc CLI 入口 (commander)
  │
  ├── zc doctor     → 环境诊断（platform detection）
  ├── zc run        → 单 worker 执行
  ├── zc toolkit    → 工具包查询
  │
  ├── zc team       → 团队编排
  │     └── Orchestrator（编排控制器）
  │           ├── TaskQueue（claim-safe 任务队列）
  │           │     └── tasks.json（持久化）
  │           ├── Mailbox（消息邮箱）
  │           │     └── mailbox.json（持久化）
  │           └── WorkerManager
  │                 ├── SessionManager（tmux session/pane 管理）
  │                 └── WorktreeManager（git worktree 生命周期）
  │
  ├── zc task       → 任务操作（claim/done/fail）
  ├── zc msg        → 消息通信（send/broadcast）
  │
  └── CLI Adapters（适配层）
        ├── CodexAdapter    → Codex CLI spawn/detect/healthCheck
        └── QwenCodeAdapter → Qwen Code spawn/detect/healthCheck
```

**状态持久化：** 所有状态存储在 `.zc/<team-name>/` 目录下：
- `state.json` — 团队整体状态快照
- `tasks.json` — 任务队列
- `mailbox.json` — 消息记录

## 最佳实践

### 与 Codex 内置并行能力的关系

优先级按隔离需求分流：

| 场景 | 优先选择 | 原因 |
|------|----------|------|
| 只需要多个 Codex 子代理做分析或分片实现 | Codex subagents | Codex 会负责 spawn、等待、汇总和关闭子线程 |
| 需要在 Codex app 后台跑一个任务、不干扰本地 checkout | Codex app Worktree | Codex 托管 worktree，适合单线程后台推进 |
| 需要多个 CLI worker 长时间并行、跨 Codex/Qwen、共享任务队列和消息 | `zc team` | 需要 tmux、claim-safe 队列、Mailbox 和显式 worktree 生命周期 |
| 需要把 workflow 分发成 Codex 可安装能力 | Codex plugin | 用 `zc platform generate codex --bundle codex-plugin` 生成 plugin root，或用 `--bundle codex-marketplace` 生成 repo marketplace |

Codex subagents 不是默认自动 fan-out，只有用户明确要求多代理时才使用。`zc team` 也不要把“能并行”当作默认：先拆任务和文件所有权，再给出并行建议，让用户确认是否开启。

Codex app 的托管 worktree 通常是 detached HEAD，并且 Codex 会把它放在 `$CODEX_HOME/worktrees` 下管理；如果在 worktree 上创建了分支，同一个分支不能同时在本地 checkout。需要本地验证时优先使用 Codex 的 Handoff，而不是手动在两个 worktree 间切同一分支。

### 并行启动前确认

当计划满足并行条件时，先输出：

- 推荐模式：Codex subagents、Codex app Worktree、`zc team` 或 Cascade
- worker 数量和每个 worker 的文件/模块所有权
- 是否需要独立 worktree、是否会触发额外依赖安装或测试
- fan-in 后的验证命令和分支收尾方式

只有用户确认后，才启动 subagents 或 `zc team start`。如果用户不确认，继续按串行 workflow 推进。

### 任务粒度建议

| 粒度 | 建议 | 示例 |
|------|------|------|
| 太粗 | 拆分后再分派 | "实现整个后端" → 按模块拆分 |
| 合适 | 一个任务 = 一个聚焦的功能模块 | "实现用户注册 API + 测试" |
| 太细 | 合并为一个任务 | "创建 users 表" + "添加 email 字段" → 合并 |

**经验法则：** 每个任务应该可以在一个 agent session 中完成（约 30-60 分钟），产出可独立验证的结果。

### Worker 数量与 CLI 搭配建议

- **2-3 workers** 是常见配置，太多 worker 可能导致资源竞争
- **混合搭配** — 可以根据任务特点选择不同 CLI：
  ```bash
  # Codex 做生成，Qwen Code 做分析
  zc team start -w "gen:codex,review:qwen-code" -t "实现功能" -t "审查代码"
  ```
- **同构配置** — 多个相同 CLI 并行处理同类任务：
  ```bash
  zc team start -w "w1:codex,w2:codex,w3:codex" -t "模块A" -t "模块B" -t "模块C"
  ```

### 故障恢复策略

| 故障场景 | 处理方式 |
|---------|---------|
| Worker 进程崩溃 | Orchestrator 自动检测，将该任务标记为 `failed`，空闲 worker 可重新认领 |
| tmux session 丢失 | `zc team shutdown <name>` 清理残留，重新启动团队 |
| 任务执行失败 | 通过 `zc task fail <id> -r "原因"` 标记，分析原因后调整任务描述重试 |
| 团队关闭时有运行中任务 | `shutdown()` 会将活跃任务释放回 `pending` 状态 |
| Worktree 残留 | `zc team shutdown` 自动清理；手动清理用 `git worktree remove` |
| `.worktrees` 未被 ignore | 添加 `.worktrees/` 到 `.gitignore` 并提交，再重新启动团队 |

### 团队收尾协议

团队停机前，Orchestrator 之外还要完成一轮 branch closure：

1. 汇总每个 worker 的最终状态：`completed`、`failed`、`paused`
2. 对 `completed` 的 worker，明确是直接合入、开 PR，还是暂时保留分支
3. 对 `failed` 的 worker，先转移日志、结论和必要证据，再清理 worktree
4. 对 `paused` 的 worker，登记负责人和恢复条件，避免 worktree 变成无主状态
5. 最后再执行 `zc team shutdown`

这样做的目的，是把“任务队列完成”与“分支真正结束”区分开。团队模式很容易把 worktree 当作任务缓存；这会导致团队已经关闭，但遗留分支无人接手。

### 环境注意事项

- **Windows 用户：** 建议在 WSL Ubuntu 中运行，以获得完整的 tmux 支持
- **tmux 必需：** 团队模式依赖 tmux 管理 worker 进程，运行前确保 `zc doctor` 通过
- **git worktree：** 确保当前目录是 git 仓库，worktree 会创建在项目同级目录

## 与其他技能的衔接

- **planning-and-task-breakdown** — 上游：将规格拆解为可分派给 worker 的任务列表
- **parallel-agent-dispatch** — 姊妹技能：上下文级并行（无文件系统隔离），team-orchestration 提供进程级 + 文件系统级隔离
- **branch-finish-and-cleanup** — worker 停机前后的 branch / worktree 去向判定与清理由该技能提供通用规则
- **subagent-driven-development** — 姊妹技能：串行版本，适合有依赖的任务链
- **verification-before-completion** — 所有 worker 完成后，需验证集成结果
- **git-workflow-and-versioning** — 团队模式深度依赖 git worktree，参见该技能的 worktree 章节
- **code-review-and-quality** — 多 worker 产出合并后，进行统一的代码审查

## Red Flags

- 不运行 `zc doctor` 就直接启动团队
- Worker 数量超过任务数量（资源浪费）
- 任务粒度过大导致单个 worker 长时间阻塞
- 忽略 worker 失败信号，不检查失败原因
- 多个任务修改同一文件但未使用 worktree 隔离
- 团队关闭后不清理 worktree（浪费磁盘空间）
- 不利用 Mailbox 通信，让 worker 之间完全孤立地工作
- 跳过集成验证就声明多 worker 任务全部完成
- 把 `zc team shutdown` 当成收尾本身，而不先明确各 worker 分支的最终去向
