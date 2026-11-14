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

`--upgrade` 先用 `codex plugin list --marketplace zc-toolkit --json` 检查目标插件启用状态，避免无 scope 查询触发远端全局目录；已配置的旧版本地来源仍可见。目标安装记录不可见、插件为 disabled 或启用状态未知时停止，避免重新安装时意外启用。随后识别已配置 marketplace：Git 来源先执行 `codex plugin marketplace upgrade`，再执行 `codex plugin add` 安装当前快照；只有预检仍能确认目标启用时，才补注册缺失来源；首次安装使用 `--install`；旧版 Desktop / 本地来源会事务式迁移到 Git marketplace，迁移失败时恢复原来源和旧插件。最后重新读取 installed/available 状态。`--status --json` 的 `installed`、`enabled` 可为 true、false 或 `unknown`；`updateStatus` 为 `up-to-date`、`update-available`、`installed-newer`、`unknown`、`not-installed`，`reason` 给出机器可读原因。版本相同视为匹配；版本不同时，只有双方都是三段数字稳定版本才比较方向：候选版本更高为 `update-available`，已安装版本更高为 `installed-newer`；预发布或 tag 等不可比较版本为 `unknown`，原因是 `versions-not-comparable`。`available: []` 只表示没有可比较的版本，不能证明已是最新。`zc` 按操作探测当前 Codex CLI 命令：旧版注册时兼容 `codex marketplace add`，缺失其他命令时会报错。

插件记录按完整 `pluginId` 定位；同名但属于其他 marketplace 的记录不视为目标。已安装记录重复或缺少来源身份时以 `ambiguous-plugin-identity` 停止；可用目录记录重复或缺少来源身份时仅使候选版本变为 unknown，不抹去已确认的本地安装。官方 Codex CLI 子进程按操作设置时间与输出上限：查询默认 15 秒 / 8 MiB，安装与升级等变更默认 300 秒 / 16 MiB；超限时只尝试清理本次启动的进程树，并报告清理结果。候选版本更高时 `updatePending=true`；`--with-agents` 的 `overallStatus=update-pending` 表示插件更新仍待应用，不能当作 `complete`。companion 和 standalone agent 写入发生普通异常时，会恢复本次全部受管 artifacts 与 receipt；`--prune` 中的受管过期文件也纳入恢复范围。插件 lifecycle 与 companion 同步是两个事务边界，静态状态不代表新会话已应用。

Windows 上通过 npm 安装的 `codex.cmd` / `qwen.cmd` 会由跨平台启动器直接解析，不需要把用户输入拼进 `cmd.exe`。Codex 全局直装回执写到 `%USERPROFILE%\.codex\platform-state\`，并兼容识别旧版本误写的 `%USERPROFILE%\.codex\.codex\platform-state\`。如果 Codex 返回了残留的本地 marketplace 记录，但删除时确认该记录已经不存在，`--upgrade` 会继续注册 Git marketplace 并完成自愈；其他删除错误仍会中断迁移。如果刷新 Git marketplace 后，已安装插件仍指向旧直装目录 `%USERPROFILE%\.codex\plugins\zc-toolkit`，`--upgrade` 会先把旧目录和 `%USERPROFILE%\.agents\plugins\marketplace.json` 中受管的旧 source 条目复制到 `%USERPROFILE%\.codex\platform-state\legacy-plugin-backups\`，保持旧 source 可读并完成官方 `plugin remove`，再精确移除残留目录与旧条目，通过官方 `plugin add` 从 Git marketplace 重新安装和同步 companion agents；替换安装失败时会恢复原目录和 marketplace，不直接删除用户资产。companion 完整性校验会把 Windows Git checkout 的 CRLF 文本归一化为 LF，发布 bundle 也通过 `.gitattributes` 固定这些文件为 LF。

插件包携带 `agents/*.md` 角色说明；需要 standalone 角色注册时，把官方插件 lifecycle 和 custom-agent companion 合并为一个流程。角色职责与模型策略分离：当前 companion TOML 不固定 `model` 或 `model_reasoning_effort`，默认交给宿主继承；用户已有 `[agents]` 全局默认值时按宿主优先级选择，不保证等于父任务模型。companion TOML 仍生成 legacy `sandbox_mode`，但按照官方 custom-agent 契约，该字段不覆盖父会话权限；`approval_policy`、`model_provider`、`mcp_servers` 同样不能在子角色中覆盖父配置。MCP servers 应在父会话配置，角色中的“只读”指令不等于强制只读隔离：

```bash
zc platform plugin codex --install --with-agents
zc platform plugin codex --status --with-agents --json
zc platform plugin codex --upgrade --with-agents
zc platform plugin codex --uninstall --with-agents
```

当前只注册 `zc` 角色，不注入全局子 agent 默认模型或 effort。旧回执拥有且当前值仍匹配的全局默认字段，在新生成配置不含该键时移除；用户自行修改的值和无回执值保留。角色 TOML 的写入和删除须有匹配 SHA 的回执；即使磁盘内容碰巧与候选相同，无回执也不自动认领。`config.toml` 只按回执记录的注册段签名和默认字段值清理，用户自有或修改过的注册保留。旧回执没有注册段签名时，若保留的 `config_file` 仍指向待删除角色，卸载会停止并提示人工合并，避免留下悬空引用。传统 `platform install codex` 与独立 agents、插件 companion 共用这套角色所有权检查；状态为 `up-to-date` 还要求存在有效回执。

本地 marketplace bundle 卸载将 bundle、选择删除的 agents、共享配置和回执纳入同一次恢复范围。开始前校验路径、文件类型与快照总量（最多 128 MiB / 5000 项）；普通失败只自动恢复能够确认由本次操作改变的目标。部分删除、配置写入未完成或外部进程修改目标时，停止自动覆盖并报告 `.zc-plugin-uninstall-*` 恢复目录；其中 `manifest.json` 记录原路径、副本编号、摘要和阶段，保留副本供人工核对，勿直接删除。成功后的备份清理失败单独报告，不再回滚已完成的卸载。此机制不等于进程崩溃恢复或官方外部 CLI 的跨进程原子事务。

插件的 `start`、实现、调度与验证共同遵守 engineering-principles 的“授权与执行环境复用契约”：复用既有授权和已准备环境；首次意外确认/认证或用户要求停止弹窗时立即停止后续交互批次。批量评测不逐案例新建需提权的 Codex home，不并发发起登录，也不通过放宽权限消除弹窗。

插件目录包含 `skills/` 与 `agents/`，command 通过同名 skill 提供，不再生成重复的 `commands/`。`$<skill>`（含插件 namespace）与 `zc:*` 语义保留；旧 slash 和 `source-command-*` 迁移入口不再分发。已安装缓存需在后续升级及新会话中核验。`assets/zc-agents/` 是显式运行时配置桥：`zc` 从官方 CLI 返回的 `installedPath` 或 `source.path` 精确定位插件根，再按回执写入 `~/.codex/config.toml` 和 `~/.codex/agents/`。升级仍显示 `updatePending` 时不会提前覆盖 agents；卸载只删除回执明确拥有的文件。

确认标准不是只看插件已安装。运行 `zc platform plugin codex --status --with-agents --json`，应同时满足：

- `overallStatus` 为 `complete`
- `roleConfiguration.explicitRuntimeConfigSurface` 为 `standalone-custom-agent-toml`
- `roleConfiguration.permissionBoundary` 为 `parent-session`；`roleConfiguration.runtimeVerified` 仍为 `false`，须另做新任务运行时核验
- `agents.status` 为 `up-to-date`
- `agents.summary.missingArtifacts` 和 `agents.summary.driftedArtifacts` 都为 `0`

上述状态只确认安装和受管文件同步，不证明版本最新或当前会话已加载角色。本次改动尚未安装到本机；安装同步后需启动新的 Codex 任务，核对角色发现、实际模型与 reasoning、父会话权限及子任务可用工具。

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
| Codex | 推荐：Git marketplace plugin（skills + agents，command 由同名 skill 承接）；本地/传统：`AGENTS.md` + `config.toml` + `skills/` + `agents/` | 传统 `zc:start -> $zc-start`；插件 `zc:start -> $zc-toolkit:start` |
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
- `plugin codex --upgrade` 预检启用状态，刷新 marketplace，再调用 `plugin add` 安装当前快照并列出 installed/available 状态
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
