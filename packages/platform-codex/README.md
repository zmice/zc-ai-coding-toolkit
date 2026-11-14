# @zmice/platform-codex

`@zmice/platform-codex` 把 `@zmice/toolkit` 的结构化内容渲染成 Codex 平台所需产物。

它是 **仓库内部包**，公开分发入口统一由 `@zmice/zc` 提供。

当前输出包括：

- `AGENTS.md`
- `skills/zc-<command>/SKILL.md`
- `skills/zc-<skill>/SKILL.md`
- `agents/zc-<agent>.toml`
- Codex 项目上下文初始化计划：`AGENTS.md` managed block + `.codex/context/*`
- 可选 Codex plugin bundle：`.codex-plugin/plugin.json` + `skills/` + `agents/` + `assets/zc-agents/`
- 可选 Codex marketplace bundle：`.agents/plugins/marketplace.json` + `AGENTS.md` / `.codex/AGENTS.md` + `plugins/zc-toolkit/` / `.codex/plugins/zc-toolkit/`

`.codex/config.toml` / `.codex/agents/` 与插件内 `skills/` / `agents/` 是两条不同安装面。插件 Markdown agent 提供角色说明；standalone TOML 是官方逐角色配置面。角色职责与模型策略分离。

插件中的每个 command 仅生成一个同名 skill，保留完整正文及 `zc:*` 语义。新 bundle 不再分发 `commands/`，避免 Codex 将它再次迁移为 `source-command-*` skill。原生 skill 调用继续保留；旧 slash command 或显式 `source-command-*` 调用需要改用同名 skill，不承诺这些旧入口兼容。此生成规则不修改本机缓存，也不保证已有会话中的迁移入口立即消失。传统 standalone 安装的 `zc-*` 命名不变。

角色产物显式说明 canonical `skill:<id>` 的发现名映射：传统安装为 `zc-<id>`，插件角色与 companion 为 `<pluginName>:<id>`。这些是定位提示，使用前仍以宿主实际发现列表为准；仅安装 standalone agents 不代表技能也已安装。正文保留同一份 canonical 角色内容，适配层只追加当前安装面的定位和缺失降级说明。

standalone / companion `agents/zc-<agent>.toml` 当前从 canonical `codex_agent` 元数据生成 legacy `sandbox_mode`，不生成角色 `model` 或 `model_reasoning_effort`。模型与 effort 默认由宿主继承；若用户在 `[agents]` 配了全局默认值，实际选择仍按宿主优先级，不能保证等于父任务模型。按照当前官方 custom-agent 契约，角色文件中的 `sandbox_mode`、`approval_policy`、`model_provider`、`mcp_servers` 不覆盖父会话；权限、provider、MCP servers 从父会话继承。角色正文要求“只读”也不会建立独立只读沙箱；需要强制只读时，应在父会话设置有效权限并用真实子任务核验。`mcp_servers`、`skills.config` 尚未由本包生成。

standalone / companion 只管理 `[agents.zc_*]` 角色注册，不再写入 `[agents]` 的全局默认模型或 effort。旧版本回执拥有且当前值仍匹配的默认字段在新生成配置不含该键时移除；用户改过的值及没有回执的值保留。`zc_lightweight_researcher` 做窄范围只读核查，不代替实现或专项审计。配置生成不等于运行时生效；本次仅修改源码，尚未安装或核验本机会话的继承结果。

旧受管默认字段沿用受限的逐行 TOML 合并：支持标准 `[agents]` 和 `[agents.zc_*]`（含空白/尾部注释）及单、双引号值；inline、dotted、array table 或带引号键等不支持的 agents 写法会明确拒绝，要求转换为标准表后重试。对既有角色文件，只要 SHA 不匹配旧回执或没有回执就停止写入；即使内容恰好与候选相同，也不能自动认领为受管资产。卸载只移除与回执匹配的受管字段和文件。

## 边界

同步保留仍在清单中的现有 `[agents.zc_*]` 注册段，包括用户的 `description`、`config_file` 和其他键；已有注册不会被新模板整段替换，因此注册描述的后续调整也需人工合并。旧回执只有角色文件哈希，不能证明注册段未被改动：遇到已从候选清单移除但仍存在的受管注册段时，同步明确停止，保留配置供人工合并。

新回执另记实际注入注册段的签名；传统安装、独立 agents 与 companion 共用签名检查和配置合并规则，不把共享 `config.toml` 整个文件归为 zc 所有。无回执不报告安装完成；用户修改其他配置不会导致整个配置文件被误判漂移。卸载前检查保留下来的注册是否仍引用待删角色，存在引用时停止并报告需合并的配置，避免留下悬空 `config_file`。

写入操作在真实 config 所属目录使用同一互斥锁，覆盖读取、预检、写入、回执和普通失败回滚。锁记录 owner，不能确认占用状态时不自动抢锁；plan/status 不创建目标目录。进程中断与操作系统崩溃仍可能需要按回执恢复，不声明崩溃原子性。

CLI 的本地 marketplace 卸载还会为 bundle、受管 agents、配置及回执保存有界快照。能够证明本次修改的普通失败自动恢复；路径身份变化、外部修改或未确认的部分删除保留恢复副本，不覆盖未知内容。提交后的备份清理失败单独报告，不反向触发卸载回滚。

角色写入、prune 和卸载均在操作前检查旧回执 SHA，用户改过或无归属的角色文件保留。组合卸载会在调用官方插件卸载前预检 companion 文件。状态中的 `roleConfiguration.fields` 仅表示支持的序列化字段（`fieldsScope`），不表示实际启用；`effectiveModel` / `effectiveReasoningEffort` 为 null、`runtimeVerified` 为 false 时，不能断言运行时模型已继承。

- 提示资产内容不在本包维护
- 本包只关心 Codex 平台模板、安装计划和产物布局
- 不承担仓库治理能力

`zc context init/update/doctor` 的 CLI 入口位于 `apps/cli`，但 Codex 上下文产物的模板和 action plan 由本包的 `createCodexContextInitPlan` 提供。

## 常用用法

```bash
zc platform install codex --dir /tmp/codex-out
zc platform install codex
zc platform install codex --global
zc platform plugin codex --git
zc platform plugin codex --register
zc platform plugin codex --install
zc platform plugin codex --status
zc platform plugin codex --upgrade
zc platform plugin codex --install --with-agents
zc platform plugin codex --status --with-agents
zc platform plugin codex --git --uninstall
zc platform plugin codex
zc platform plugin codex --global
zc platform p codex
zc platform generate codex --bundle codex-plugin --dir /tmp/zc-codex-plugin
zc platform generate codex --bundle codex-plugin --plugin-manifest-format portable --dir /tmp/zc-codex-portable
zc platform generate codex --bundle codex-marketplace --project
zc platform generate codex --bundle codex-marketplace --dir /tmp/zc-codex-marketplace
zc platform generate codex --bundle codex-marketplace --global
zc platform where codex --global --json
zc platform install codex --plan --json
```

`--global` 默认会安装到 `~/.codex/AGENTS.md`。

`generate --plugin-manifest-format portable` 仅适用于 `codex-plugin` / `codex-marketplace`，在插件根增加标准 `plugin.json`（schema 1.0.0），并继续生成 `.codex-plugin/plugin.json` 兼容清单。两份清单来自同一 metadata；Codex 专属界面字段放在 `extensions["com.openai"]`，技能使用标准 `skills/` 发现路径。默认 `compatibility` 保持旧布局。portable 输出已在 CLI 0.167.0 的隔离 home 中验证安装及 `skills/list` 发现；桌面和旧 CLI 加载尚未验证，因此暂不切换默认发布格式。

若目录已有根 `plugin.json`，以 compatibility 模式重新生成会在写入前停止（包括 `--force`），避免留下优先级更高的旧清单。可继续使用 portable 模式，或选择空目录；工具不会自动删除用户根清单。此参数不用于 `plugin codex` 安装别名。

当前安装模型：

- `--project`
  - 安装 `<project>/AGENTS.md`
  - 同时安装 `<project>/.codex/skills/zc-<command>/SKILL.md`
  - 同时安装 `<project>/.codex/skills/zc-<skill>/SKILL.md`
  - 同时安装 `<project>/.codex/agents/zc-<agent>.toml`
- `--global`
  - 安装 `~/.codex/AGENTS.md`
  - 同时安装 `~/.codex/skills/zc-<command>/SKILL.md`
  - 同时安装 `~/.codex/skills/zc-<skill>/SKILL.md`
  - 同时安装 `~/.codex/agents/zc-<agent>.toml`
- `--dir <path>`
  - 安装 `<path>/AGENTS.md`
  - 同时安装 `<path>/skills/zc-<command>/SKILL.md`
  - 同时安装 `<path>/skills/zc-<skill>/SKILL.md`
  - 同时安装 `<path>/agents/zc-<agent>.toml`
- `generate --bundle codex-plugin --dir <path>`
  - 生成 `<path>/.codex-plugin/plugin.json`
  - 生成 `<path>/skills/<command>/SKILL.md`
  - 生成 `<path>/skills/<skill>/SKILL.md`
  - 生成 `<path>/agents/<agent>.md`
  - 插件自身已经提供 `zc-toolkit` 命名空间，因此 skill 名不再额外加 `zc-` 前缀
  - 用于 Codex plugin marketplace / 本地 plugin 打包场景，不替代项目级 `AGENTS.md`
  - plugin-level agents 保留自动发现 surface，commands 由同名 skills 承接
  - `assets/zc-agents/manifest.json`、`config/agents.toml` 和 `agents/*.toml` 是逐角色显式运行时配置 payload；只有显式 `--with-agents` 会消费
- `plugin codex`
  - 推荐消费路径是 `plugin codex --install`，对齐官方 `codex plugin marketplace add` + `codex plugin add`
  - `plugin codex --git` 默认输出 `codex plugin marketplace add zmice/zc-codex-marketplace`
  - `plugin codex --register` 直接调用 Codex CLI 注册默认 Git marketplace；旧 CLI 自动兼容 `codex marketplace add`
  - `plugin codex --install` 注册 marketplace 后安装 `zc-toolkit`
  - `plugin codex --status` 检查 installed/available/version/enabled；`available: []` 时更新状态为 unknown，不代表最新。`--upgrade` 的启用状态预检使用 `codex plugin list --marketplace zc-toolkit --json`，限制为目标 marketplace；目标安装记录不可见时停止，避免来源丢失后意外重装启用；后续版本比较也限制目标 marketplace
  - `plugin codex --upgrade` 先检查插件启用状态，已安装且 disabled 或状态未知时停止；随后执行 marketplace upgrade + plugin add 安装当前快照，再检查状态
  - 插件身份按完整 `pluginId` 匹配；同名其他 marketplace 不算目标，重复或缺少来源身份时返回 `ambiguous-plugin-identity` 并停止。`--with-agents` 在 `updatePending` 时返回 `overallStatus=update-pending`，不把受管文件同步误报为当前会话已应用
  - Codex CLI 查询默认 15 秒 / 8 MiB，变更操作默认 300 秒 / 16 MiB；超限时尝试清理本次启动的进程树并报告结果。companion 与 standalone agent 的本次全部受管 artifacts、receipt 及 `--prune` 的受管过期文件纳入普通异常回滚；插件 lifecycle 与 companion 同步分别报告，运行时仍需新任务验证
  - `plugin codex --git --uninstall` 使用 `codex plugin remove` 移除官方安装的 bundle；connector 授权仍需在 ChatGPT Plugins/Apps 中单独处理
  - 插件 Markdown agents 随官方 lifecycle 安装，提供角色说明；`--with-agents` 编排 standalone TOML 角色注册。TOML 中虽有 legacy `sandbox_mode` 字段，当前官方契约不把它作为子角色权限覆盖项
  - 组合安装只从官方 CLI 返回的 `installedPath` 或 `source.path` 精确定位本地插件根并读取 companion；status 可用既有回执续接，升级待应用时 agents 保持不变
  - companion 回执只拥有 `zc` 写入的 agent 文件；组合卸载不会删除未跟踪的本地 `zc-*.toml`
  - `plugin codex --ref <ref>` 可 pin Git marketplace 分支或 tag
  - 不使用 Git lifecycle 参数时，才进入本地 marketplace 生成路径
  - 本地生成等价于 `generate codex --bundle codex-marketplace --project` 的短入口
  - 不传 selector 时默认解析最近项目根，生成 repo-local marketplace
  - 项目级插件路线生成薄入口到 `<project>/AGENTS.md`
  - `plugin codex --global` 生成 personal marketplace 到 `~/.agents/plugins/marketplace.json`
  - `plugin codex --global` 生成薄入口到 `~/.codex/AGENTS.md`
  - `plugin codex --global` 生成插件到 `~/.codex/plugins/zc-toolkit/`，agents 保留在插件自身目录
  - 追加 `--force` 时会先清理目标插件的 `commands/`、`skills/`、`agents/` 受管目录，再写入当前版本，避免旧命名残留
  - 也可以显式使用 `plugin codex --project` 或 `plugin codex --dir <repo>`
  - 常用别名是 `p codex`
- `generate --bundle codex-marketplace --dir <path>`
  - 生成 `<path>/.agents/plugins/marketplace.json`
  - 生成 `<path>/AGENTS.md`
  - 生成 `<path>/plugins/zc-toolkit/.codex-plugin/plugin.json`
  - 生成 `<path>/plugins/zc-toolkit/skills/<command>/SKILL.md`
  - 生成 `<path>/plugins/zc-toolkit/skills/<skill>/SKILL.md`
  - 生成 `<path>/plugins/zc-toolkit/agents/<agent>.md`
  - 用于 repo-local marketplace 或后续 git-subdir marketplace 分发；`AGENTS.md` 只保留全局规则、入口映射和文件索引
- `generate --bundle codex-marketplace --project`
  - 与 `--dir <project-root>` 布局一致，但目录由当前 cwd 向上解析最近项目根得到
- `generate --bundle codex-marketplace --global`
  - 生成 `~/.agents/plugins/marketplace.json`
  - 生成 `~/.codex/AGENTS.md`
  - 生成 `~/.codex/plugins/zc-toolkit/.codex-plugin/plugin.json`
  - 生成 `~/.codex/plugins/zc-toolkit/skills/<command>/SKILL.md`
  - 生成 `~/.codex/plugins/zc-toolkit/skills/<skill>/SKILL.md`
  - 生成 `~/.codex/plugins/zc-toolkit/agents/<agent>.md`
  - 用于个人级 Codex marketplace；`~/.codex/AGENTS.md` 保留全局默认规则，插件内容保留在 `~/.codex/plugins/zc-toolkit/skills/`

在 Codex 中：

- 传统 `install codex` 路径通过 command-alias skill 承接，例如：
  - `$zc-start`
  - `$zc-spec`
  - `$zc-task-plan`
  - `$zc-build`
- 更完整的方法和专题能力继续通过 `$zc-<skill>` 使用
- 插件路径通过 `zc-toolkit` 插件命名空间承接；skill 目录和 frontmatter 保持无前缀，调用时使用 namespace 限定名，例如：
  - `$zc-toolkit:start`
  - `$zc-toolkit:spec`
  - `$zc-toolkit:task-plan`
  - `$zc-toolkit:build`

Codex UI/UX 入口：

- `$zc-toolkit:ui`：构建、修复或重构界面，并路由到前端工程能力
- `$zc-toolkit:ui-ux-review`：基于设计契约、运行路径和渲染证据执行只读审查
- `frontend-specialist`：plugin-native agent；先区分实现与审查，再调用对应 skill
- UI/UX 清单和许可证作为 skill attachments 生成到 `skills/<skill>/references/`，不依赖运行时联网下载

命名空间规则：

- 传统直装保留 `zc-` 前缀，避免污染 Codex 全局 skill 名称
- 插件安装不再给 skill 额外加 `zc-` 前缀，因为插件本身已经是命名空间
- 插件 Markdown agents 使用插件命名空间；带明确 session settings 的 standalone TOML agents 保留 `zc-` / `zc_` 前缀
- 传统直装示例：
  - `zc:start -> $zc-start`
  - `zc:product-analysis -> $zc-product-analysis`
  - `zc:sdd-tdd -> $zc-sdd-tdd`
- 插件安装示例：
  - `zc:start -> $zc-toolkit:start`
  - `zc:product-analysis -> $zc-toolkit:product-analysis`
  - `zc:sdd-tdd -> $zc-toolkit:sdd-tdd`

项目安装 / 全局安装的详细步骤见：

- `docs/usage-guide.md`

## Codex plugin 分发策略

推荐把 Codex 插件分发交给官方 Git marketplace：

1. 发布态同步：`scripts/export-codex-marketplace-bundle.mjs` 导出 marketplace 仓库根。
2. Git 仓库分发：`.github/workflows/publish-codex-marketplace-repo.yml` 同步到 `zmice/zc-codex-marketplace`。
3. 用户安装：只需要 skills / 插件角色说明时运行 `zc platform plugin codex --install`；需要 standalone 角色注册时运行 `zc platform plugin codex --install --with-agents`。
4. 状态检查：`zc platform plugin codex --status --json` 输出 `installed`、`enabled`、`updateStatus` 和 `reason`，缺少可用版本时更新状态为 unknown；standalone 角色同步用 `zc platform plugin codex --status --with-agents --json` 检查 companion 回执和 artifacts。
5. 插件升级：`zc platform plugin codex --upgrade`；Git 来源会刷新并重新安装当前快照，旧版非 Git 来源会在可回滚保护下迁移到 Git marketplace。

官方能力依据：

- <https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin>
- <https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin-marketplace>
- <https://learn.chatgpt.com/docs/agent-configuration/subagents>
- <https://developers.openai.com/plugins/build/plugins>
- <https://github.com/openai/plugins>

本地生成仍保留，用途是开发验证、项目级 curated marketplace 或离线调试：

1. 本地验证：`--bundle codex-plugin` 生成单个 plugin root，用个人 marketplace 指向它。
2. 个人级验证：`platform plugin codex --global` 生成 personal marketplace 和 `~/.codex/AGENTS.md` 薄入口。
3. 仓库内验证：`--bundle codex-marketplace --dir <repo>` 生成 repo-local marketplace 和仓库根 `AGENTS.md` 薄入口。

注意：官方 `openai/plugins` 仓库的历史示例包含 plugin-level `commands/`、`agents/` 和 `hooks.json`；当前官方 Subagents 文档以 standalone TOML 作为显式 session settings 配置面。插件 Markdown agent 与 TOML companion 使用同一份角色正文，后者当前只携带 legacy `sandbox_mode` 元数据，不固定模型和 effort。仓库当前未归档（2026-11-09 核对 GitHub 元数据），历史目录示例不能代替当前宿主契约。

## 验证

```bash
pnpm --dir packages/platform-codex test
pnpm --dir packages/platform-codex build
pnpm --dir packages/platform-codex verify
```
