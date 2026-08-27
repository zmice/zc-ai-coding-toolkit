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
zc platform plugin codex --install
```

它会先注册 Git marketplace，再调用官方 `codex plugin add` 安装 `zc-toolkit`。安装后启动新线程，优先使用 `$zc-toolkit:start`。

只想查看官方命令或单独注册时：

```bash
npm install -g @zmice/zc
zc platform plugin codex --git
zc platform plugin codex --register
```

状态和目录刷新：

```bash
zc platform plugin codex --status
zc platform plugin codex --upgrade
```

`--upgrade` 会先识别已配置 marketplace：Git 来源会刷新后重新安装当前快照，缺失来源会自动注册；旧版 Desktop / 本地来源会事务式迁移到 Git marketplace，迁移失败时恢复原来源和旧插件。随后立即列出 installed/available 状态。`zc` 会先探测当前 Codex CLI：新版使用稳定的 `codex plugin ...` 命令，旧版注册时兼容 `codex marketplace add`，但安装、状态和卸载会要求先升级 Codex。

Windows 上通过 npm 安装的 `codex.cmd` / `qwen.cmd` 会由跨平台启动器直接解析，不需要把用户输入拼进 `cmd.exe`。Codex 全局直装回执写到 `%USERPROFILE%\.codex\platform-state\`，并兼容识别旧版本误写的 `%USERPROFILE%\.codex\.codex\platform-state\`。如果 Codex 返回了残留的本地 marketplace 记录，但删除时确认该记录已经不存在，`--upgrade` 会继续注册 Git marketplace 并完成自愈；其他删除错误仍会中断迁移。如果刷新 Git marketplace 后，已安装插件仍指向旧直装目录 `%USERPROFILE%\.codex\plugins\zc-toolkit`，`--upgrade` 会先把旧目录和 `%USERPROFILE%\.agents\plugins\marketplace.json` 中受管的旧 source 条目复制到 `%USERPROFILE%\.codex\platform-state\legacy-plugin-backups\`，保持旧 source 可读并完成官方 `plugin remove`，再精确移除残留目录与旧条目，通过官方 `plugin add` 从 Git marketplace 重新安装和同步 companion agents；替换安装失败时会恢复原目录和 marketplace，不直接删除用户资产。companion 完整性校验会把 Windows Git checkout 的 CRLF 文本归一化为 LF，发布 bundle 也通过 `.gitattributes` 固定这些文件为 LF。

插件包携带 `agents/*.md` 角色说明，但 Markdown 角色不证明逐角色的模型、推理和 sandbox 配置已经生效。需要固定 `model`、`model_reasoning_effort` 或 `sandbox_mode` 时，把官方插件 lifecycle 和 standalone custom-agent companion 合并为一个流程：

```bash
zc platform plugin codex --install --with-agents
zc platform plugin codex --status --with-agents --json
zc platform plugin codex --upgrade --with-agents
zc platform plugin codex --uninstall --with-agents
```

插件目录包含 `agents/` 与 `commands/`，不需要额外 manifest 字段。`assets/zc-agents/` 是显式运行时配置桥：`zc` 从官方 CLI 返回的 `installedPath` 或 `source.path` 精确定位插件根，再按回执写入 `~/.codex/config.toml` 和 `~/.codex/agents/`。升级仍显示 `updatePending` 时不会提前覆盖 agents；卸载只删除回执明确拥有的文件。

确认标准不是只看插件已安装。运行 `zc platform plugin codex --status --with-agents --json`，应同时满足：

- `overallStatus` 为 `complete`
- `roleConfiguration.explicitRuntimeConfigSurface` 为 `standalone-custom-agent-toml`
- `agents.status` 为 `up-to-date`
- `agents.summary.missingArtifacts` 和 `agents.summary.driftedArtifacts` 都为 `0`

同步后启动一个新的 Codex 任务，让运行时重新加载 `~/.codex/agents/zc-*.toml`。

`plugin` 子命令当前只支持 Codex。Codex 本地生成/开发态验证仍可使用 `zc platform plugin codex --project|--global|--dir <repo>`。其他平台使用 install 路线，可按需追加 `--global`：

```bash
zc platform install <claude|opencode|qwen> [--global]
zc platform install qoder-cn --global
```

Qoder CN 安装会在 `~/.qoder-cn/.zc/platform-bundles/qoder-cn/zc-toolkit` 生成受管插件 bundle，并调用官方 `qodercn plugins validate/install` 注册；更新、修复和卸载继续使用官方插件生命周期。全局安装还会检查同级 `~/.qoder` 的旧版文件系统回执：先完成官方插件注册，再删除回执拥有且未漂移的旧产物；无回执、路径不安全或存在本地修改时不会自动删除。可用 `--plan --json` 预览，确认漂移内容后用 `--force` 迁移。若未安装 `qodercn`，命令会明确失败，不会回退为插件页面无法识别的直接目录写入。`QODERCN_CONFIG_DIR` 可覆盖默认配置根。

如果你只是想安装和更新平台内容，优先看：

- `安装`
- `平台安装模型`
- `命名空间适配`
- `高频用法`

它负责：

- runtime：启动单工人或团队协作运行时
- context：初始化 Codex 项目上下文索引
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
| Codex | 推荐：Git marketplace plugin（commands + skills + agents）；本地/传统：`AGENTS.md` + `config.toml` + `skills/` + `agents/` | 传统 `zc:start -> $zc-start`；插件 `zc:start -> $zc-toolkit:start` |
| Claude Code | `CLAUDE.md` + `commands/` + `agents/` | `zc:start -> /zc-start` |
| OpenCode | `AGENTS.md` + `commands/` + `skills/` + `agents/` | `zc:start -> /zc-start` |
| Qwen | `QWEN.md` + extension 目录 | `zc:start -> zc:start` |
| Qoder CN | `.qoder-plugin/plugin.json` + `commands/` + `skills/` + `agents/`，由官方 `qodercn plugins` 注册 | `zc:start -> /zc-toolkit:start` |

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
- Qoder CN 官方 plugin manifest / `qodercn plugins` / `QODERCN_CONFIG_DIR` 文档

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

最常见的是走 Codex 官方 Git marketplace：

```bash
codex plugin marketplace add zmice/zc-codex-marketplace --json
codex plugin add zc-toolkit@zc-toolkit --json
codex plugin list --marketplace zc-toolkit --available --json
codex plugin marketplace upgrade zc-toolkit --json
```

如果希望由 `zc` 编排完整 lifecycle：

```bash
zc platform plugin codex --git
zc platform plugin codex --register
zc platform plugin codex --install
zc platform plugin codex --status
zc platform plugin codex --upgrade
zc platform plugin codex --install --with-agents
zc platform plugin codex --status --with-agents
zc platform plugin codex --git --uninstall
```

如果使用本地生成、用户级或传统平台安装模型，则是：

```bash
zc platform plugin codex --plan
zc platform plugin codex
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
- `zc agent plan`
- `zc agent worktree prepare|cleanup|recover`
- `zc team ...`
- `zc task ...`
- `zc msg ...`
- `zc doctor`

轻量 Codex agent controller 先生成 run artifacts，不启动 worker：

```bash
zc agent plan \
  -t "API | files=src/api.ts,src/api.test.ts | verify=pnpm test" \
  -t "UI | files=src/ui.ts,src/ui.test.ts | verify=pnpm test" \
  --json

zc agent plan \
  -t "API | files=src/api.ts | verify=pnpm test" \
  --run-id feature-api \
  --write
```

`zc agent plan` 会选择 `readonly-consult / serial-subagent / context-fanout / worktree-team`，检查文件所有权、验证命令、冲突和 fan-in gate。`--write` 只写 `.codex/work/agent-runs/<run-id>/` 下的 `plan.json`、task brief、report、review、ledger 和 fan-in 模板；不会启动真实 worker。

Codex host-native worker 需要文件系统隔离、但不需要 tmux / 多 CLI team 时，使用 OS 临时 worktree。两条命令都默认只输出 plan：

```bash
zc agent worktree prepare \
  --dir <repo> \
  --run-id <run> \
  --task-id <task> \
  --json

zc agent worktree prepare ... --apply --json

zc agent worktree cleanup \
  --dir <repo> \
  --run-id <run> \
  --task-id <task> \
  --agent-state completed \
  --fan-in-collected \
  --json

zc agent worktree cleanup ... --apply --json

zc agent worktree recover --dir <repo> --run-id <run> --task-id <task> --json
zc agent worktree recover ... --apply --json
```

实际目录位于 OS temp 的 `zc-codex-worktrees/`，不使用仓库 `.worktrees/` 或 `$CODEX_HOME/worktrees`。cleanup 不使用 force：dirty / missing / receipt mismatch / thread 未终态 / fan-in 未收集都会阻止删除；有未合入 commit 时删除工作目录但保留恢复 branch 和 receipt，无独立提交时连同临时空目录与 branch 一起清理。

源仓库 dirty 时默认阻止 prepare，因为临时 worktree 只从已提交 `HEAD` 创建，不包含未提交文件。仅当 controller 已确认这些改动与子任务无关时追加 `--allow-dirty-source`；dirty paths 和确认状态会进入 receipt。

进程中断后使用 `recover` 复核精确 receipt：已完成注册的 allocating/orphaned lease 会恢复为 ready；无 worktree / branch 的 orphan metadata 会删除；先前保留且后来已合入的 branch 会用非 force 删除并清掉 receipt；未合入 branch 或不匹配路径继续保留。worktree 和 receipt 的全部已存在父级都拒绝 symlink，并在创建、恢复、清理前复核真实路径归属。lease lock 写入 PID 与时间；健康 owner 的普通等待只读轮询，不写 recovery object，只有 stale / malformed 候选才进入原子回收。

重型团队并行先 dry-run，再启动：

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

### Context

- `zc context init`
- `zc context update`
- `zc context doctor`

`context` 是 Codex-only 的项目上下文维护入口，默认只输出计划，不写文件：

```bash
zc context init --json
zc context init --write
zc context update --json
zc context update --write
zc context doctor --json
zc context init --dir /path/to/project --write
```

它会维护项目根 `AGENTS.md` 的受管上下文块，并生成 `.codex/context/project.md`、`.codex/context/commands.md`、`.codex/context/modules/README.md`、`.codex/context/docs.md` 和 `.codex/context/manifest.json`。这些文件用于渐进式披露项目上下文，不替代当前任务的源码阅读，也不写用户级 `~/.codex` 配置。

`context doctor` 是只读健康检查；发现缺失、过期或冲突时返回非零 exit code，便于在长任务和多 agent fan-in 前做上下文门禁。

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
- `--git [source]`
- `--ref <ref>`
- `--register`
- `--install`
- `--upgrade`
- `--status`
- `--uninstall`
- `--plan`
- `--json`
- `--force`

参数约定：

- `--dir <path>`、`--project`、`--global` 在 platform 子命令中保持同一语义和展示顺序
- 三者互斥；不传时按命令默认行为处理
- `generate --project/--global` 只用于带项目级或用户级布局语义的 bundle，目前是 `codex --bundle codex-marketplace`
- `plugin codex --git` 不写本地文件，只输出 `codex plugin marketplace add` 命令
- `plugin codex --register` 注册默认 Git marketplace；旧 CLI 自动兼容顶层 `codex marketplace add`
- `plugin codex --install` 注册 marketplace 后安装 `zc-toolkit`
- `plugin codex --upgrade` 刷新 marketplace，并列出 installed/available 状态
- `plugin codex --status` 只读检查插件状态
- `plugin codex --git --uninstall` 通过官方 CLI 卸载插件 bundle，不自动断开 connector 授权

常用别名：

| 长命令 | 短入口 | 用途 |
| --- | --- | --- |
| `generate` | `g` | 导出高级 bundle |
| `plugin` | `p` | 管理 Codex 官方插件 lifecycle，或生成本地 marketplace |
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
  - 插件安装保持无前缀 skill 目录和 frontmatter，通过 `$zc-toolkit:<skill>` namespace 限定名调用
  - 例如：`zc:start -> $zc-start` / `zc:start -> $zc-toolkit:start`
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

插件路线和传统直装都会生成 `AGENTS.md`，但语义不同：传统直装入口指向 `$zc-*` 和 `skills/zc-*`；插件路线入口只保留全局规则、入口映射和文件索引，指向 `$zc-toolkit:*` 和 `zc-toolkit` 插件内 skills。

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

# Codex 官方插件路线
zc platform plugin codex --install
zc platform plugin codex --status
zc platform plugin codex --upgrade
zc platform plugin codex --install --with-agents
zc platform plugin codex --status --with-agents --json

# 本地开发 marketplace；不传 selector 时默认项目级
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
