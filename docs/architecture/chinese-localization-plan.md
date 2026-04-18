# Implementation Plan: 中文化输出与 AI 引导适配

## Overview

本阶段目标是在不破坏命令、平台产物、文件名、JSON 键和代码 API 契约的前提下，将仓库中的用户可见输出、平台模板说明和高频提示资产尽可能中文化，并为后续更大范围的中文化奠定统一规则。

## Architecture Decisions

- 中文化仅作用于“用户可见说明层”，不改变技术契约层
- CLI 命令名、参数名、平台产物名、JSON/schema 键保持原样
- 优先改高频入口：
  - `apps/cli`
  - `packages/platform-*`
  - `packages/toolkit` 中 command / agent 的高频引导
- 先做单向中文优先，不在本轮引入 `zh/en` 切换能力

## Task List

### Phase 1: CLI 输出层

## Task 1: 梳理并中文化 `apps/cli` 的用户可见输出

**Description:** 将 `apps/cli/src/cli/**` 中帮助文案、状态输出、错误解释和安装/检查提示统一为中文优先表达，同时保留命令字、路径和平台名等技术标识不变。

**Acceptance criteria:**
- [ ] `apps/cli/src/cli/**` 中面向用户的输出默认优先中文
- [ ] 命令名、参数名、子命令名保持不变
- [ ] 常见状态输出和错误提示不再出现无必要英文句子

**Verification:**
- [ ] 测试通过：`pnpm --dir apps/cli test`
- [ ] 构建通过：`pnpm --dir apps/cli build`
- [ ] 手动检查：`node apps/cli/dist/cli/index.js --help`

**Dependencies:** None

**Files likely touched:**
- `apps/cli/src/cli/index.ts`
- `apps/cli/src/cli/doctor.ts`
- `apps/cli/src/cli/team.ts`
- `apps/cli/src/cli/toolkit.ts`
- `apps/cli/src/cli/platform.ts`
- `apps/cli/src/cli/upstream.ts`

**Estimated scope:** Medium

## Task 2: 为 CLI 中文化补代表性断言

**Description:** 为高频 CLI 输出补最小必要的测试/断言，防止后续回归成英文输出。

**Acceptance criteria:**
- [ ] 至少覆盖 2-3 个高频命令的中文输出断言
- [ ] 断言不绑定脆弱的完整字符串，仅验证关键中文语义

**Verification:**
- [ ] 测试通过：`pnpm --dir apps/cli test`

**Dependencies:** Task 1

**Files likely touched:**
- `apps/cli/src/**/__tests__/*.test.ts`

**Estimated scope:** Small

### Checkpoint: CLI

- [ ] `pnpm --dir apps/cli verify`
- [ ] 用户可见 CLI 输出主路径已中文化

### Phase 2: Platform 模板层

## Task 3: 中文化 `packages/platform-*` 的用户说明模板

**Description:** 将 Qwen/Codex/Qoder 平台模板中展示给最终用户的说明文本改为中文优先，同时保留模板占位和目标产物文件名不变。

**Acceptance criteria:**
- [ ] `packages/platform-qwen/templates/**` 说明优先中文
- [ ] `packages/platform-codex/templates/**` 说明优先中文
- [ ] `packages/platform-qoder/templates/**` 说明优先中文
- [ ] 产物文件名和模板插值逻辑保持兼容

**Verification:**
- [ ] 测试通过：`pnpm --dir packages/platform-qwen verify`
- [ ] 测试通过：`pnpm --dir packages/platform-codex verify`
- [ ] 测试通过：`pnpm --dir packages/platform-qoder verify`
- [ ] 手动检查：`node apps/cli/dist/cli/index.js platform generate qwen -o /tmp/qwen-zh-check`

**Dependencies:** None

**Files likely touched:**
- `packages/platform-qwen/templates/QWEN.md`
- `packages/platform-qwen/templates/qwen-extension.json`
- `packages/platform-codex/templates/AGENTS.md`
- `packages/platform-qoder/templates/instructions.md`

**Estimated scope:** Medium

## Task 4: 中文化 platform README 与安装提示

**Description:** 将 platform 包 README 和安装生成相关提示对齐到中文优先表述，保持技术标识原样。

**Acceptance criteria:**
- [ ] 3 个 platform 包 README 中文优先
- [ ] 安装/生成输出中的面向用户说明中文优先

**Verification:**
- [ ] 构建通过：`pnpm verify`
- [ ] 手动检查 generate/install 输出

**Dependencies:** Task 3

**Files likely touched:**
- `packages/platform-qwen/README.md`
- `packages/platform-codex/README.md`
- `packages/platform-qoder/README.md`
- `packages/platform-*/src/index.ts`

**Estimated scope:** Small

### Checkpoint: Platform

- [ ] `pnpm verify`
- [ ] 平台模板与安装提示中文化完成

### Phase 3: Toolkit 高优先内容层

## Task 5: 中文化高频 command 资产

**Description:** 优先中文化高频入口 command 资产，使 AI 对用户的流程引导默认中文输出。

高优先集合：
- `spec`
- `task-plan`
- `build`
- `quality-review`
- `verify`
- `commit`
- `debug`
- `onboard`
- `ship`
- `sdd-tdd`

**Acceptance criteria:**
- [ ] 高优先 command 的 `body.md` 默认中文引导
- [ ] 必须保留的命令字和技术标识原样保留
- [ ] `meta.yaml` 的说明字段尽量中文化

**Verification:**
- [ ] 测试通过：`pnpm --dir packages/toolkit verify`
- [ ] 手动检查：`node apps/cli/dist/cli/index.js toolkit manifest`

**Dependencies:** None

**Files likely touched:**
- `packages/toolkit/src/content/commands/*/{meta.yaml,body.md}`

**Estimated scope:** Medium

## Task 6: 中文化高频 agent/skill 引导片段

**Description:** 处理最常被用户直接感知的 agent/skill 引导内容，先覆盖高频入口，不在本轮做全量翻译。

高优先集合：
- `agents/architect`
- `agents/code-reviewer`
- `agents/product-owner`
- `skills/sdd-tdd-workflow`
- `skills/spec-driven-development`
- `skills/planning-and-task-breakdown`
- `skills/test-driven-development`
- `skills/code-review-and-quality`

**Acceptance criteria:**
- [ ] 高优先 agent/skill 中面向用户的引导默认中文
- [ ] 技术术语、命令、代码片段保持兼容
- [ ] 不对低频长文进行无边界全量翻译

**Verification:**
- [ ] 测试通过：`pnpm --dir packages/toolkit verify`

**Dependencies:** Task 5

**Files likely touched:**
- `packages/toolkit/src/content/agents/*/{meta.yaml,body.md}`
- `packages/toolkit/src/content/skills/*/{meta.yaml,body.md}`

**Estimated scope:** Medium

### Checkpoint: Toolkit

- [ ] `pnpm --dir packages/toolkit verify`
- [ ] 高频引导资产中文优先

### Phase 4: 文档与回归保护

## Task 7: 对齐仓库文档与中文化规则

**Description:** 将 README 和长期架构文档与中文化策略对齐，明确哪些可以翻译、哪些必须保持英文契约。

**Acceptance criteria:**
- [ ] README 中文优先
- [ ] 中文化规则在长期文档中可查
- [ ] 文档不与现有行为冲突

**Verification:**
- [ ] 文档引用正确
- [ ] `git diff --check`

**Dependencies:** Task 1, Task 3, Task 5

**Files likely touched:**
- `README.md`
- `docs/architecture/chinese-localization.md`

**Estimated scope:** Small

## Task 8: 全链路回归验证

**Description:** 对整轮中文化改造执行一次根级验证，确认输出变化未破坏功能。

**Acceptance criteria:**
- [ ] `pnpm verify` 通过
- [ ] `pnpm changeset status` 正常
- [ ] 关键 generate/install 流程未被中文化破坏

**Verification:**
- [ ] `pnpm verify`
- [ ] `pnpm changeset status`
- [ ] `git diff --check`

**Dependencies:** Task 2, Task 4, Task 6, Task 7

**Files likely touched:**
- none or verification-only

**Estimated scope:** Small

### Checkpoint: Complete

- [ ] 所有高优先用户可见输出中文优先
- [ ] 技术契约未受影响
- [ ] 根级验证通过
- [ ] 可以进入提交阶段

## Parallelization Opportunities

可安全并行：

- Agent 1: `apps/cli/**`
  - Task 1 + Task 2
- Agent 2: `packages/platform-*/**`
  - Task 3 + Task 4
- Agent 3: `packages/toolkit/src/content/commands/**`
  - Task 5
- Agent 4: `packages/toolkit/src/content/{agents,skills}/**`
  - Task 6

需要串行/收口：

- Task 7 文档对齐
- Task 8 全链路回归验证

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 中文化误改技术契约 | High | 明确“不翻译边界”，只改用户可见说明 |
| toolkit 长文本改动过大 | Medium | 先做高频资产，不做全量翻译 |
| 各平台模板中文化后断言失效 | Medium | 同步更新对应测试与 smoke check |
| CLI 输出中文化导致测试脆弱 | Medium | 用关键语义断言，不绑定整句 |

## Open Questions

- 本轮是否只做“高优先资产中文化”，低频长文后续再分批处理
- 是否后续引入 `--lang zh|en` 作为增强项，而不是本轮目标
