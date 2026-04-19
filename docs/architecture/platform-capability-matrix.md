# Platform Capability Matrix

## 目标

基于各平台**官方文档**重新定义 `zc platform install` 的适配边界，避免继续把“平台安装”简单理解为“写一个入口文件”。

这份文档只回答 3 个问题：

1. 各平台官方到底支持哪些自定义安装面
2. 当前仓库已经覆盖了哪些能力
3. 下一步应该如何分阶段补齐

## 官方能力矩阵

| 平台 | Memory / Entry File | Skills Dir | Commands Dir | Agents Dir | Extension / Plugin | 用户级 | 项目级 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Codex | `AGENTS.md` | `~/.codex/skills` | 未见官方目录模型 | 未见官方目录模型 | 未见官方 plugin 安装模型 | Yes | Yes |
| Qoder | `AGENTS.md` | `~/.qoder/skills` / `.qoder/skills` | `~/.qoder/commands` / `.qoder/commands` | `~/.qoder/agents` / `.qoder/agents` | 未见独立 plugin 安装模型 | Yes | Yes |
| Qwen | `QWEN.md` | `~/.qwen/skills` / `.qwen/skills` | extension 内支持 | extension 内支持 | `~/.qwen/extensions` / `.qwen/extensions` | Yes | Yes |

## 官方要求摘要

### Codex

- 全局级 / 项目级说明入口：`AGENTS.md`
- 全局级默认位置：`~/.codex/AGENTS.md`
- Skills 目录：`~/.codex/skills`
- 当前没有可靠官方依据表明 Codex 支持与 Qoder/Qwen 类似的 `commands/` 或 `agents/` 目录模型

来源：

- OpenAI Developers `AGENTS.md` 指南
- OpenAI `openai/skills`

### Qoder

- 用户级 memory：`~/.qoder/AGENTS.md`
- 项目级 memory：`<project>/AGENTS.md`
- 用户级 / 项目级 commands：
  - `~/.qoder/commands/`
  - `<project>/.qoder/commands/`
- 用户级 / 项目级 skills：
  - `~/.qoder/skills/{skill-name}/SKILL.md`
  - `<project>/.qoder/skills/{skill-name}/SKILL.md`
- 用户级 / 项目级 agents：
  - `~/.qoder/agents/<agent>.md`
  - `<project>/.qoder/agents/<agent>.md`

来源：

- Qoder CLI / Commands / Skills / Subagent / Custom Agent 官方文档

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

来源：

- 阿里云帮助中心
- Qwen Code Docs skills / extension 官方文档

## 当前仓库覆盖面

| 平台 | 当前实现 | 覆盖评价 |
| --- | --- | --- |
| Codex | 项目级安装 `AGENTS.md`；用户级 / 自定义目录安装 `AGENTS.md` + `skills/zc-<command>/SKILL.md` + `skills/zc-<skill>/SKILL.md` | 保守适配，覆盖官方明确能力 |
| Qoder | 安装 `AGENTS.md` + `commands` + `skills` + `agents` | 已覆盖官方目录模型 |
| Qwen | 优先通过官方 `qwen extensions install/update` 管理 `zc-toolkit` 扩展；扩展内容为 `.qwen/extensions/zc-toolkit/` 下的 `QWEN.md` + `qwen-extension.json` + `commands` + `skills` + `agents` | 已升级为完整 extension 安装 |

换句话说，当前 `zc platform install` 已经不再只是“写一个入口文件”，而是按平台能力矩阵选择：

- 入口文件安装
- 目录化 assets 安装
- extension 目录安装

## 结论

当前阶段结论：

- `Codex`：继续保守，只做 `AGENTS.md` + 官方 skills
- `Qoder`：已是目录化原生安装
- `Qwen`：已是 extension 原生安装

## 分阶段适配策略

### 已完成

- Codex：`AGENTS.md` + 用户级 / 自定义目录 `skills`
- Qoder：`AGENTS.md` + `commands / skills / agents`
- Qwen：extension 目录安装

### 后续只保留两类增量

- 更精确的平台版本/状态治理
- 平台原生命令/skills/agents 内容投影策略继续打磨

## 对 `zc platform install` 的模型要求

后续平台安装不应只有一个 `artifact list` 概念，而应显式区分：

- `entry-file artifacts`
- `directory artifacts`
- `extension artifacts`

这意味着后续 `platform-core` 需要能描述：

- 写到根目录的文件
- 写到子目录的结构化内容
- 写到 extension 目录的封装内容

## 建议的下一步

1. 先收一个 `platform capability` 数据模型
2. 再优先实现 `Qoder directory install`
3. 最后实现 `Qwen extension install`

Codex 继续保守，只补 skills，不发明无官方依据的扩展目录。
