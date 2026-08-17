# @zmice/platform-codex

`@zmice/platform-codex` 把 `@zmice/toolkit` 的结构化内容渲染成 Codex 平台所需产物。

它是 **仓库内部包**，公开分发入口统一由 `@zmice/zc` 提供。

当前输出包括：

- `AGENTS.md`
- `skills/zc-<command>/SKILL.md`
- `skills/zc-<skill>/SKILL.md`
- `agents/zc-<agent>.toml`
- Codex 项目上下文初始化计划：`AGENTS.md` managed block + `.codex/context/*`
- 可选 Codex plugin bundle：`.codex-plugin/plugin.json` + `commands/` + `skills/` + `agents/` + `assets/zc-agents/`
- 可选 Codex marketplace bundle：`.agents/plugins/marketplace.json` + `AGENTS.md` / `.codex/AGENTS.md` + `plugins/zc-toolkit/` / `.codex/plugins/zc-toolkit/`

`.codex/config.toml` / `.codex/agents/` 与插件内 `commands/` / `agents/` 是两条不同安装面。插件 Markdown agent 提供角色说明；需要逐角色覆盖 Codex session settings 时，standalone TOML 是官方配置面。

standalone / companion `agents/zc-<agent>.toml` 会从 canonical `codex_agent` 元数据生成 `model`、`model_reasoning_effort` 和 `sandbox_mode`。其中 model / reasoning 是有意的 role hard pin；sandbox 只是请求的默认隔离档位，parent turn 的 live sandbox / approval override 仍是实际权限边界。`mcp_servers`、`skills.config` 与顶层 `[agents]` 默认值尚未由本包生成。

## 边界

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
zc platform generate codex --bundle codex-marketplace --project
zc platform generate codex --bundle codex-marketplace --dir /tmp/zc-codex-marketplace
zc platform generate codex --bundle codex-marketplace --global
zc platform where codex --global --json
zc platform install codex --plan --json
```

`--global` 默认会安装到 `~/.codex/AGENTS.md`。

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
  - 生成 `<path>/commands/<command>.md`
  - 生成 `<path>/skills/<command>/SKILL.md`
  - 生成 `<path>/skills/<skill>/SKILL.md`
  - 生成 `<path>/agents/<agent>.md`
  - 插件自身已经提供 `zc-toolkit` 命名空间，因此 skill 名不再额外加 `zc-` 前缀
  - 用于 Codex plugin marketplace / 本地 plugin 打包场景，不替代项目级 `AGENTS.md`
  - plugin-level commands / agents 是 manifest 的同级自动发现 surface，不额外虚构 manifest 字段
  - `assets/zc-agents/manifest.json`、`config/agents.toml` 和 `agents/*.toml` 是逐角色显式运行时配置 payload；只有显式 `--with-agents` 会消费
- `plugin codex`
  - 推荐消费路径是 `plugin codex --install`，对齐官方 `codex plugin marketplace add` + `codex plugin add`
  - `plugin codex --git` 默认输出 `codex plugin marketplace add zmice/zc-codex-marketplace`
  - `plugin codex --register` 直接调用 Codex CLI 注册默认 Git marketplace；旧 CLI 自动兼容 `codex marketplace add`
  - `plugin codex --install` 注册 marketplace 后安装 `zc-toolkit`
  - `plugin codex --status` 使用 `codex plugin list --available --json` 检查 installed/available/version/enabled
  - `plugin codex --upgrade` 刷新 Git marketplace 后检查插件状态，不擅自重装或覆盖用户启用状态
  - `plugin codex --git --uninstall` 使用 `codex plugin remove` 移除官方安装的 bundle；connector 授权仍需在 ChatGPT Plugins/Apps 中单独处理
  - 插件 Markdown agents 随官方 lifecycle 安装，但不承载 `model`、`model_reasoning_effort` 或 `sandbox_mode`；`--with-agents` 编排官方 standalone TOML 配置面
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
  - 生成 `<path>/plugins/zc-toolkit/commands/<command>.md`
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
  - 生成 `~/.codex/plugins/zc-toolkit/commands/<command>.md`
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
3. 用户安装：只需要 skills / 插件角色说明时运行 `zc platform plugin codex --install`；需要逐角色显式档位时运行 `zc platform plugin codex --install --with-agents`。
4. 状态检查：`zc platform plugin codex --status` 只证明插件 installed / enabled / version；逐角色档位必须用 `zc platform plugin codex --status --with-agents --json` 检查 companion 回执和 artifacts。
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

注意：已归档的官方 `openai/plugins` 仓库给出过 plugin-level `commands/`、`agents/` 和 `hooks.json` 实例；当前官方 Subagents 文档只承诺 standalone TOML 可以覆盖 session settings。插件 Markdown agent 与 TOML companion 使用同一份角色正文，但只有后者携带显式模型、推理和 sandbox 配置。

## 验证

```bash
pnpm --dir packages/platform-codex test
pnpm --dir packages/platform-codex build
pnpm --dir packages/platform-codex verify
```
