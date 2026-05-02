# @zmice/platform-codex

`@zmice/platform-codex` 把 `@zmice/toolkit` 的结构化内容渲染成 Codex 平台所需产物。

它是 **仓库内部包**，公开分发入口统一由 `@zmice/zc` 提供。

当前输出包括：

- `AGENTS.md`
- `skills/zc-<command>/SKILL.md`
- `skills/zc-<skill>/SKILL.md`
- `agents/zc-<agent>.toml`
- 可选 Codex plugin bundle：`.codex-plugin/plugin.json` + `skills/<command-or-skill>/`
- 可选 Codex marketplace bundle：`.agents/plugins/marketplace.json` + `AGENTS.md` / `.codex/AGENTS.md` + `plugins/zc-toolkit/` / `.codex/plugins/zc-toolkit/` + `.codex/agents/`

这里的 `.codex/config.toml`、`.codex/agents/`、plugin 和 marketplace bundle 都是 `zc` 当前安装模型的一部分；文档中不要把它们描述成 Codex 的通用 command surface。

## 边界

- 提示资产内容不在本包维护
- 本包只关心 Codex 平台模板、安装计划和产物布局
- 不承担仓库治理能力

## 常用用法

```bash
zc platform install codex --dir /tmp/codex-out
zc platform install codex
zc platform install codex --global
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
  - 生成 `<path>/skills/<command>/SKILL.md`
  - 生成 `<path>/skills/<skill>/SKILL.md`
  - 插件自身已经提供 `zc-toolkit` 命名空间，因此 skill 名不再额外加 `zc-` 前缀
  - 用于 Codex plugin marketplace / 本地 plugin 打包场景，不替代项目级 `AGENTS.md`
  - Codex plugin manifest 当前只声明 skills / apps / MCP，不直接打包 custom agents
- `plugin codex`
  - `generate codex --bundle codex-marketplace --project` 的短入口
  - 不传 selector 时默认解析最近项目根，生成 repo-local marketplace
  - 项目级插件路线生成薄入口到 `<project>/AGENTS.md`
  - `plugin codex --global` 生成 personal marketplace 到 `~/.agents/plugins/marketplace.json`
  - `plugin codex --global` 生成薄入口到 `~/.codex/AGENTS.md`
  - `plugin codex --global` 生成插件到 `~/.codex/plugins/zc-toolkit/`，并生成 custom agents 到 `~/.codex/agents/`
  - 追加 `--force` 时会先清理目标插件的 `skills/` 目录，再写入当前版本，避免旧命名残留
  - 也可以显式使用 `plugin codex --project` 或 `plugin codex --dir <repo>`
  - 常用别名是 `p codex`
- `generate --bundle codex-marketplace --dir <path>`
  - 生成 `<path>/.agents/plugins/marketplace.json`
  - 生成 `<path>/AGENTS.md`
  - 生成 `<path>/plugins/zc-toolkit/.codex-plugin/plugin.json`
  - 生成 `<path>/plugins/zc-toolkit/skills/<command>/SKILL.md`
  - 生成 `<path>/plugins/zc-toolkit/skills/<skill>/SKILL.md`
  - 生成 `<path>/.codex/agents/zc-<agent>.toml`
  - 用于 repo-local marketplace 或后续 git-subdir marketplace 分发；`AGENTS.md` 只保留全局规则、入口映射和文件索引，custom agents 作为 `zc` 管理的 Codex 配置随仓库安装
- `generate --bundle codex-marketplace --project`
  - 与 `--dir <project-root>` 布局一致，但目录由当前 cwd 向上解析最近项目根得到
- `generate --bundle codex-marketplace --global`
  - 生成 `~/.agents/plugins/marketplace.json`
  - 生成 `~/.codex/AGENTS.md`
  - 生成 `~/.codex/plugins/zc-toolkit/.codex-plugin/plugin.json`
  - 生成 `~/.codex/plugins/zc-toolkit/skills/<command>/SKILL.md`
  - 生成 `~/.codex/plugins/zc-toolkit/skills/<skill>/SKILL.md`
  - 生成 `~/.codex/agents/zc-<agent>.toml`
  - 用于个人级 Codex marketplace；`~/.codex/AGENTS.md` 保留全局默认规则，插件内容保留在 `~/.codex/plugins/zc-toolkit/skills/`

在 Codex 中：

- 传统 `install codex` 路径通过 command-alias skill 承接，例如：
  - `$zc-start`
  - `$zc-spec`
  - `$zc-task-plan`
  - `$zc-build`
- 更完整的方法和专题能力继续通过 `$zc-<skill>` 使用
- 插件路径通过 `zc-toolkit` 插件命名空间承接，skill 自身使用无前缀名称，例如：
  - `$start`
  - `$spec`
  - `$task-plan`
  - `$build`

命名空间规则：

- 传统直装保留 `zc-` 前缀，避免污染 Codex 全局 skill 名称
- 插件安装不再给 skill 额外加 `zc-` 前缀，因为插件本身已经是命名空间
- custom agents 仍保留 `zc-` / `zc_` 前缀，因为它们写入 `.codex/agents` 和 `config.toml`，不在 plugin skills 命名空间内
- 传统直装示例：
  - `zc:start -> $zc-start`
  - `zc:product-analysis -> $zc-product-analysis`
  - `zc:sdd-tdd -> $zc-sdd-tdd`
- 插件安装示例：
  - `zc:start -> $start`
  - `zc:product-analysis -> $product-analysis`
  - `zc:sdd-tdd -> $sdd-tdd`

项目安装 / 全局安装的详细步骤见：

- `docs/usage-guide.md`

## Codex plugin 分发策略

Codex 不要求像 Qwen 一样先拆独立发布仓库。推荐按阶段推进：

1. 本地验证：`--bundle codex-plugin` 生成单个 plugin root，用个人 marketplace 指向它。
2. 个人级使用：`platform plugin codex --global` 生成 personal marketplace 和 `~/.codex/AGENTS.md` 薄入口，Codex 可从 `~/.agents/plugins/marketplace.json` 发现插件，并从 `~/.codex/agents/*.toml` 加载 custom agents。
3. 仓库内分发：`--bundle codex-marketplace --dir <repo>` 生成 repo-local marketplace 和仓库根 `AGENTS.md` 薄入口，Codex 可从 `$REPO_ROOT/.agents/plugins/marketplace.json` 发现插件，并从 `$REPO_ROOT/.codex/agents/*.toml` 加载 custom agents。
4. 跨仓库/跨团队发布：把 `plugins/zc-toolkit/` 放在独立仓库根目录，或把本仓库作为 `git-subdir` source 暴露给 marketplace。

只有当需要稳定版本、独立权限、独立 README/LICENSE、自动同步和跨项目安装时，才需要像 Qwen 的 `zc-qwen-extension` 一样新建独立仓库。

## 验证

```bash
pnpm --dir packages/platform-codex test
pnpm --dir packages/platform-codex build
pnpm --dir packages/platform-codex verify
```
