# Team Orchestration

## 角色定位

使用 `zc team` 把多个 AI CLI worker 运行在 tmux pane 和 git worktree 中，适合需要文件系统级隔离、长时间并行或多 CLI 协作的任务。

这是重型能力。默认先考虑串行执行或 `parallel-agent-dispatch`；只有用户明确要求多 worker / team 模式，且文件边界清楚时才启动。

## 何时使用

使用：

- 多个任务可以分配给不同 worker。
- 需要独立 worktree 避免写入冲突。
- 需要不同 CLI 处理不同类型任务。
- 任务较长，值得承担 fan-in 和清理成本。

不使用：

- 单个简单任务。
- 任务高度耦合、共享大量上下文。
- 没有测试或集成验证方式。
- 只是想“快一点”，但文件所有权不清。

## 快速路径

1. 先用 `zc doctor` 检查环境。
2. 用 `zc team plan` 做 dry-run，任务必须带 `files=` 边界。
3. 只有 `canStart=true` 且用户确认后，才运行 `zc team start`。
4. 用 `zc team status` 和 `zc team log` 监控 worker。
5. fan-in 前运行 `zc team shutdown <team> --plan` 查看 clean/dirty/ahead/merged 状态。
6. 明确每个分支去向后再 `zc team shutdown`。

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

## Worker 协作纪律

- 每个 worker 只修改自己的 `files=` 范围。
- 共享接口变更必须通过 mailbox 或主线程广播。
- worker 完成时报告修改文件、验证结果和待集成事项。
- 主线程负责最终集成，不把 fan-in 交给任意单个 worker 自行处理。

## Fan-In 与收尾

结束前必须记录：

```text
Team acceptance transcript:
- Team:
- Workers:
- Task ownership:
- Branch/worktree status:
- Worker results:
- Integrated diff:
- Verification:
- Cleanup:
```

收尾判断：

- clean 且已合入：可删除 worktree/branch。
- dirty：先读 diff，决定合入、保留或放弃。
- ahead 但未合入：明确是否提交、PR 或丢弃。
- unknown：不要直接删除，先人工确认状态。

## 边界与安全

- 不把 `zc team` 当成默认实现方式。
- 不为了形式统一创建多个 worker。
- 不在未验证 `canStart=true` 时启动。
- 不直接清理 dirty worktree。
- 不混入破坏性 git 操作；需要删除或重置时必须先确认。

## 相关技能

- `parallel-agent-dispatch`：上下文级并行，成本更低。
- `subagent-driven-development`：串行子代理委派。
- `branch-finish-and-cleanup`：分支和 worktree 收尾。
- `verification-before-completion`：声明完成前的最终证据门禁。
