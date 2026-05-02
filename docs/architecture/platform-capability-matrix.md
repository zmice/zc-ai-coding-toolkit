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
| Codex | `AGENTS.md` | 未见官方目录模型 | `~/.codex/skills` | 本轮未重新确认官方目录模型 | 本轮未重新确认官方 plugin 安装模型 | Yes | Yes |
| Claude Code | `CLAUDE.md` | `~/.claude/commands` / `.claude/commands` | 未见官方 skills 目录模型 | `~/.claude/agents` / `.claude/agents` | 未见官方 plugin 安装模型 | Yes | Yes |
| Qwen | `QWEN.md` | extension 内支持 | `~/.qwen/skills` / `.qwen/skills` | extension 内支持 | `~/.qwen/extensions` / `.qwen/extensions` + 官方 `qwen extensions` CLI | Yes | Yes |
| OpenCode | `AGENTS.md` | `~/.config/opencode/commands` / `.opencode/commands` | `~/.config/opencode/skills` / `.opencode/skills` | `~/.config/opencode/agents` / `.opencode/agents` | 未见独立 plugin 安装模型 | Yes | Yes |

## 平台分型

### 1. Entry File + Skills

- 平台：`Codex`
- 推荐安装面：
  - `AGENTS.md`
  - `skills/`
- 处理原则：
  - 不发明没有官方依据的 `commands/` 目录
  - `zc` 可以生成 custom agent 配置和 plugin / marketplace bundle，但必须在文档中标注为 `zc` 的打包路径，而不是官方通用命令面

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
- 当前没有可靠官方依据表明 Codex 支持 `commands/` 目录模型
- 本轮只把 custom agents / plugin marketplace 作为当前 `zc` 实现事实记录，不把它们写入官方能力矩阵的 commands 面

来源：

- OpenAI Developers `AGENTS.md` 指南
- OpenAI `openai/skills`

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
| Codex | 项目级安装 `AGENTS.md` + `.codex/config.toml` + `.codex/skills/zc-<command>/SKILL.md` + `.codex/skills/zc-<skill>/SKILL.md` + `.codex/agents/zc-<agent>.toml`；用户级 / 自定义目录安装对应的 `AGENTS.md` + `config.toml` + `skills/` + `agents/`；另支持 `zc platform plugin codex` 生成 personal/repo marketplace bundle | 官方面保持保守，`agents` 和 plugin / marketplace 明确标注为 `zc` 的打包与配置实现 |
| Claude Code | `CLAUDE.md` + `commands/zc-*.md` + `agents/zc-*.md`；不覆盖 `enterprise policy`、`CLAUDE.local.md`、`@imports` 目标文件 | 目录化原生安装 |
| Qwen | 优先通过官方 `qwen extensions` CLI 管理 `zc-toolkit` 的发布态 extension bundle；扩展内容为 `.qwen/extensions/zc-toolkit/` 下的 `QWEN.md` + `qwen-extension.json` + `commands` + `skills` + `agents` | extension 原生安装 |
| OpenCode | `AGENTS.md` + `.opencode/commands/zc-*.md` + `.opencode/skills/zc-*/SKILL.md` + `.opencode/agents/zc-*.md` + 全局对应目录 | 目录化原生安装 |

## 结论

当前阶段结论：

- `Codex`：官方 commands 面继续保守；当前 `zc` 已额外提供 custom agent 配置和 plugin / marketplace bundle
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
3. 若要扩大 Codex custom agents 或 marketplace 叙述，先重新核对官方文档，再更新官方能力矩阵
