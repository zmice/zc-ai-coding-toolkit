# Legacy Root Source Model

Status: retired from repository root.

## Scope

This note tracks the migration away from the legacy root-level source model:

- `skills/`
- `commands/`
- `agents/`
- `QWEN.md`
- `AGENTS.md`
- `instructions.md`

## Outcome

- canonical content ownership moved into `packages/toolkit`
- platform generation moved into `packages/platform-*`
- runtime discovery moved to the toolkit content tree
- legacy root files and directories were removed after verification

## Follow-up

- replace this seed record with actual external upstream entries as the migration progresses
- keep this note only as a governance breadcrumb for the completed root retirement
