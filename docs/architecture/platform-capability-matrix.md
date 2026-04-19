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
| Codex | 安装 `AGENTS.md` | 基础可用 |
| Qoder | 安装 `AGENTS.md` | 仅覆盖 memory 层 |
| Qwen | 安装 `QWEN.md` + `qwen-extension.json` | 仅覆盖入口层，未形成完整 extension 安装 |

换句话说，当前 `zc platform install` 更准确的语义是：

- 安装平台级入口上下文

而不是：

- 完整安装平台原生的 skills / commands / agents / extension 生态

## 结论

当前实现可以继续保留，但它只能被定义为：

- `phase 1: entry-file install`

不能再被描述成：

- `full platform-native install`

## 分阶段适配策略

### Phase 1：保持现状并明确边界

- Codex：`AGENTS.md`
- Qoder：`AGENTS.md`
- Qwen：`QWEN.md` + `qwen-extension.json`

要求：

- 文档里明确这只是入口层安装
- 不再把当前实现表述成完整平台原生安装

### Phase 2：Qoder 目录化安装

优先补：

- `AGENTS.md`
- `.qoder/commands/`
- `.qoder/skills/`
- `.qoder/agents/`

原因：

- 官方路径稳定、模型清晰
- 不依赖 extension 封装
- 与当前 `toolkit` 的 commands / skills / agents 三层结构最接近

### Phase 3：Qwen extension 安装

目标不是只写 `qwen-extension.json`，而是安装完整 extension 目录：

- `<root>/.qwen/extensions/<extension-name>/`

其中包含：

- `qwen-extension.json`
- `commands/`
- `skills/`
- `agents/`

可选同时继续支持：

- `QWEN.md`
- `.qwen/skills/`

### Phase 4：Codex skills 安装

保守推进：

- 继续保留 `AGENTS.md`
- 新增 `~/.codex/skills` / `<project>/.codex/skills` 投影

不做没有官方依据的：

- `commands/`
- `agents/`
- plugin 目录

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
