# Legacy Root Source Retirement

This document records the retirement of the old mixed root-level source model.

## Retired as Source of Truth

The following locations are no longer authoritative:

- `skills/`
- `commands/`
- `agents/`
- `QWEN.md`
- `AGENTS.md`
- `instructions.md`
- `UPSTREAM.md`
- `install.sh`
- `install.ps1`
- `qwen-extension.json`

They have been removed from the repository root. Their content has either been migrated into
`packages/toolkit`, replaced by `packages/platform-*`, or retained only in git history and
governance records.

## New Ownership

| Legacy location | New owner |
| --- | --- |
| `skills/` | `packages/toolkit/src/content/skills/` |
| `commands/` | `packages/toolkit/src/content/commands/` |
| `agents/` | `packages/toolkit/src/content/agents/` |
| `QWEN.md` | `packages/platform-qwen` generation output |
| `AGENTS.md` | `packages/platform-codex` generation output |
| `instructions.md` | `packages/platform-qoder` generation output |
| `UPSTREAM.md` | `references/` governance model |
| `install.sh` / `install.ps1` | removed from root; installation flows move through `apps/cli` |
| `qwen-extension.json` | removed from root; generation belongs to `packages/platform-qwen` |

## Migration Rule

- Do not add new source content to the retired root model.
- New content must land in `packages/toolkit`.
- New platform packaging logic must land in `packages/platform-*`.
- Upstream tracking must land in `references/`.

## Removal Strategy

The retirement is now complete:

1. content has been migrated into `packages/toolkit`
2. runtime/platform flows use package-owned implementations
3. legacy root files and directories have been removed
4. remaining historical context lives in git history and `references/`
