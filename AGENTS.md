# AI Coding Toolkit

## 项目定位

这是一个 AI 编码工具包 monorepo。

- `apps/cli`：`zc` 统一入口 CLI，负责 runtime、toolkit、platform 命令编排
- `packages/toolkit`：skills / commands / agents 的唯一事实源
- `packages/platform-*`：平台适配与安装/生成实现
- `references`：上游治理、审阅记录、快照

不要把 prompt 内容源码放回仓库根目录。内容修改默认发生在 `packages/toolkit/src/content/`。

## 高频命令

- 安装依赖：`pnpm install`
- 全量验证：`pnpm verify`
- workspace 最小验证：`node scripts/verify-workspace.mjs`
- CLI 定向测试：`pnpm --dir apps/cli test`
- toolkit 定向测试：`pnpm --dir packages/toolkit test`

常用 CLI：

- `node apps/cli/dist/cli/index.js toolkit lint --json`
- `node apps/cli/dist/cli/index.js toolkit show <id>`
- `node apps/cli/dist/cli/index.js toolkit search <keyword>`
- `node apps/cli/dist/cli/index.js toolkit recommend <id>`
- `node apps/cli/dist/cli/index.js platform generate <qwen|codex|claude|opencode> --plan --format json`
- `node apps/cli/dist/cli/index.js platform install <qwen|codex|claude|opencode> --plan --format json`
- `pnpm upstream -- list`
- `pnpm upstream -- report <id|all> --format md`

## 代码与内容边界

- 内容真相只在 `packages/toolkit`
- 平台包消费 toolkit，不维护第二份内容
- `references` 是治理层，不是运行时依赖
- `docs/architecture` 和 `docs/adr` 记录长期文档，不放过程性临时计划
- `docs/README.md` 定义 `docs/` 的职责边界

## 内容模型

每个资产单元使用：

- `meta.yaml`
- `body.md`
- 可选 `assets/`

`meta.yaml` 目前的关键治理字段包括：

- `tier`
- `audience`
- `stability`
- `source`
- `requires / suggests / conflicts_with / supersedes`

命名采用三层：

- `source identity`：对齐上游同步
- `workspace identity`：本仓库稳定 id
- `display title`：用户可见中文标题

## 修改规则

- 手工编辑用 `apply_patch`
- 搜索优先用 `rg`
- 不要无故改动 generated/dist 产物
- 不要把平台入口文件重新变成手工源码
- 不要破坏 `source.origin_*` 与 `references/upstreams.yaml` 的一致性

## 验证规则

声明完成前至少给出实际验证证据。常见最低要求：

- 文档/上下文改动：`git diff --check`
- toolkit 内容改动：`toolkit lint` + 相关测试
- CLI 或平台逻辑改动：对应包测试 + `pnpm verify`

## 任务路由

- 改 CLI：先看 `apps/cli/README.md`
- 改内容：先看 `packages/toolkit/README.md`
- 改平台适配：先看 `packages/platform-*/README.md`
- 看上游来源：先看 `references/README.md` 和 `references/upstreams.yaml`
- 看项目地图：`docs/architecture/project-context.md`

## 中文化

- 默认优先中文输出
- 命令名、参数名、文件名、JSON 键、平台产物名保持原样
- 详细规则见 `docs/architecture/chinese-localization.md`
