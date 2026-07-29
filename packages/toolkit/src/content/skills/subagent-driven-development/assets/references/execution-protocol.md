# 子代理执行协议

进入多任务实现、需要恢复 ledger、处理 review loop 或设计文件交接时读取本文件。

## 角色

### Controller

- 拥有目标、计划、文件所有权、stop gate、fan-in 和最终验证
- 判断 finding 是否成立、是否阻塞、是否改派
- 不和已分配 worker 竞争同一文件

### Implementer

- 只读 task brief 和必要上下文
- 按 TDD 实现、自审、验证并写 report
- 优先修复自己引入的问题
- 不自行扩大范围、清理工作树或提交

### Reviewer

- 核对 scoped diff，不重做实现
- 同时给出规格合规与代码质量 verdict，或按高风险场景拆成两个 reviewer
- finding 包含风险、触发条件、期望结果和复验方式
- 修复后负责关闭或维持原 finding

## Plan Workspace

每个 plan 使用独立且被项目忽略的目录：

```text
<scratch-root>/<plan-id>/
├── progress.md
├── tasks/
├── reports/
├── review-packages/
└── reviews/
```

- `<scratch-root>` 按项目约定选择，不硬编码某个上游目录名
- `progress.md` 第一行：`# ledger — plan: <plan identity>`
- 每个文件写明 task、role、model、round 和生成时间
- `git clean -fdx` 可能删除 ignored scratch；Git 提交和用户文件不能依赖它才能恢复

## Task Brief

```text
Task:
- id:
- goal:
- exact requirements:
- allowed files:
- forbidden scope:
- existing interfaces:
- validation commands:
- loop budget:
- report path:
```

## Implementer Report

```text
Implementation report:
- status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
- changed files:
- behavior:
- red evidence:
- green evidence:
- regression evidence:
- self-review:
- concerns:
- fan-in items:
```

状态处理：

- `DONE`：生成 review package
- `DONE_WITH_CONCERNS`：先评估 correctness / scope concern，再决定是否 review
- `NEEDS_CONTEXT`：补最小、具体上下文后恢复同一任务
- `BLOCKED`：改变输入；计划错误或高风险歧义进入 stop gate

## Review Package

```text
Review package:
- task brief:
- base / head:
- commits:
- scoped diff:
- implementation report:
- binding constraints:
- verification evidence:
- known risks:
```

基线必须覆盖该任务全部提交，不能用会漏掉多提交的快捷范围。

## Review Record

```text
Review:
- spec verdict:
- quality verdict:
- findings:
  - severity:
  - evidence:
  - expected fix:
  - regression check:
- residual risk:
```

## Fix Round

```text
Fix round:
- task:
- finding:
- max rounds:
- current round:
- producer:
- changed input since last round:
- fix:
- reviewer:
- regression evidence:
- controller decision:
```

第一轮优先恢复原 producer，以保留实现上下文。预算耗尽后：

1. 逐项判断 finding 是否 load-bearing
2. 对成立问题缩小范围、改派更合适角色或 controller 接手
3. 对不成立或不阻塞问题记录裁定和风险
4. load-bearing finding 无法关闭时报告 `BLOCKED`

## Final Fan-In

```text
Final fan-in:
- completed tasks:
- cross-task interfaces:
- whole-change review:
- fresh verification:
- unresolved findings:
- dirty worktree state:
- scratch cleanup decision:
```

清理前确认 scratch 只属于当前 plan；分支、worktree 和提交生命周期由 branch-finish 流程另行处理。
