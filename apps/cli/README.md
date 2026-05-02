# @zmice/zc

`@zmice/zc` 是 zc AI Coding Toolkit 的统一入口 CLI，也是当前仓库唯一对外发布的 npm 包。

相关入口：

- 源码仓库：<https://github.com/zmice/zc-ai-coding-toolkit>
- 问题反馈：<https://github.com/zmice/zc-ai-coding-toolkit/issues>
- Qwen 扩展仓库：<https://github.com/zmice/zc-qwen-extension>

如果你是从 npm 页面进入，先记住这件事：

- `zc` 不是单个平台插件
- 它是一个统一入口安装器
- 用来给 Codex、Claude Code、OpenCode、Qwen 安装、更新、诊断和导出结构化 AI 编码内容

## 最短路径

```bash
npm install -g @zmice/zc
zc platform plugin codex
```

不传 `--dir` / `--project` / `--global` 时默认使用项目级目标；用户级 Codex plugin 使用：

```bash
zc platform plugin codex --global
```

`plugin` 子命令当前只支持 Codex。其他平台使用 install 路线，可按需追加 `--global`：

```bash
zc platform install <claude|opencode|qwen> [--global]
```

如果你只是想安装和更新平台内容，优先看：

- `安装`
- `平台安装模型`
- `命名空间适配`
- `高频用法`

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

需要当前远端 HEAD 作为审阅证据时，使用 upstream 子命令的 `--with-remote`，例如：

```bash
pnpm upstream -- report all --format md --with-remote
```

## 支持的平台

| 平台 | 当前安装形态 | 统一入口适配 |
| --- | --- | --- |
| Codex | 传统：`AGENTS.md` + `config.toml` + `skills/` + `agents/`；插件：薄 `AGENTS.md` 入口 + `zc-toolkit` marketplace plugin + `agents/` | 传统 `zc:start -> $zc-start`；插件 `zc:start -> $start` |
| Claude Code | `CLAUDE.md` + `commands/` + `agents/` | `zc:start -> /zc-start` |
| OpenCode | `AGENTS.md` + `commands/` + `skills/` + `agents/` | `zc:start -> /zc-start` |
| Qwen | `QWEN.md` + extension 目录 | `zc:start -> zc:start` |

用户级 Qwen 安装默认会优先走官方扩展链：

- 安装源：`https://github.com/zmice/zc-qwen-extension.git`
- 安装方式：`qwen extensions install`
- 更新方式：`qwen extensions update zc-toolkit`

## 参考边界

`zc` 不直接提供 upstream 治理命令，但它的命令面和安装行为会持续对齐平台官方能力与成熟社区实践。

CLI 侧当前重点参考：

- `oh-my-codex`
- Codex 官方 `AGENTS.md` / skills 文档
- Claude Code 官方 memory / slash commands / sub-agents 文档
- OpenCode 官方 rules / commands / skills / agents 文档
- Qwen 官方 extensions / skills / `qwen extensions` 文档

也就是说：

- 内容参考上游的治理在 `references/`
- CLI 只吸收与命令体验、安装语义、平台适配直接相关的部分

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

## 使用者与维护者

### 普通使用者

最常见的是这条循环：

```bash
zc platform plugin codex --plan
zc platform plugin codex
```

如果使用用户级或传统平台安装模型，则是：

```bash
zc platform plugin codex --global
zc platform where codex --global --json
zc platform install codex --global
zc platform status codex --global --json
zc platform update codex --global --plan --json
```

### 仓库维护者

如果你在维护 monorepo 本身，更常用的是：

```bash
pnpm install
pnpm --dir apps/cli build
pnpm --dir apps/cli test
pnpm audit:context
pnpm verify:mvp
pnpm verify
```

验证门禁语义：

- `pnpm verify:mvp` 是发布态 smoke，等价于 `node scripts/verify-workspace.mjs`
- `pnpm verify` 是全量本地门禁
- `pnpm release:check` 是发布门禁

## 命令分层

### Runtime

- `zc run`
- `zc team ...`
- `zc task ...`
- `zc msg ...`
- `zc doctor`

团队并行先 dry-run，再启动：

```bash
zc team plan -w 2 \
  -t "API | files=src/api.ts,src/api.test.ts" \
  -t "UI | files=src/ui.ts,src/ui.test.ts" \
  --json

zc team start -w "w1:codex,w2:codex" \
  -t "API | files=src/api.ts,src/api.test.ts" \
  -t "UI | files=src/ui.ts,src/ui.test.ts"
```

`zc team start` 会保守检查并行安全：多 worker 任务必须声明 `files=`，文件冲突或 `deps=` 依赖会阻止盲目并行。worktree 默认使用 `.worktrees/`，该目录必须被 git ignore；关闭前先用 `zc team shutdown <name> --plan` 查看 fan-in 状态。

### Toolkit

- `zc toolkit lint`
- `zc toolkit show <query>`
- `zc toolkit search <keyword>`
- `zc toolkit recommend <query>`

`<query>` 同时支持：

- 完整资产 ID，例如 `command:build`
- 唯一名称，例如 `build`

### Platform

- `zc platform generate <qwen|codex|claude|opencode>`
- `zc platform plugin codex`
- `zc platform install <qwen|codex|claude|opencode>`
- `zc platform status <qwen|codex|claude|opencode>`
- `zc platform update <qwen|codex|claude|opencode>`
- `zc platform uninstall <qwen|codex|claude|opencode>`
- `zc platform repair <qwen|codex|claude|opencode>`
- `zc platform doctor <qwen|codex|claude|opencode>`
- `zc platform where <qwen|codex|claude|opencode>`

常用参数：

- `--project`
- `--global`
- `--dir <path>`
- `--plan`
- `--json`
- `--force`

参数约定：

- `--dir <path>`、`--project`、`--global` 在 platform 子命令中保持同一语义和展示顺序
- 三者互斥；不传时按命令默认行为处理
- `generate --project/--global` 只用于带项目级或用户级布局语义的 bundle，目前是 `codex --bundle codex-marketplace`

常用别名：

| 长命令 | 短入口 | 用途 |
| --- | --- | --- |
| `generate` | `g` | 导出高级 bundle |
| `plugin` | `p` | 生成 Codex personal/repo marketplace |
| `install` | `i` | 安装平台内容 |
| `where` | `w` | 查看安装位置 |
| `status` | `s` | 查看安装状态 |
| `update` | `u` | 更新已安装内容 |
| `uninstall` | `remove` | 卸载受管内容 |
| `repair` | `fix` | 修复漂移或缺失 |
| `doctor` | `check` | 诊断健康度 |

## 命名空间适配

`toolkit` 里的内容使用统一语义名，例如：

- `zc:start`
- `zc:product-analysis`
- `zc:sdd-tdd`
- `zc:quality-review`

安装到不同平台后，不会强行保留同一种触发形式，而是按平台能力做适配：

- Codex
  - 传统安装通过 `$zc-*` skill 承接
  - 插件安装通过 `zc-toolkit` 插件命名空间下的无前缀 skill 承接
  - 例如：`zc:start -> $zc-start` / `zc:start -> $start`
- Claude Code
  - 统一语义通过 `/zc-*` command 承接
  - 例如：`zc:start -> /zc-start`
- OpenCode
  - 统一语义通过 `/zc-*` command 承接
  - 例如：`zc:start -> /zc-start`
- Qwen
  - 统一语义通过 `zc:*` namespaced command 承接
  - 例如：`zc:start -> zc:start`

这样做的目的只有一个：

- 传统直装需要避免和平台内置命令、社区插件或未来扩展发生冲突
- 插件安装已经有 `zc-toolkit` 命名空间，因此不再给每个 skill 重复加 `zc-` 前缀

## 平台安装模型

### Codex

- 项目级：
  - `AGENTS.md`
  - `.codex/config.toml`
  - `.codex/skills/zc-<command>/SKILL.md`
  - `.codex/skills/zc-<skill>/SKILL.md`
  - `.codex/agents/zc-<agent>.toml`
- 用户级 / 自定义目录：
  - `AGENTS.md`
  - `config.toml`
  - `skills/zc-<command>/SKILL.md`
  - `skills/zc-<skill>/SKILL.md`
  - `agents/zc-<agent>.toml`
- 插件 / marketplace：
  - `.agents/plugins/marketplace.json`
  - `AGENTS.md` 或 `.codex/AGENTS.md`
  - `plugins/zc-toolkit/.codex-plugin/plugin.json` 或 `.codex/plugins/zc-toolkit/.codex-plugin/plugin.json`
  - `plugins/zc-toolkit/skills/<command-or-skill>/SKILL.md` 或 `.codex/plugins/zc-toolkit/skills/<command-or-skill>/SKILL.md`
  - `.codex/agents/zc-<agent>.toml`

插件路线和传统直装都会生成 `AGENTS.md`，但语义不同：传统直装入口指向 `$zc-*` 和 `skills/zc-*`；插件路线入口只保留全局规则、入口映射和文件索引，指向 `$*` 和 `zc-toolkit` 插件内 skills。

`config.toml` 是 `zc` 管理的 Codex custom agent role 注册配置，避免生成了 `.toml` agent 文件但入口无法找到对应角色；不要把它写成通用平台 command surface。

### Claude Code

- 项目级：
  - `CLAUDE.md`
  - `.claude/commands`
  - `.claude/agents`
- 用户级 / 自定义目录：
  - `CLAUDE.md`
  - `commands`
  - `agents`

### OpenCode

- 项目级：
  - `AGENTS.md`
  - `.opencode/commands`
  - `.opencode/skills`
  - `.opencode/agents`
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
- 默认安装源：
  - `https://github.com/zmice/zc-qwen-extension.git`
- 默认更新方式：
  - `qwen extensions update zc-toolkit`

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
zc platform plugin codex
zc platform status codex --global --json

zc platform install claude --global
zc platform install opencode --global
zc platform install qwen --global
zc platform status qwen --global --json
zc platform generate qwen --bundle release-bundle --dir /tmp/zc-toolkit
zc platform doctor codex --global --json
zc platform repair qwen --global --json
zc platform uninstall opencode --global --plan --json
```

如果你主要是把 `zc` 当安装器使用，最常见的循环是：

```bash
# 看平台默认安装位置
zc platform where codex --global --json

# 安装或更新平台内容；Codex 插件路线使用 plugin，不传 selector 时默认项目级
zc platform plugin codex
zc platform plugin codex --global

# 传统平台安装路线使用 install/update/status
zc platform install codex --global
zc platform update codex --global --plan --json

# 检查当前状态
zc platform status codex --global --json

# 诊断、修复、卸载
zc platform doctor codex --global --json
zc platform repair codex --global --plan --json
zc platform uninstall codex --global --plan --json
```

如果你要把 Qwen 扩展作为独立目录导出，而不是直接安装到本机，可以使用：

```bash
zc platform generate qwen --bundle release-bundle --dir /tmp/zc-toolkit
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
pnpm audit:context
pnpm verify:mvp
pnpm verify
```

更完整的使用说明见：

- [../../docs/usage-guide.md](../../docs/usage-guide.md)
