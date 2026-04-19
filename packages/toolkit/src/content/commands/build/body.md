这是 `command:start` 之后的 **实现阶段入口**。

当 `command:start`、`command:task-plan` 或 `command:plan-review` 已经把任务和边界收敛好，就从这里接力到 `incremental-implementation` + `test-driven-development`，按任务逐个实现。

## 当前阶段要做什么

对每个任务严格执行 TDD 循环：

1. 读取验收标准，加载必要上下文
2. **Red**：先写失败测试，定义期望行为
3. **Green**：写最小实现，让测试通过
4. **Refactor**：在保持绿色前提下简化实现
5. 运行回归验证，确认无新破坏
6. 完成当前切片后再进入下一个任务

Bug 修复使用 Prove-It 模式：先写复现测试，再修复，再回归。

## 当前阶段的边界

- 只实现当前任务需要的最小改动
- 规格和计划有问题时，先停下回退，不要硬写
- 遇到失败先定位根因，不要继续堆代码

## 从这里通常接到哪里

- 当前实现完成：进入 `command:quality-review`
- 需要确认“是否真的完成”：进入 `command:verify`
- 发现计划或规格失真：回到 `command:task-plan` 或 `command:spec`

## 使用方式

提供要实现的任务、功能或修复目标，我会按 TDD 循环推进，并明确什么时候该切到审查阶段。
