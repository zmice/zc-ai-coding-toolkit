# @zmice/platform-codex

`@zmice/platform-codex` 会从 `@zmice/toolkit` 生成并安装面向 Codex 的工件。

当前输出包括：

- `AGENTS.md`

此包是平台适配层，提示词内容仍由 `@zmice/toolkit` 维护。

常见用法：

- `zc platform install codex -o /tmp/codex-out`
- `zc platform install codex`
- `zc platform install codex --plan --format json`
