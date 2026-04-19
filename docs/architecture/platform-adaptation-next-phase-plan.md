# Platform Adaptation Next Phase Plan

## 目标

按既定优先级推进平台适配深化：

1. `Qwen` 发布态扩展模型
2. `OpenCode` agents
3. `Claude` 能力再核查
4. `platform uninstall / repair / doctor`

执行策略：

- 先串行定 contract
- 再按写入面并行实现
- 最后串行验证与审查

## Wave 1：Qwen 发布态扩展模型（串行）

### Task 1.1 固定开发态与发布态边界

输出：

- 长期文档中明确：
  - source bundle
  - release bundle
  - 官方 CLI 安装如何消费两者

涉及：

- `docs/architecture/platform-adaptation-next-phase.md`
- `docs/architecture/platform-capability-matrix.md`
- `packages/platform-qwen/README.md`

### Task 1.2 收口 release bundle contract

目标：

- 给 Qwen 定义一个可独立导出的 extension bundle
- bundle 至少包含：
  - `QWEN.md`
  - `qwen-extension.json`
  - `commands/`
  - `skills/`
  - `agents/`
- 明确版本来源与目录命名

涉及：

- `packages/platform-qwen/src/index.ts`
- `packages/platform-qwen/src/index.test.ts`
- `apps/cli/src/utils/qwen-extension-cli.ts`
- `apps/cli/src/cli/platform.ts`

### Task 1.3 文档和状态语义对齐

目标：

- `status/update` 能区分当前是开发态 link 还是发布态 bundle
- 不直接实现远程仓库安装，但留出后续接入点

涉及：

- `apps/cli/src/cli/platform.ts`
- `docs/usage-guide.md`
- `README.md`

## Wave 2：OpenCode agents（可并行）

### Lane A：platform-opencode 实现

目标：

- 支持 `agent` 资产落盘到：
  - 项目级 `.opencode/agents/zc-<agent>.md`
  - 用户级 `~/.config/opencode/agents/zc-<agent>.md`
  - `--dir` 模式 `agents/zc-<agent>.md`

涉及：

- `packages/platform-opencode/src/index.ts`
- `packages/platform-opencode/src/index.test.ts`

### Lane B：CLI capability 与说明同步

目标：

- `where/install/status --json` 正确显示 `agents-dir`
- README / usage / capability matrix 去掉“第一版不上 agents”

涉及：

- `apps/cli/src/cli/platform.ts`
- `apps/cli/src/cli/__tests__/platform.test.ts`
- `packages/platform-opencode/README.md`
- `docs/usage-guide.md`
- `docs/architecture/platform-capability-matrix.md`

## Wave 3：Claude 能力再核查（可并行）

### Lane C：官方边界复核

目标：

- 再核一次官方文档
- 只吸收明确新增能力
- 若无新增，则保持当前 surface 不变

涉及：

- `docs/architecture/platform-capability-matrix.md`
- `packages/platform-claude/README.md`

### Lane D：现有投影与入口文案深化

目标：

- 强化 `CLAUDE.md` 入口说明
- 收紧 commands / agents 的默认使用说明
- 保持 `/zc-*` 命名空间边界

涉及：

- `packages/platform-claude/src/index.ts`
- `packages/platform-claude/src/index.test.ts`

## Wave 4：platform uninstall / repair / doctor（串行）

前置条件：

- Wave 1-3 已完成
- 各平台 capability 已稳定

### Task 4.1 定义运维 contract

目标：

- 明确 `uninstall / repair / doctor` 的输入输出
- 明确 receipt、capability、status 的依赖关系

### Task 4.2 CLI 落地

涉及：

- `apps/cli/src/cli/platform.ts`
- 新增或更新相关 utils / tests

### Task 4.3 平台差异化诊断

目标：

- 在通用 contract 上补平台特化诊断信息
- 不维护第二套安装实现

## 验证

每波结束至少执行：

- `pnpm --dir apps/cli build`
- `pnpm --dir apps/cli test -- src/cli/__tests__/platform.test.ts`
- 目标平台包测试
- `git diff --check`

整轮收口执行：

- `pnpm verify`
- `node scripts/verify-workspace.mjs`
- 按 `code-review-and-quality` 做最终审查

## 本轮不做

- 不恢复 `qoder`
- 不为 Claude 发明插件模型
- 不在 Qwen 发布态模型未稳定前直接上 GitHub URL 安装
- 不在 OpenCode agents 之外追加更深的运行时 agent 语义
- 不在平台 surface 仍在变化时先做大而全的 doctor 命令
