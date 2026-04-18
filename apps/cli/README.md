# @zmice/zc

`@zmice/zc` is the operator/runtime CLI for the AI Coding Toolkit workspace.

This package preserves the current `zc` runtime behavior and keeps the command surface compatible while introducing the future namespace layout:

- `zc runtime ...`
- `zc toolkit ...`
- `zc platform ...`
- `zc upstream ...`

The CLI discovers prompt assets from `packages/toolkit/src/content` and does not own prompt content itself.

Current high-value commands:

- `zc toolkit validate`
- `zc platform generate <qwen|codex|qoder> [--plan] [--format json]`
- `zc platform install <qwen|codex|qoder> [-o <dir>] [--plan] [--format json]`
- `zc upstream diff <id> [--against <baseline>] [--format text|json]`
- `zc upstream snapshot <id> [--label <label>] [--format text|json|md]`
- `zc upstream report <id|all> [--format text|json|md] [--output <path>]`
- `zc upstream import <id> --dry-run [--format text|json] [--output <path>]`

Notes:

- `zc platform install` 未传 `-o` 时，会优先向上解析最近项目根。
- `zc upstream snapshot` 只会向 `references/snapshots/<id>/` 追加快照，不会直接写入 `packages/toolkit` 或 `packages/platform-*`。
