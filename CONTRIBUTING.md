# Contributing

欢迎提交 issue、讨论和 PR。

这个仓库已经把内容层、CLI、平台安装层和上游治理层拆开了。提交改动前，先确认你改的是哪一层。

## 环境要求

- Node.js `>= 20`
- `pnpm@10.13.1`

## 开发准备

```bash
pnpm install
pnpm build
pnpm verify
```

如果你只改某一层，也至少跑对应层的最小验证。

## 改动入口

### 改 CLI

优先看：

- [apps/cli/README.md](apps/cli/README.md)

### 改内容

优先看：

- [packages/toolkit/README.md](packages/toolkit/README.md)

### 改平台安装

优先看：

- [packages/platform-qwen/README.md](packages/platform-qwen/README.md)
- [packages/platform-codex/README.md](packages/platform-codex/README.md)
- [packages/platform-qoder/README.md](packages/platform-qoder/README.md)

### 改上游治理

优先看：

- [references/README.md](references/README.md)

## 内容层规则

- 内容真相只在 `packages/toolkit/src/content/`
- 不要把平台生成产物回写为源码
- 修改内容时，尽量同步更新：
  - `tier`
  - `audience`
  - `stability`
  - `source`
  - 关系字段

## 文档规则

- 面向仓库长期维护的文档才放进 `docs/`
- 一次性计划、阶段拆解、临时草稿不要留仓库
- 仓库内文档链接使用相对路径，不使用本机绝对路径

## 验证规则

最小要求：

- 文档改动：`git diff --check`
- toolkit 内容改动：`zc toolkit lint --json` + 对应测试
- CLI 或平台逻辑改动：对应包测试 + `pnpm verify`

常用命令：

```bash
pnpm verify
pnpm --dir apps/cli test
pnpm --dir packages/toolkit test
node scripts/verify-workspace.mjs
```

## 提交边界

- 不要顺手提交无关改动
- 不要把 `dist/` 或其他生成产物当成源码改
- 如果工作树中已有与你任务无关的脏改动，避免把它们带进提交

## 发布

当前只对外发布：

- `@zmice/zc`

发版前请阅读：

- [docs/release-guide.md](docs/release-guide.md)
- [docs/release-checklist.md](docs/release-checklist.md)
