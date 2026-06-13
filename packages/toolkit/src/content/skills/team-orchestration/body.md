# Team Orchestration

## 角色定位

使用 `zc team` 把多个 AI CLI worker 运行在 tmux pane 和 git worktree 中，适合需要文件系统级隔离、长时间并行或多 CLI 协作的任务。

这是重型能力。默认先考虑串行执行或 `parallel-agent-dispatch`；只有用户明确要求多 worker / team 模式，或用户确认 `agent_opportunity.mode=zc-team`，且文件边界清楚时才启动。

## 何时使用

使用：

- 多个任务可以分配给不同 worker。
- 需要独立 worktree 避免写入冲突。
- 需要 Codex / Qwen 等不同 CLI 处理不同类型任务。
- 任务较长，值得承担 fan-in 和清理成本。

不使用：

- 单个简单任务。
- 任务高度耦合、共享大量上下文。
- 没有测试或集成验证方式。
- 只是想“快一点”，但文件所有权不清。

## 快速路径

1. 先用 `zc doctor` 检查环境。
2. 确认 project-local worktree root 已被忽略；如果没有，把 `.worktrees/` 加入 `.gitignore` 或改用仓库外目录。这是启动前必过项，不是建议项。
3. 用 `zc team plan` 做 dry-run，任务必须带 `files=` 边界。
4. 只有 `canStart=true` 且用户确认后，才运行 `zc team start`。
5. 用 `zc team status` 和 `zc team log` 监控 worker。
6. 按 loop budget 判断 worker 是否 stuck；状态不明、重复失败或超过等待预算时停止派新任务，先 fan-in 已有结果。
7. fan-in 前运行 `zc team shutdown <team> --plan` 查看 clean/dirty/ahead/merged 状态；这个 plan 是 fan-in evidence，不是删除或丢弃 worktree 的授权。
8. 明确每个分支去向后再 `zc team shutdown`。

```bash
zc doctor

zc team plan \
  -w 2 \
  -t "API | files=src/api.ts,src/api.test.ts" \
  -t "UI | files=src/ui.ts,src/ui.test.ts"

zc team start \
  -w "w1:codex,w2:qwen-code" \
  -t "API | files=src/api.ts,src/api.test.ts" \
  -t "UI | files=src/ui.ts,src/ui.test.ts"

zc team status <team-name>
zc team log <team-name>
zc team shutdown <team-name> --plan
zc team shutdown <team-name>
```

## 任务描述规则

每个 `-t` 至少包含：

- 任务名
- `files=` 文件或目录所有权
- 验收标准
- 验证命令

示例：

```text
实现用户认证 API | files=src/auth.ts,src/auth.test.ts | verify=pnpm test auth
```

没有 `files=` 时，默认不能证明任务可安全并行。

## 启动前推荐格式

```text
Recommendation: 使用 zc team because <文件系统隔离收益> outweighs <tmux/worktree/fan-in 成本>。
- worker：
- worktree 边界：
- 不使用 team 的替代方案：
- fan-in 验证：
- 清理策略：

确认后我再启动；不确认则按串行或 Context Fan-Out 推进。
```

即使 `start` 或 `task-plan` 输出 `agent_opportunity.mode=zc-team`，也只能作为建议。没有用户明确确认时，不运行 `zc team start`。

确认 `zc team` 前，应先说明为什么 `readonly-consult`、`serial-subagent` 或 `context-fanout` 不足以覆盖目标，避免把 team 当成默认实现模式。

Codex 是默认主路径时，worker 优先选择 Codex。Qwen / Claude / OpenCode 只在任务明确需要对应平台能力、用户指定或 Codex 无法覆盖时加入，不把跨 CLI 当成默认加速手段。

## Bounded Team Loop

启动前必须写明：

```text
team_loop_budget:
- poll interval:
- max wait:
- stuck condition:
- retry limit:
- degraded path:
- shutdown evidence:
```

默认边界：

- `zc team plan` 必须先通过，且 `canStart=true`。
- 监控默认每 30-60 秒读取一次状态；没有新日志、任务状态不变或重复同类失败超过 2 次，判定为 stuck。
- 单个 worker 同一任务最多重派 1 次；重派必须改变上下文、任务范围、模型或验证方式。
- 超过等待预算、状态文件缺失、worktree dirty 且归属不清时，不继续扩大 team，先做 shutdown plan 和人工 fan-in。
- 部分 worker 成功时保留成功结果，失败任务缩小范围后改串行或回到 `parallel-agent-dispatch` / `planning-and-task-breakdown`。

## Worker 协作纪律

- 每个 worker 只修改自己的 `files=` 范围。
- 共享接口变更必须通过 mailbox 或主线程广播。
- worker 完成时报告修改文件、验证结果和待集成事项。
- 主线程负责最终集成，不把 fan-in 交给任意单个 worker 自行处理。
- review finding 按 `producer owns fix` 和 `reviewer owns regression` 闭环；提出方必须回归确认，主线程负责接受或转派。

## Fan-In 与收尾

结束前必须记录：

```text
Team acceptance transcript:
- Team:
- Workers:
- Task ownership:
- Branch/worktree status:
- Worker results:
- Findings/fixes/regression:
- Loop budget:
- Integrated diff:
- Verification:
- Cleanup:
```

收尾判断：

- clean 且已合入：可删除 worktree/branch。
- dirty：先读 status 和 diff，决定合入、保留或放弃；不能因为 shutdown plan 已生成就直接删除。
- ahead 但未合入：明确是否提交、PR 或丢弃。
- unknown：不要直接删除，先人工确认状态。

## 边界与安全

- 不把 `zc team` 当成默认实现方式。
- 不为了形式统一创建多个 worker。
- 不在用户未明确确认时启动，即使并行看起来有收益。
- 不在未验证 `canStart=true` 时启动。
- 不在项目内创建未被 `.gitignore` 覆盖的 worktree root。
- 不直接清理 dirty worktree。
- 不混入破坏性 git 操作；需要删除或重置时必须先确认。

## 相关技能

- `parallel-agent-dispatch`：上下文级并行，成本更低。
- `subagent-driven-development`：串行子代理委派。
- `branch-finish-and-cleanup`：分支和 worktree 收尾。
- `verification-before-completion`：声明完成前的最终证据门禁。
