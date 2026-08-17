# Codex Native Subagent Lifecycle

仅在当前平台是 Codex 且 host 暴露原生 collaboration tools 时读取。这里描述运行期映射，不把 host-owned thread lifecycle 搬进 standalone `zc` CLI。

官方边界：

- Codex 当前默认支持 subagent workflow，可由用户请求、`AGENTS.md` 或已激活 skill 触发
- 子代理继承 live parent sandbox / approval 边界；custom-agent TOML 提供角色默认值，不是越权通道
- 每个 agent 会增加 token 使用，但使用更快模型、最小上下文和并行独立工作通常能缩短墙钟时间
- `[agents]` 配置的是会话并发上限和默认档位；真实可用容量仍由当前 host、已运行线程和 live override 决定

依据：

- <https://learn.chatgpt.com/docs/agent-configuration/subagents>
- <https://learn.chatgpt.com/docs/config-file/config-reference>
- <https://learn.chatgpt.com/docs/environments/git-worktrees>

## 生命周期映射

1. 先用 `list_agents` 或当前 host 的等价状态面读取现有线程，不用静态数字猜容量。
2. 独立任务用 `spawn_agent`；任务必须给出 role、目标、只读/写入边界、所有权、loop budget 和返回格式。
3. 同一任务需要返工、补验证或 scoped re-review 时，优先用 `followup_task` 恢复原 owning thread，不新建重复 agent。
4. 只需补上下文且不应立即开始新一轮时，用 `send_message` 注入具体缺口；不要用它假装任务已经重新执行。
5. 线程失控、越界或路线已失效时，用 `interrupt_agent`；保留已完成结果和 interruption reason。
6. fan-in 前用 `wait_agent` 或 host 等价等待机制收集状态；长任务使用有界等待并继续主线程可独立完成的工作。
7. 当前 host 没有独立 close action 时，不虚构 `close_agent`；记录 completed / failed / interrupted 终态，让 host 回收线程。

状态至少区分：

- `running`
- `completed`
- `failed`
- `interrupted`
- `blocked`
- `missing`

部分成功必须保留。一个 agent 失败不能抹掉其他 agent 已完成的证据。

## Context Fork

`fork_turns` 选择遵循最小充分原则：

- `none`：默认用于代码地图、独立资料核查、窄范围只读问题；task brief 自包含
- 最近 N 轮：用于需要当前决策、局部 diff 或最近错误输出的 implementer / reviewer
- `all`：只有任务真正依赖完整讨论历史时使用；需要说明原因

不要把完整聊天历史、无关工具输出或其他 worker ledger 复制给 agent。reviewer 只接收 brief、report、scoped diff、验证证据和未决 finding。

## Runtime Capacity

不要再使用“普通任务 1–3、最多 5”作为 Codex 固定上限。

每批派发量按下面方式决定：

```text
available child slots = host session limit - capacity-consuming child threads reported by the host
batch size = min(independent ready tasks, available child slots)
```

- 主线程始终保留 controller / integrator 职责，不把全部任务和 fan-in 一起外包
- 有两个以上独立证据问题时即可 fan-out；不要求任务先达到高风险或大文件数门槛
- 首批占满有收益的 available child slots；任一 agent 完成后再从 ready queue 补位
- 达到容量时降级为分批并行或串行，不把 capacity exhaustion 写成任务失败
- 只为“可能有帮助”而重复派相同问题会浪费成本；同一问题只保留一个 owner

## Role And Model Defaults

优先使用已经生成的 `zc_*` role。role TOML 的 `model`、`model_reasoning_effort` 优先于显式 spawn、`[agents]` default 和 parent default，因此硬 pin 必须是有意的角色默认值：

- frontier/high：架构、安全等高影响判断
- balanced/high：代码审查、性能分析
- balanced/medium：后端、前端、测试、产品等常规工作
- fast/medium：边界清楚的上下文维护和机械核查

如果任务需要临时升级但某个 role 已硬 pin 模型，改用更合适的 role 或不带硬 pin 的通用 worker；不要声称显式 spawn 一定覆盖 role TOML。

`sandbox_mode` 不按上述模型优先级推断。role TOML 可以声明期望的隔离档位，但 Codex 会把 parent turn 的 live sandbox / approval override 重新应用到子代理。派发、写入和 fan-in 一律以 host 实际生效权限为准；配置为 `workspace-write` 不代表当前运行态一定获准写入。

## Thread Reuse

- 独立任务启动新线程，避免上下文污染
- 同一任务 clarification / fix / regression 复用 owning thread
- 原 agent 已失败且输入、范围、模型和验证方式都没有变化时，不原样重派
- 改派前记录为什么旧 owner 不再适合，以及新输入发生了什么变化

## Nested Delegation

子代理可以继续派发子代理，但默认只允许一个额外层级，并同时满足：

- 父任务明确包含可独立子问题
- 仍有 available child slots
- 子任务继承或收窄父任务的文件所有权，不得扩大
- 父 agent 拥有 child fan-in，主 controller 仍拥有全局 fan-in
- 父任务的 loop / token budget 包含其 children，不单独无限扩容

不满足时，由父 agent 自己完成或把建议返回主 controller。

## Writable Shared-Tree Mode

共享工作区写入只在文件所有权完全不重叠时启用：

- 每个 worker 收到唯一文件/目录所有权
- 明确“你不是仓库里唯一 worker，不回滚他人改动”
- controller 不同时修改已分配文件
- 发现同文件或接口冲突立即中断相关 worker，回到 fan-in

## Codex Temporary Worktree Mode

需要独立构建环境、相邻目录隔离或减少共享树冲突，但不需要 tmux / 多 CLI 团队时，使用 Codex 专用临时 worktree：

```bash
zc agent worktree prepare \
  --dir <repo> \
  --run-id <run> \
  --task-id <task> \
  --json

# 审阅 dry-run 后才创建
zc agent worktree prepare ... --apply --json
```

路径位于平台 OS temp 下的 `zc-codex-worktrees/`，不进入仓库 `.worktrees/`，也不占用 Codex Desktop 的 `$CODEX_HOME/worktrees`。worker 必须收到绝对 worktree 路径，所有 shell / edit 操作都限定在该路径。

fan-in 后先展示 cleanup plan：

```bash
zc agent worktree cleanup \
  --dir <repo> \
  --run-id <run> \
  --task-id <task> \
  --agent-state completed \
  --fan-in-collected \
  --json

zc agent worktree cleanup ... --apply --json

zc agent worktree recover \
  --dir <repo> \
  --run-id <run> \
  --task-id <task> \
  --json

zc agent worktree recover ... --apply --json
```

cleanup 只使用 receipt 精确认领路径，并要求：agent 已终态、fan-in 已收集、Git registry / branch / common git dir 匹配、worktree 无 staged / tracked / untracked 变更、cleanup plan 后状态未变化。它不使用 `--force`，不扫描删除整个 OS temp，也不运行全局 `git worktree prune`。

源仓库 dirty 时默认阻止 prepare，因为新 worktree 只基于已提交 `HEAD`。只有 controller 已确认未提交改动与子任务无关时才显式传 `--allow-dirty-source`；receipt 同时记录 dirty paths 与 HEAD-only acknowledgement，不静默复制未提交文件。

- 无独立提交：删除 worktree、receipt、临时空目录和临时 branch
- 有未合入提交：删除 worktree，但保留命名 branch 和 receipt 作为恢复锚点
- dirty / missing / ownership mismatch：阻止清理，保留现场并报告

进程中断或恢复 branch 后续已合入时使用 `recover`。它只按 receipt 处理精确 lease：注册完成的 allocating/orphaned lease 可恢复为 ready；没有 worktree / branch 的 orphan metadata 可释放；已合入 branch 可非 force 删除并清理 receipt；未合入 branch、stale Git registry 或不匹配路径继续阻止。已存在的 worktree / receipt 父级拒绝 symlink，并在变更前复核 canonical containment。lock 带 PID / timestamp；健康 owner 只读等待，只有超过阈值的 dead-owner 或 malformed lock 才进入原子回收。

Codex Desktop chat-level native worktree 仍由 Desktop 管理；不要用 zc manager 清理 `$CODEX_HOME/worktrees`。

## Fan-In Transcript

```text
Codex native fan-in:
- runtime capacity / batch:
- thread ids and roles:
- context fork choice:
- states: running | completed | failed | interrupted | blocked | missing
- changed files / worktree branches:
- findings and accepted results:
- follow-up / message / interrupt history:
- regression evidence:
- final verification:
- cleanup result or recovery anchor:
```
