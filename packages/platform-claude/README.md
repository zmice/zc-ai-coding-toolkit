# @zmice/platform-claude

`@zmice/platform-claude` 把 `@zmice/toolkit` 的结构化内容渲染成 Claude Code 所需产物。

当前适配面：

- `CLAUDE.md`
- `.claude/commands/zc-*.md`
- `.claude/agents/zc-*.md`

明确不覆盖：

- enterprise policy：例如 Linux / WSL 下的 `/etc/claude-code/CLAUDE.md`
- 已弃用的 `CLAUDE.local.md`
- `CLAUDE.md` 通过 `@path/to/import` 导入的外部文件

命名空间规则：

- 统一语义通过 `/zc-*` command 承接
- 不会把裸名字如 `start`、`spec`、`build` 直接暴露给 Claude Code
- 例如：
  - `zc:start -> /zc-start`
  - `zc:product-analysis -> /zc-product-analysis`
  - `zc:sdd-tdd -> /zc-sdd-tdd`

当前安装模型：

- `--project`
  - 安装 `<project>/CLAUDE.md`
  - 安装 `<project>/.claude/commands/zc-<command>.md`
  - 安装 `<project>/.claude/agents/zc-<agent>.md`
- `--global`
  - 安装 `~/.claude/CLAUDE.md`
  - 安装 `~/.claude/commands/zc-<command>.md`
  - 安装 `~/.claude/agents/zc-<agent>.md`
- `--dir <path>`
  - 安装 `<path>/CLAUDE.md`
  - 安装 `<path>/commands/zc-<command>.md`
  - 安装 `<path>/agents/zc-<agent>.md`

官方依据：

- Claude Code memory
- Claude Code slash commands
- Claude Code sub-agents

当前边界说明：

- `zc` 只安装用户级和项目级的官方原生目录
- 不扩展出没有官方依据的 `skills` 或 plugin 模型
- 不代管 `CLAUDE.md` 的 import 目标文件，避免把项目上下文拆成第二套分发系统

常用验证：

```bash
pnpm --dir packages/platform-claude test
pnpm --dir packages/platform-claude build
pnpm --dir packages/platform-claude verify
```
