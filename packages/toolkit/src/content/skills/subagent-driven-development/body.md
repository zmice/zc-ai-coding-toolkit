# 子代理驱动开发

## 何时使用

已有实现计划、任务大多独立但不需要并行时使用。在当前会话内串行分派独立任务，让主线程保留集成上下文：

```text
producer owns fix
reviewer owns regression
controller owns fan-in
```

本 skill 适合已有计划、任务大多独立但不需要并行的实现。需要并行时使用 `parallel-agent-dispatch`；任务紧耦合时由主线程直接增量实现。

## 启动门禁

1. 确认平台有可用子代理能力；没有时由主线程按同一任务/审查契约串行执行。
2. 为计划创建独立、项目忽略的 scratch workspace，不读取其他计划的 ledger。
3. 检查当前分支、dirty worktree 和文件所有权；不要让 worker 覆盖用户已有改动。
4. 扫描任务之间和全局约束之间的冲突；只有会改变路线的冲突才暂停询问。
5. 给每个任务写 brief、验证命令和默认两轮 loop budget。

完整角色、文件格式、状态和循环协议见 `references/execution-protocol.md`。

## 每任务 Quick Path

1. 记录任务开始基线和允许修改的文件。
2. 写最小 task brief；精确值只保留一份，不粘贴完整会话历史。
3. 分派全新 implementer，要求先读 brief、按 TDD 实现、自审并写 report。
4. 收到 `NEEDS_CONTEXT` 时只补具体缺口；收到 `BLOCKED` 时改变范围、上下文、模型或验证方式。
5. 生成 scoped review package，交给独立 reviewer 同时给出规格和质量 verdict。
6. finding 优先退回原 producer；reviewer 给出复验标准并做 scoped re-review。
7. 修复仍失败且预算耗尽时，由 controller adjudicate：缩小任务、改派、接手或进入 stop gate。
8. 两个 verdict 均通过后，在 plan ledger 记录完成、证据和未决风险。

不要在同一任务上并行派多个 implementer。不要因为 worker 自审通过就跳过独立 task review。

## 恢复与上下文

- ledger 第一行必须绑定 plan identity。
- compaction 或中断后先核对 ledger、Git 历史和工作区状态，再从首个未完成任务恢复。
- 已完成任务不得重复分派；处于 fix round 的任务从下一轮继续。
- 交接只传 brief、report、review package 和必要的接口决策。
- reviewer 默认不重跑已有可信测试；证据缺失、过期、可疑或需要复现 finding 时才重跑。

## Bounded Fix Loop

- 默认最多两轮实现返工和两轮同 finding 回归。
- 第一轮失败后优先恢复原 producer，但下一轮输入必须发生可解释变化。
- 第二轮仍失败时不做原样重试；controller 逐项裁定 finding。
- `NEEDS_CONTEXT` 最多补两次，且必须具体到文件、规格、错误输出或命令。
- load-bearing finding 仍未关闭时停止并报告，不用“继续尝试”掩盖阻塞。

## Review 深度

| 任务 | Review |
|---|---|
| 1-2 个文件、机械修改 | implementer 自审 + controller 检查 |
| 多文件或接口变化 | 独立 task reviewer + scoped re-review |
| 架构、高风险、安全、性能 | 规格与质量分离，并追加对应专家审查 |

审查只覆盖当前任务；所有任务完成后再做一次整体 review 和最终集成验证。

## 模型选择

- 规格完整、机械任务：快速模型
- 多文件集成与一般 review：标准模型
- 架构判断、复杂故障和最终整体 review：更强模型

重试是否升级模型取决于失败原因，不因“贵”或“强”本身判断。记录实际 role 和 model；未指定时写 `platform-default`。

## 完成门禁

全部任务结束后：

1. 做 whole-change review，重点检查跨任务接口、重复实现和遗漏。
2. 运行主线程掌控的 fresh verification，不能只汇总 worker 报告。
3. 检查 dirty worktree、计划 workspace 和未决 finding。
4. 只有验证通过且 load-bearing finding 已关闭，才进入 branch finish。

## 输出

```text
Subagent delivery:
- Plan:
- Tasks completed:
- Agent roles / models:
- Files owned:
- Review verdicts:
- Fresh verification:
- Open findings:
- Workspace / cleanup state:
- Recommendation: <finish / fix / stop> because <evidence and trade-off>
```

## Red Flags

- worker 读取整个聊天历史或另一个计划的 scratch
- controller 与 worker 同时修改同一任务文件
- finding 没有复验标准，或修复后 reviewer 不回归
- 同一输入、同一模型、同一验证方式反复重派
- 用 worker 的“测试通过”代替主线程最终验证
- 没有处理用户原有 dirty changes 就生成补丁、清理或提交
