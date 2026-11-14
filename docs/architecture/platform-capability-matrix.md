# Platform Capability Matrix

## 目标

基于各平台**官方文档**重新定义 `zc platform install` 的适配边界，避免把“平台安装”继续等同于“写一个入口文件”。

这份文档回答 4 个问题：

1. 各平台官方到底支持哪些自定义安装面
2. 哪些平台有自己的 extension / plugin 生命周期
3. 当前仓库准备覆盖哪些能力
4. 不同平台后续应该采用哪种安装模型

## 官方能力矩阵

| 平台 | Entry / Memory | Commands | Skills | Agents | Extension / Plugin | 用户级 | 项目级 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Codex | `AGENTS.md` | 本工具包以同名 skill 承接 command，避免旧 `commands/` 迁移成重复 skill | `~/.codex/skills` + plugin skills | standalone `.codex/agents/*.toml` + `[agents]`；plugin-level `agents/` 保留为已验证打包 surface | 通用 Plugins Directory + Git/local marketplace + `codex plugin` CLI | Yes | Yes |
| Claude Code | `CLAUDE.md` | `~/.claude/commands` / `.claude/commands` | 未见官方 skills 目录模型 | `~/.claude/agents` / `.claude/agents` | 未见官方 plugin 安装模型 | Yes | Yes |
| Qwen | `QWEN.md` | extension 内支持 | `~/.qwen/skills` / `.qwen/skills` | extension 内支持 | `~/.qwen/extensions` / `.qwen/extensions` + 官方 `qwen extensions` CLI | Yes | Yes |
| OpenCode | `AGENTS.md` | `~/.config/opencode/commands` / `.opencode/commands` | `~/.config/opencode/skills` / `.opencode/skills` | `~/.config/opencode/agents` / `.opencode/agents` | 未见独立 plugin 安装模型 | Yes | Yes |
| Qoder CN | 无（插件模式不需要入口文件） | `commands/*.md` | `skills/*/SKILL.md` | `agents/*.md` | `.qoder-plugin/plugin.json` | Yes | Yes |

## 平台分型

### 1. Entry File + Skills + Plugin Lifecycle

- 平台：`Codex`
- 推荐安装面：
  - `AGENTS.md`
  - `skills/`
  - `.codex-plugin/plugin.json`
  - repo / personal / Git marketplace
- 处理原则：
  - plugin 优先交给官方 `codex plugin add/list/remove` 与 `codex plugin marketplace add/list/upgrade/remove`
  - 插件目录可携带 `skills/`、`commands/`、`agents/`、`hooks.json`、MCP servers/connectors 和安装面元数据
  - `.codex-plugin/plugin.json` 提供稳定身份；agent / command 文件可按官方示例作为同级自动发现 surface，不要求虚构 manifest 字段
  - 当前官方 Subagents 文档以 `.codex/agents/*.toml` 和 `[agents]` 作为 custom agent 配置面；custom agent 可设置 model / reasoning 并关闭受支持的能力或技能，`[agents]` 管理默认值和并发。权限、provider 和 MCP servers 继承父会话，custom agent 文件中的 `sandbox_mode`、`approval_policy`、`model_provider`、`mcp_servers` 不覆盖父配置
  - `zc --with-agents` 的 receipt-backed companion 承担已安装插件与 standalone custom-agent 角色注册之间的桥接；当前不固定模型或 effort，不能在官方为插件 Markdown agent 提供同等配置契约前删除

### 2. Entry File + Native Directories

- 平台：`Claude Code`、`OpenCode`
- 推荐安装面：
  - `CLAUDE.md` / `AGENTS.md`
  - `commands/`
  - `agents/` 或 `skills/`
- 处理原则：
  - 直接写官方目录结构
  - 不伪造“插件安装”

### 3. Entry File + Extension Lifecycle

- 平台：`Qwen`
- 推荐安装面：
  - extension bundle
  - extension 内的 `QWEN.md`、`commands/`、`skills/`、`agents/`
- 处理原则：
  - 用户级优先用官方 `qwen extensions` CLI 管理
  - 项目级保留 workspace extension 目录安装

### 4. Plugin Lifecycle（插件优先）

- 平台：`Qoder CN`
- 推荐安装面：
  - `.qoder-plugin/plugin.json`
  - `commands/*.md`
  - `skills/*/SKILL.md`
  - `agents/*.md`
- 处理原则：
  - 插件优先策略：通过 `createQoderCnGenerationPlan()` 生成标准插件 bundle
  - `zc platform install qoder-cn --global` 通过 `qodercn plugins validate/install` 原生注册插件
  - `update / repair / uninstall` 继续使用官方 `qodercn plugins` 生命周期
  - 不需要入口文件（无 Entry / Memory），所有内容通过插件目录承载
  - 默认配置根为 `~/.qoder-cn`，可由 `QODERCN_CONFIG_DIR` 覆盖

## 官方要求摘要

### Codex

- 全局级 / 项目级说明入口：`AGENTS.md`
- 全局级默认位置：`~/.codex/AGENTS.md`
- Skills 目录：`~/.codex/skills`
- 已归档的官方 `openai/plugins` 仓库提供 plugin-level `commands/`、`agents/` 和 `hooks.json` 历史实例；它不再作为当前运行时行为的唯一事实源
- ChatGPT 和 Codex 共享通用 Plugins Directory；本地和 Git marketplace 用于开发、测试和团队分发
- Codex CLI 稳定命令面：
  - `codex plugin add|list|remove`
  - `codex plugin marketplace add|list|upgrade|remove`
- plugin manifest 可声明 `skills`、`mcpServers`、兼容 `apps` 和 `interface`；commands / agents / hooks 作为插件目录 surface
- 插件支持面是 ChatGPT Work web、ChatGPT/Codex desktop 和 Codex CLI；不包括 IDE extension、Chat、mobile
- 当前 Codex releases 默认启用 subagent workflow，可由用户请求或 `AGENTS.md` / skill 指令触发，并在 Desktop、CLI 和 IDE 中显示 agent threads
- standalone custom agent 的 `model` / `model_reasoning_effort` 可形成 role hard pin，但本工具包当前不生成这两个字段；`skills.config` 可关闭技能。权限、provider、MCP servers 从父会话继承，角色中的只读指令不创建独立只读沙箱；`[agents]` 提供并发、默认模型和 interrupt 配置。已有用户全局默认值按宿主优先级生效，不能保证子任务模型等于父任务模型
- plugin-level Markdown agents 随插件目录分发，提供角色说明；standalone TOML roles 与 `[agents.*] config_file` 提供角色注册和 companion 同步。两种安装面均需经新任务验证角色发现与有效设置，不能仅凭文件存在宣称运行时生效
- `zc-toolkit` 保留带哈希的 companion payload，并用结构化 status 区分“插件已安装”和“逐角色配置已同步”

来源：

- <https://learn.chatgpt.com/docs/plugins>
- <https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin>
- <https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin-marketplace>
- <https://learn.chatgpt.com/docs/agent-configuration/subagents>
- <https://learn.chatgpt.com/docs/config-file/config-reference>
- <https://developers.openai.com/plugins/build/plugins>
- <https://github.com/openai/plugins>

### Claude Code

- 用户级 memory：`~/.claude/CLAUDE.md`
- 项目级 memory：`./CLAUDE.md`
- 组织级 enterprise policy：
  - Linux / WSL：`/etc/claude-code/CLAUDE.md`
  - 当前不属于 `zc` 的安装范围
- 项目级本地 memory：`./CLAUDE.local.md`
  - 官方已标记为 deprecated
  - 当前不作为 `zc` 的安装目标
- `CLAUDE.md` 支持 `@path/to/import` 导入额外文件
  - 当前 `zc` 只负责生成主入口 `CLAUDE.md`
  - 不负责生成或管理被导入文件
- 用户级 / 项目级 commands：
  - `~/.claude/commands/`
  - `.claude/commands/`
- 用户级 / 项目级 agents：
  - `~/.claude/agents/`
  - `.claude/agents/`
- 当前没有可靠官方依据表明 Claude Code 提供单独的官方 skills 目录或 plugin 生命周期

来源：

- Anthropic Claude Code memory
- Anthropic Claude Code slash commands
- Anthropic Claude Code sub-agents

### Qwen

- 项目级上下文：`<project>/QWEN.md`
- 用户级上下文目录：`~/.qwen/`
- Skills：
  - `~/.qwen/skills/`
  - `<project>/.qwen/skills/`
- Extensions：
  - `~/.qwen/extensions/`
  - `<project>/.qwen/extensions/`
- Extension 内可包含：
  - `qwen-extension.json`
  - `commands/`
  - `skills/`
  - `agents/`
- 官方提供 `qwen extensions install|update|uninstall|link`

来源：

- 阿里云帮助中心
- Qwen Code Docs skills / extension / extensions 管理文档

### Qoder CN

- 无入口文件，采用插件优先策略
- 插件身份声明：`.qoder-plugin/plugin.json`
- 插件目录结构：
  - `commands/<command>.md`
  - `skills/<skill>/SKILL.md`
  - `agents/<agent>.md`
- 安装方式：
  - `zc platform install qoder-cn --global` 同步受管 bundle，并通过官方 CLI 校验、安装
  - `zc platform generate qoder-cn --dir <output-dir>` 仅生成可审阅、可手工分发的插件 bundle
  - 手工安装时使用 `qodercn plugins validate <output-dir>` 和 `qodercn plugins install <output-dir>`
- 默认用户配置根为 `~/.qoder-cn`；通过 `QODERCN_CONFIG_DIR` 可显式覆盖

来源：

- Qoder CN 官方插件管理规范
- `packages/platform-core` 中的 Qoder CN generation/install plan 实现

### OpenCode

- 用户级 rules：`~/.config/opencode/AGENTS.md`
- 项目级 rules：`AGENTS.md`
- 用户级 / 项目级 commands：
  - `~/.config/opencode/commands/`
  - `.opencode/commands/`
- 用户级 / 项目级 skills：
  - `~/.config/opencode/skills/`
  - `.opencode/skills/`
- 用户级 / 项目级 agents：
  - `~/.config/opencode/agents/`
  - `.opencode/agents/`
- 兼容 Claude Code 的 `CLAUDE.md` 与 `.claude/skills` 回退发现，但不应替代原生 `.opencode/*`

来源：

- OpenCode Rules
- OpenCode Commands
- OpenCode Skills
- OpenCode Agents
- OpenCode Config

## 当前目标覆盖面

### 治理关系与运行时字段

`requires` / `suggests` 只表达 toolkit 关系，不生成宿主的 skill 预加载或允许列表。Qoder CN 和 Qwen adapter 已移除 `requires -> skills` 的旧转换；角色按正文条件发现技能。`tools` 保留现有平台差异：Qwen、Claude 和 Qoder CN 将其作为角色工具允许列表输出，Codex 不按此字段授权。生成文件中的允许列表不代替宿主 sandbox / approval，也不证明工具名在已安装版本中有效。

依据：[Qoder Subagent](https://docs.qoder.com/cli/subagent)、[Qwen Subagents](https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/sub-agents.md)、[Claude Subagents](https://code.claude.com/docs/en/sub-agents)（2026-11-15 核对）。Qoder 的 `skills` 有限制技能范围的语义；因此不能用前端实现依赖排除该角色的 UI 审查分流。现有工具允许列表没有在本轮被移除或放宽。

Codex 角色显式映射 standalone `zc-<id>` 与 plugin `<pluginName>:<id>`，实际调用仍以发现列表为准。Claude 角色显式报告本 adapter 尚未分发技能并给出降级规则；不以角色正文引用技能代替安装能力。

| 平台 | 目标实现 | 覆盖评价 |
| --- | --- | --- |
| Codex | 项目级传统安装仍支持 `AGENTS.md` + `.codex/config.toml` + skills + agents；推荐分发使用 Git marketplace plugin。插件包携带 skills / agents，command 保留同名 skill 与 `zc:*` 语义；receipt-backed companion 同步 standalone TOML roles；toolkit 已映射 native lifecycle、context fork、runtime capacity、thread reuse 和 Codex temp-worktree policy | 新包不再提供旧 slash / `source-command-*` 入口；已安装缓存去重需升级后验证；host runtime 自动 smoke 和受支持的 skills nested config 待补。新配置不写顶层默认模型/effort，旧回执拥有且当前值相同的字段会移除，用户改值或无回执值保留；角色 `sandbox_mode` 不构成权限隔离 |
| Claude Code | `CLAUDE.md` + `commands/zc-*.md` + `agents/zc-*.md`；不覆盖 `enterprise policy`、`CLAUDE.local.md`、`@imports` 目标文件 | 目录化原生安装 |
| Qwen | 优先通过官方 `qwen extensions` CLI 管理 `zc-toolkit` 的发布态 extension bundle；扩展内容为 `.qwen/extensions/zc-toolkit/` 下的 `QWEN.md` + `qwen-extension.json` + `commands` + `skills` + `agents` | extension 原生安装 |
| OpenCode | `AGENTS.md` + `.opencode/commands/zc-*.md` + `.opencode/skills/zc-*/SKILL.md` + `.opencode/agents/zc-*.md` + 全局对应目录 | 目录化原生安装 |
| Qoder CN | 通过 `createQoderCnGenerationPlan()` 生成标准插件 bundle（`.qoder-plugin/plugin.json` + `commands/` + `skills/` + `agents/`）；`zc platform install qoder-cn --global` 调用官方 `qodercn plugins validate/install` 注册插件 | 插件原生安装 |

## 结论

当前阶段结论：

- `Codex`：plugin lifecycle、十个角色、companion、legacy `sandbox_mode` 渲染、native lifecycle policy 和 OS 临时 worktree manager 已具备；角色模型与 effort 默认继承宿主。现有角色文件 SHA 不匹配旧回执或无回执时停止写入，内容相同也不自动认领。共享 config 按注入注册段签名管理，普通用户配置变更不等于受管内容漂移；卸载不制造悬空角色引用。下一门禁是可重复的 host runtime behavioral smoke 与受支持的 skills nested config；本次源码变更尚未安装，不证明本机会话已继承或子任务隔离已生效
- `Claude Code`：走官方目录结构，不做插件抽象
- `Qwen`：走官方 extension 生命周期
- `OpenCode`：走官方目录结构，覆盖 `AGENTS.md + commands + skills + agents`
- `Qoder CN`：走插件优先策略，通过标准插件 bundle 分发，并由官方 `qodercn plugins` 管理生命周期

## 对 `zc platform install` 的模型要求

平台安装不能只有一个 `artifact list` 概念，而应显式区分：

- `entry-file artifacts`
- `directory artifacts`
- `extension artifacts`

这意味着 `platform-core` 需要能描述：

- 写到根目录的文件
- 写到子目录的结构化内容
- 写到 extension 目录的封装内容

## 当前已完成

- `platform-core` 已提供 plan / artifact / fingerprint / install plan 的共享 contract
- `platform-claude` 和 `platform-opencode` 已纳入平台集合
- `OpenCode` agents 已覆盖
- `platform uninstall / repair / doctor` 已在 CLI 层落地，并基于 receipt / status 工作

## 建议的下一步

1. 用 `pnpm audit:context` 定期检查各平台生成内容体量
2. 如果上下文预算继续增长，按 `tier / audience / platform_exposure` 收紧默认安装集
3. Codex plugin 目录结构继续参考归档的 `openai/plugins`；当前行为以 Plugins、Subagents、Config Reference 和实际安装/runtime smoke 交叉验证
