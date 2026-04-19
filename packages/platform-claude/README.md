# @zmice/platform-claude

`@zmice/platform-claude` 把 `@zmice/toolkit` 的结构化内容渲染成 Claude Code 所需产物。

当前适配面：

- `CLAUDE.md`
- `.claude/commands/zc-*.md`
- `.claude/agents/zc-*.md`

官方依据：

- Claude Code memory
- Claude Code slash commands
- Claude Code sub-agents

常用验证：

```bash
pnpm --dir packages/platform-claude test
pnpm --dir packages/platform-claude build
pnpm --dir packages/platform-claude verify
```
