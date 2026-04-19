# @zmice/platform-opencode

`@zmice/platform-opencode` 把 `@zmice/toolkit` 的结构化内容渲染成 OpenCode 所需产物。

第一版保守适配面：

- `AGENTS.md`
- `.opencode/commands/zc-*.md`
- `.opencode/skills/zc-*/SKILL.md`
- `.opencode/agents/zc-*.md`

## 边界

- 内容仍由 `@zmice/toolkit` 维护
- 本包只负责 OpenCode 平台模板、安装计划和落盘路径
- 当前不生成 plugins、tools 等其他目录

## 官方依据

- Rules: https://opencode.ai/docs/rules/
- Commands: https://opencode.ai/docs/commands/
- Skills: https://opencode.ai/docs/skills
- Agents: https://opencode.ai/docs/agents/

当前安装模型：

- `--project`
  - 安装 `<project>/AGENTS.md`
  - 安装 `<project>/.opencode/commands/zc-<command>.md`
  - 安装 `<project>/.opencode/skills/zc-<skill>/SKILL.md`
  - 安装 `<project>/.opencode/agents/zc-<agent>.md`
- `--global`
  - 安装 `<home>/.config/opencode/AGENTS.md`
  - 安装 `<home>/.config/opencode/commands/zc-<command>.md`
  - 安装 `<home>/.config/opencode/skills/zc-<skill>/SKILL.md`
  - 安装 `<home>/.config/opencode/agents/zc-<agent>.md`
- `--dir <path>`
  - 安装 `<path>/AGENTS.md`
  - 安装 `<path>/commands/zc-<command>.md`
  - 安装 `<path>/skills/zc-<skill>/SKILL.md`
  - 安装 `<path>/agents/zc-<agent>.md`

`--global` 的 `destinationRoot` 语义就是官方配置根目录本身，例如 `~/.config/opencode`。

命名空间规则：

- 统一语义通过 `/zc-*` command 承接
- 不会把裸名字如 `start`、`spec`、`build` 直接暴露给 OpenCode
- 例如：
  - `zc:start -> /zc-start`
  - `zc:product-analysis -> /zc-product-analysis`
  - `zc:sdd-tdd -> /zc-sdd-tdd`

常用验证：

```bash
pnpm --dir packages/platform-opencode lint
pnpm --dir packages/platform-opencode test
pnpm --dir packages/platform-opencode build
pnpm --dir packages/platform-opencode verify
```
