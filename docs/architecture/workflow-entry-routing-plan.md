# Workflow Entry Routing Plan

## 目标

把当前分散的 workflow / command 入口收敛为“统一任务开始入口 + 显式路由元数据”，并保持：

- `toolkit` 继续作为唯一内容事实源
- Codex / Qwen / Claude / OpenCode 不共享错误的命令触发语义
- 先稳定内容模型，再决定 CLI / 平台如何消费

## 总体策略

先做内容建模，再做推荐与平台适配，不在第一波直接改 CLI 产品面。

这样可以避免：

- 一边改元数据，一边改 CLI，导致路由逻辑反复返工
- 把 Codex 错误适配成伪 slash command
- 平台层先跑到内容模型前面

## Wave 1：内容模型收口（串行）

### Task 1.1 新增统一入口命令

新增：

- `packages/toolkit/src/content/commands/start/`

内容职责：

- intake
- task classification
- workflow routing
- 推荐下一条 workflow 入口

要求：

- 明确区分 feature / bugfix / review / docs / release / investigation
- 明确“先判型，再选流程”
- 不假定所有平台都存在同名原生命令
- 不把它写成当前已实现的 `zc start`

### Task 1.2 扩展 command/skill 元数据

在 `ToolkitAssetMeta` 中新增 workflow 路由字段：

- `workflow_family`
- `workflow_role`
- `task_types`
- `platform_exposure`

同时更新：

- `packages/toolkit/src/types.ts`
- `packages/toolkit/src/schema/asset-meta.ts`

### Task 1.3 为核心 commands 补 workflow 元数据

首批补齐对象：

- `start`
- `sdd-tdd`
- `spec`
- `plan-review`
- `task-plan`
- `build`
- `quality-review`
- `verify`
- `debug`
- `doc`
- `ship`
- `onboard`
- `ctx-health`

目标：

- 明确 workflow family
- 明确 task type
- 明确平台暴露方式
- 明确它们服务于内容路由，而不是声明对应 CLI 已实现

## Wave 2：推荐与关系图增强（可并行）

### Lane A：query / recommend 结构增强

目标：

- 让 `recommend` 能返回 workflow 路由信息
- 不只是 required / suggested

最低要求：

- 返回 target 的 workflow family
- 返回 target 的 workflow role
- 返回推荐起始入口
- 返回任务类型与建议 workflow

涉及：

- `packages/toolkit/src/query/toolkit-query.ts`
- `apps/cli/src/cli/toolkit.ts`
- 对应测试

### Lane B：核心 workflow 内容补文案

目标：

- 在 `start`、`sdd-tdd` 和核心阶段命令中明确“统一入口 / 阶段入口 / 专项入口”的分工

涉及：

- `packages/toolkit/src/content/commands/start/*`
- `packages/toolkit/src/content/commands/sdd-tdd/*`
- 核心 commands 正文

### Lane C：平台暴露模型文档化

目标：

- 把 canonical command 与 platform exposure 的两层规则写进长期文档
- 明确 Codex 是自然语言入口 / prompt-entry，不是 slash command
- 明确 Qwen / Claude / OpenCode 各自使用不同的 command-style 入口，不承诺完全相同的触发机制

涉及：

- `docs/architecture/workflow-entry-routing.md`
- `apps/cli/README.md`
- `docs/usage-guide.md`
- 各平台 README（只更新规则，不立即实现平台模板）

## Wave 3：验证与收口（串行）

### Task 3.1 schema / lint / query 验证

运行：

- `pnpm --dir packages/toolkit test`
- `node apps/cli/dist/cli/index.js toolkit lint --json`
- `pnpm --dir apps/cli test -- src/cli/__tests__/toolkit.test.ts`

### Task 3.2 根级验证

运行：

- `pnpm verify`
- `git diff --check`

### Task 3.3 内容审查

按 `code-review-and-quality` 做一轮 review，重点看：

- workflow family 是否清晰
- `start` 是否真的只负责 intake，不抢夺阶段命令职责
- Codex 适配文案是否误导为 slash command

## 并行拆分建议

可并行：

- Lane A：query / recommend
- Lane B：workflow 正文与新 command:start
- Lane C：平台暴露文档

应串行：

- schema/types 变更
- 最终 lint / verify / review

## 本轮不做

- 不直接实现 `zc start`
- 不修改平台模板产物格式
- 不批量重命名现有命令
- 不让 Codex 暴露伪 slash command

## 成功标准

完成后应满足：

1. `toolkit` 中存在统一任务入口 `command:start`
2. 核心 commands 具备结构化 workflow 路由元数据
3. `recommend` 能表达“从哪条 workflow 开始”
4. 文档明确区分：
   - canonical command
   - platform exposure
5. `pnpm verify` 继续通过
6. 文档明确：
   - `command:start` 是 toolkit 内容入口
   - 当前没有 `zc start` CLI
