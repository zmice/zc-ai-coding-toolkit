# AI Coding Toolkit Monorepo

AI Coding Toolkit 已切换到 **monorepo source model**。

当前仓库的源码真相分层如下：

- `apps/cli`
  - `zc` 统一入口 CLI
  - 负责 runtime、toolkit、platform、upstream 命令编排
- `packages/toolkit`
  - skills / commands / agents 的唯一事实源
  - 使用 `meta.yaml + body.md + assets/` 结构
- `packages/platform-qwen`
  - Qwen 平台生成与安装骨架
- `packages/platform-codex`
  - Codex 平台生成与安装骨架
- `packages/platform-qoder`
  - Qoder 平台生成与安装骨架
- `references`
  - 上游治理、审阅记录、快照
- `docs/adr` / `docs/architecture`
  - 架构决策和迁移说明

## Current Status

当前仓库已经具备 monorepo MVP：

- root workspace contract 已建立
- `zc toolkit validate` 可用
- `zc upstream list/show/review` 可用
- `zc platform generate qwen|codex|qoder` 可用
- `zc platform install qwen|codex|qoder` 可用
- `zc platform generate/install --plan --format json` 可用
- `zc platform install` 可自动解析最近项目根作为安装目录
- root `verify:mvp` 可执行最小闭环验证

验证命令：

```bash
pnpm verify
node scripts/verify-workspace.mjs
```

## Workspace Layout

```text
.
├── apps/
│   └── cli/
├── packages/
│   ├── toolkit/
│   ├── platform-qwen/
│   ├── platform-codex/
│   └── platform-qoder/
├── references/
├── docs/
│   ├── adr/
│   └── architecture/
├── scripts/
├── tests/
├── package.json
└── pnpm-workspace.yaml
```

## Legacy Source Model

以下根目录内容已经从仓库根删除，并完成 source-of-truth 迁移：

- `skills/`
- `commands/`
- `agents/`
- `QWEN.md`
- `AGENTS.md`
- `instructions.md`
- `UPSTREAM.md`

新的 authoritative source：

- skills / commands / agents：`packages/toolkit/src/content/`
- 平台入口产物：由 `packages/platform-*` 生成
- 上游治理：`references/upstreams.yaml`

## Key Commands

```bash
# toolkit
node apps/cli/dist/cli/index.js toolkit validate
node apps/cli/dist/cli/index.js toolkit manifest

# platform
node apps/cli/dist/cli/index.js platform generate qwen -o /tmp/qwen-out
node apps/cli/dist/cli/index.js platform install codex -o /tmp/codex-out
node apps/cli/dist/cli/index.js platform install codex
node apps/cli/dist/cli/index.js platform generate qwen --plan --format json
node apps/cli/dist/cli/index.js platform install codex --plan --format json

# upstream governance
node apps/cli/dist/cli/index.js upstream list
node apps/cli/dist/cli/index.js upstream show legacy-root-source-model
node apps/cli/dist/cli/index.js upstream review

# full MVP verification
pnpm verify
node scripts/verify-workspace.mjs
```

`zc platform install <target>` 在未传 `-o` 时，会优先向上寻找最近的项目根标记（`.git`、`pnpm-workspace.yaml`、`package.json`），找不到时才回退到当前工作目录。

## Migration Notes

- 旧根目录 source model 已删除，不再存在回写入口
- 平台入口和安装链路都应通过 `apps/cli` 与 `packages/platform-*` 处理
- 新增平台或内容类型时，优先扩展 `packages/*` 与 `references/`

## 中文化规则

- 默认优先中文输出：CLI 提示、平台模板说明、面向用户的 AI 引导尽量使用中文
- 技术契约保持原样：命令名、参数名、文件名、JSON 键、平台产物名不做中文化
- 详细规则见：
  - [docs/architecture/chinese-localization.md](/mnt/e/workspace/apps/ai-coding/docs/architecture/chinese-localization.md:1)
  - [docs/architecture/chinese-localization-plan.md](/mnt/e/workspace/apps/ai-coding/docs/architecture/chinese-localization-plan.md:1)

更多背景见：

- [docs/architecture/monorepo-layers.md](/mnt/e/workspace/apps/ai-coding/docs/architecture/monorepo-layers.md:1)
- [docs/architecture/legacy-root-retirement.md](/mnt/e/workspace/apps/ai-coding/docs/architecture/legacy-root-retirement.md:1)
