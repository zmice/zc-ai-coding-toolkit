# @zmice/zc

`@zmice/zc` 是 zc AI Coding Toolkit 的统一入口 CLI，也是当前仓库唯一对外发布的 npm 包。

它负责：

- runtime：启动单工人或团队协作运行时
- toolkit：查询 skills / commands / agents
- platform：生成、安装、更新和检查平台产物

它不负责：

- 上游治理型仓库事务
- `references` 的快照、审阅和导入提案

这些仓库级事务统一通过：

```bash
pnpm upstream -- <subcommand>
```

## 上游维护边界

`zc` 不直接提供 upstream 治理命令，但它的命令面和安装行为会持续对齐平台官方能力。

当前 CLI 维护主要跟踪三类上游：

- Codex 官方文档与 `AGENTS.md` / skills 机制
- Qoder 官方 CLI、commands、skills、agents 文档
- Qwen 官方 extensions、skills、`qwen extensions` 命令文档

也就是说：

- 内容参考上游的治理在 `references/`
- 平台行为与安装语义的维护体现在 `apps/cli` 和 `packages/platform-*`

仓库级 upstream 治理由下面入口承担：

```bash
pnpm upstream -- <subcommand>
```

## 安装

### npm 全局安装

```bash
npm install -g @zmice/zc
zc --help
```

### 仓库内构建运行

```bash
pnpm install
pnpm build
node apps/cli/dist/cli/index.js --help
```

### 仓库开发态 link

```bash
pnpm setup
pnpm install
pnpm build
pnpm --dir apps/cli link --global
zc --help
```

如果 `pnpm --dir apps/cli link --global` 报：

- `ERR_PNPM_NO_GLOBAL_BIN_DIR`

说明是 pnpm 环境未初始化，不是 `zc` 构建问题。

## 命令分层

### Runtime

- `zc run`
- `zc team ...`
- `zc task ...`
- `zc msg ...`
- `zc doctor`

### Toolkit

- `zc toolkit lint`
- `zc toolkit show <query>`
- `zc toolkit search <keyword>`
- `zc toolkit recommend <query>`

`<query>` 同时支持：

- 完整资产 ID，例如 `command:build`
- 唯一名称，例如 `build`

### Platform

- `zc platform generate <qwen|codex|qoder>`
- `zc platform install <qwen|codex|qoder>`
- `zc platform status <qwen|codex|qoder>`
- `zc platform update <qwen|codex|qoder>`
- `zc platform where <qwen|codex|qoder>`

常用参数：

- `--project`
- `--global`
- `--dir <path>`
- `--plan`
- `--json`
- `--force`

## 平台安装模型

### Codex

- 项目级：`AGENTS.md`
- 用户级 / 自定义目录：
  - `AGENTS.md`
  - `skills/zc-<command>/SKILL.md`
  - `skills/zc-<skill>/SKILL.md`

### Qoder

- 项目级：
  - `AGENTS.md`
  - `.qoder/commands`
  - `.qoder/skills`
  - `.qoder/agents`
- 用户级 / 自定义目录：
  - `AGENTS.md`
  - `commands`
  - `skills`
  - `agents`

### Qwen

- 项目级：
  - `.qwen/extensions/zc-toolkit/`
- 用户级 / 自定义目录：
  - `extensions/zc-toolkit/`
- 用户级默认优先通过官方 `qwen extensions` 管理

## 高频用法

```bash
# toolkit
zc toolkit lint --json
zc toolkit show command:start
zc toolkit search review
zc toolkit recommend build

# platform
zc platform where codex --global --json
zc platform install codex --global
zc platform status codex --global --json

zc platform install qoder --global
zc platform install qwen --global
zc platform status qwen --global --json
```

## 设计边界

- `command:start` 和 `command:product-analysis` 目前是 toolkit 内容入口，不是 CLI 子命令
- `sdd-tdd` 在内容层里属于 `full-delivery` workflow，而不是统一任务分诊入口
- `zc` 只承载已经落地的产品命令，不把内容层 canonical command 直接暴露成 CLI

## 开发

常改位置：

- `apps/cli/src/cli/`
- `apps/cli/src/runtime/`
- `apps/cli/src/team/`
- `apps/cli/src/utils/`

## 验证

```bash
pnpm --dir apps/cli test
pnpm --dir apps/cli build
pnpm --dir apps/cli verify
```

更完整的使用说明见：

- [../../docs/usage-guide.md](../../docs/usage-guide.md)
