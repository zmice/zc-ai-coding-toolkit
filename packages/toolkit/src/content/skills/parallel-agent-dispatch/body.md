# Parallel Agent Dispatch

## 角色定位

把彼此独立的任务做上下文级 fan-out，并在结束时做 fan-in、冲突检测和集成验证。只读 fan-out 只有在用户已授权本会话或项目默认启用只读 agent 时，才可通知式启动；写入型 fan-out 必须先确认文件所有权、验证命令和 fan-in gate。

这个 skill 不是默认加速器。能并行不等于应该并行；并行会增加 token、延迟、集成和验证成本。

## 快速路径

1. 读取计划，列出所有任务、依赖和预计触达文件。
2. 判断任务是否彼此独立，是否有清晰文件所有权。
3. 区分只读通知式 fan-out 和写入确认式 fan-out。
4. 为每个 worker 分配唯一责任范围、允许读取或修改的边界和验证命令。
5. fan-out 执行，期间不让多个写入 worker 修改同一文件。
6. fan-in 汇总，检查 diff、冲突、接口一致性、review finding 和回归结果。
7. 记录验收 transcript：谁做了什么、谁提出了什么、谁修复了什么、谁回归了什么、证据是什么、还有什么风险。

## 使用条件

适用：

- 多个任务互不依赖。
- 每个任务能在独立上下文中完成。
- 写入任务的文件所有权可以提前划清，或只读任务有明确问题边界。
- fan-in 后有集成测试或人工审查门禁。

不适用：

- 任务依赖同一个未完成设计。
- 多个任务必须改同一文件。
- 缺少测试或集成验证方式。
- 写入型并行没有用户确认。

## 模式选择

| 模式 | 适用场景 | 代价 |
|---|---|---|
| Readonly Consult | 多个只读 agent 分别评估架构、测试、安全、性能、产品或 review 风险 | 需要主线程判断哪些结论成立 |
| Context Fan-Out | 只需要多个子代理分别分析或修改互不重叠文件 | 共享同一 worktree，fan-in 需谨慎检查 |
| Worktree Parallel | 任务可能触及相邻区域，或需要独立构建环境 | 需要分支和 worktree 清理 |
| Cascade | 任务有层级依赖，但每层内可并行 | 每层都要验证后再进下一层 |
| Team Orchestration | 需要 tmux + git worktree + 多 CLI worker | 运行时成本最高，需 `zc team` 收尾 |

如果需要文件系统级隔离，切到 `team-orchestration`；不要在本 skill 内展开完整 `zc team` 教程。

## 通知与授权

只读 fan-out 在已授权时使用通知式提示：

```text
Agent assist:
- <agent>：只读评估 <范围>，不改文件
fan-in：主线程汇总结论后再决定是否改代码
```

如果当前会话或项目没有只读 agent 默认授权，只输出上面的 `Agent assist` 预告并等待确认。

写入型 fan-out 启动前必须给用户看到这段信息的等价内容：

```text
Recommendation: 开启 <模式> because <并行收益> outweighs <集成代价>。
- worker 数：
- 文件所有权：
- 不并行的替代方案：
- fan-in 验证：

确认后我再启动；不确认则按串行推进。
```

默认上限：

- 普通复杂任务最多 1 个只读 agent。
- 跨模块或高风险任务最多 2 个只读 agent。
- 写入型并行默认最多 2 个 worker。
- 超过 2 个 worker 必须说明收益和 fan-in 成本。
- `zc team` 必须用户明确要求或确认。

## Worker 合约

每个子代理都必须收到：

- 任务目标和验收标准
- 允许读取的关键上下文
- 允许修改的文件或模块边界；只读 worker 必须明确“不改文件”
- 不得触碰其他 worker 文件的说明
- 任务内验证命令
- 返回格式：`DONE / BLOCKED / NEEDS_CONTEXT`

返回时必须列出：

- 修改文件
- 已运行验证
- 提出的 findings 或回归结论
- 未覆盖风险
- 需要主线程 fan-in 的事项

## Fan-In 门禁

并行完成不等于任务完成。fan-in 必须检查：

- 所有子代理结果是否到齐。
- 是否出现同文件修改、命名冲突或接口冲突。
- 局部验证是否可信。
- review finding 是否由提出方完成回归。
- 主线程是否运行集成测试或目标平台验证。
- 是否需要清理分支、worktree、临时文件或保留待审查分支。

闭环所有权：

- `producer owns fix`：谁引入问题，谁优先修复。
- `reviewer owns regression`：谁提出问题，谁负责复验原 finding 是否关闭。
- `controller owns fan-in`：主线程负责接受、转派、整合和最终验证。

推荐记录格式：

```text
Parallel acceptance transcript:
- Plan:
- Workers:
- Files:
- Findings:
- Fixes:
- Regression:
- Results:
- Verification:
- Conflicts:
- Follow-up:
```

## 失败处理

- 单个 worker 失败时，不要自动丢弃其他成功结果。
- 先收集成功结果，再判断是否可以部分合入。
- 失败任务优先缩小范围、补上下文或改为串行处理。
- 如果失败暴露计划不成立，回到 `planning-and-task-breakdown`。

## 与相关技能的边界

- `subagent-driven-development`：串行委派，不做并行 fan-out。
- `team-orchestration`：进程级 + 文件系统级隔离。
- `branch-finish-and-cleanup`：fan-in 后处理分支、worktree 和残留状态。
- `verification-before-completion`：声明完成前读取验证输出。
