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
| Codex | `AGENTS.md` | plugin-level `commands/` | `~/.codex/skills` + plugin skills | standalone `.codex/agents/*.toml` + `[agents]`；plugin-level `agents/` 保留为已验证打包 surface | 通用 Plugins Directory + Git/local marketplace + `codex plugin` CLI | Yes | Yes |
| Claude Code | `CLAUDE.md` | `~/.claude/commands` / `.claude/commands` | 未见官方 skills 目录模型 | `~/.claude/agents` / `.claude/agents` | 未见官方 plugin 安装模型 | Yes | Yes |
| Qwen | `QWEN.md` | extension 内支持 | `~/.qwen/skills` / `.qwen/skills` | extension 内支持 | `~/.qwen/extensions` / `.qwen/extensions` + 官方 `qwen extensions` CLI | Yes | Yes |
| OpenCode | `AGENTS.md` | `~/.config/opencode/commands` / `.opencode/commands` | `~/.config/opencode/skills` / `.opencode/skills` | `~/.config/opencode/agents` / `.opencode/agents` | 未见独立 plugin 安装模型 | Yes | Yes |

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
  - 当前官方 Subagents 文档以 `.codex/agents/*.toml` 和 `[agents]` 作为 custom agent 配置面，支持 model、reasoning、sandbox、MCP、skills 和并发控制
  - `zc --with-agents` 的 receipt-backed companion 继续承担已安装插件与 standalone custom-agent 配置之间的桥接，不应在完成原生运行验证前删除

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
- standalone custom agent 支持 `model`、`model_reasoning_effort`、`sandbox_mode`、`mcp_servers` 和 `skills.config`；model / reasoning 可形成 role hard pin，sandbox 仍受 parent turn live override 约束；`[agents]` 提供动态并发、默认模型和 interrupt 配置
- plugin-level agents 随插件目录分发；standalone TOML roles 与 `[agents.*] config_file` 继续支持显式配置和 companion 同步
- `zc-toolkit` 保留带哈希的 companion payload，直到 plugin agent discovery、配置覆盖和升级回滚都有真实 smoke 证据

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

| 平台 | 目标实现 | 覆盖评价 |
| --- | --- | --- |
| Codex | 项目级传统安装仍支持 `AGENTS.md` + `.codex/config.toml` + skills + agents；推荐分发使用 Git marketplace plugin。插件包携带 commands / skills / agents，receipt-backed companion 同步 standalone TOML roles；toolkit 已映射 native lifecycle、context fork、runtime capacity、thread reuse 和 Codex temp-worktree policy | 分发、九个角色、标量 role config 与执行策略已对齐；host runtime 自动 smoke、MCP/skills nested config 和全局 `[agents]` 所有权合并待补 |
| Claude Code | `CLAUDE.md` + `commands/zc-*.md` + `agents/zc-*.md`；不覆盖 `enterprise policy`、`CLAUDE.local.md`、`@imports` 目标文件 | 目录化原生安装 |
| Qwen | 优先通过官方 `qwen extensions` CLI 管理 `zc-toolkit` 的发布态 extension bundle；扩展内容为 `.qwen/extensions/zc-toolkit/` 下的 `QWEN.md` + `qwen-extension.json` + `commands` + `skills` + `agents` | extension 原生安装 |
| OpenCode | `AGENTS.md` + `.opencode/commands/zc-*.md` + `.opencode/skills/zc-*/SKILL.md` + `.opencode/agents/zc-*.md` + 全局对应目录 | 目录化原生安装 |

## 结论

当前阶段结论：

- `Codex`：plugin lifecycle、九个角色、companion、role model/reasoning/sandbox 渲染、native lifecycle policy 和 OS 临时 worktree manager 已具备；下一门禁是可重复的 host runtime behavioral smoke 与复杂 nested config
- `Claude Code`：走官方目录结构，不做插件抽象
- `Qwen`：走官方 extension 生命周期
- `OpenCode`：走官方目录结构，覆盖 `AGENTS.md + commands + skills + agents`

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
