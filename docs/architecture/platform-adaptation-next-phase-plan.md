# Platform Adaptation Maintenance Plan

## 目标

上一轮平台深化的四个 wave 已经进入当前实现：

1. `Qwen` 发布态扩展模型
2. `OpenCode` agents
3. `Claude` 保守能力边界
4. `platform uninstall / repair / doctor`

接下来不再按“新增平台 surface”推进，而是按维护计划收口：

- 文档事实对齐
- platform-core 去重
- 上下文预算审计
- 验证门禁分层

## Wave 1：事实对齐（串行）

目标：

- `platform-capability-matrix` 区分官方能力边界与 `zc` 当前实现
- `platform-adaptation-next-phase` 改为 current state，不再保留“第一版未覆盖 agents”等旧判断
- `workflow-entry-routing` 去掉旧平台暴露矩阵，统一到当前四个平台

验证：

- `git diff --check`
- `rg -n "第一版还未覆[盖]|不应跑在平台能力矩[阵]前面" docs README.md packages`
- 单独确认旧平台名只保留在 `docs/architecture/legacy-root-retirement.md` 的退役说明中

## Wave 2：platform-core 去重（串行）

目标：

- frontmatter 渲染、slug 生成、asset list、Markdown artifact 构建统一放到 `platform-core`
- 各平台包保留 capability、scope layout 和平台特化模板
- 平台输出路径和正文格式保持稳定

涉及：

- `packages/platform-core/src/index.ts`
- `packages/platform-core/src/index.test.ts`
- `packages/platform-qwen/src/index.ts`
- `packages/platform-codex/src/index.ts`
- `packages/platform-claude/src/index.ts`
- `packages/platform-opencode/src/index.ts`

验证：

- `pnpm --dir packages/platform-core test`
- 四个 `packages/platform-*` 包测试

## Wave 3：上下文预算审计（串行）

目标：

- 新增只读脚本统计各平台生成 artifact 的 entry / commands / skills / agents / metadata 字节量
- 输出默认 Markdown，`--json` 供脚本消费
- 文档中明确：体量增长时优先按 `tier / audience / platform_exposure` 收紧默认资产集，不盲目删源内容

涉及：

- `scripts/content-budget-audit.mjs`
- root `package.json`
- `README.md`
- `docs/usage-guide.md`

验证：

- `pnpm audit:context -- --json`

## Wave 4：验证门禁收口（串行）

目标：

- 明确 `pnpm verify:mvp` 是发布态 smoke
- 明确 `pnpm verify` 是全量本地门禁
- 明确 `pnpm release:check` 是发布门禁
- 保持 AGENTS / README / usage guide 叙述一致

验证：

- `git diff --check`
- `pnpm verify`
- 必要时补跑 `pnpm verify:mvp`

## 本轮不做

- 不恢复 `qoder`
- 不新增 `zc start` CLI
- 不扩大 Codex 官方能力声明
- 不改变平台产物的用户可见触发语义
- 不把 upstream live remote 审查混入本轮结构整理
