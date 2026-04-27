# Agent Skills

Source: `https://github.com/addyosmani/agent-skills`

## Status

Registered from historical upstream tracking. Initial baseline snapshot captured in the new governance layer.

## Historical Role

- This was the primary external base for the early skill and command system.
- Commit history previously marked it as the core upstream for the toolkit skill architecture.

## Expected Downstream Value

- Skill workflow structure
- Command naming and routing patterns
- Reusable agent-skill composition ideas

## Boundaries

- Do not mirror the upstream layout directly into `packages/toolkit`.
- Prefer absorbing durable workflow patterns over copying prompt wording verbatim.

## Snapshot Baseline

- baseline: `references/snapshots/agent-skills/2026-04-14-baseline.json`
- current governance status: `active`

## Latest Reviewed Upstream

- remote head: `44b9e3734198f0d39efc6453a1721a1c936da8d0`
- observed date: 2026-04-27
- notable upstream change: expanded multi-platform setup, including OpenCode guidance and skill anatomy documentation

## Extractable Upgrades

- Adopt the skill anatomy checklist as a governance heuristic: trigger clarity, workflow steps, anti-rationalization, red flags, verification evidence.
- Reuse the OpenCode idea of agent-driven skill routing through `AGENTS.md` rather than forcing slash-command parity on platforms that do not natively support it.
- Keep reference checklists as optional supporting material, not always-loaded context.

## Non-Adoption Boundary

- Do not mirror upstream skill names or prose directly into `packages/toolkit`.
- Do not add platform setup instructions that imply unsupported native plugin behavior.

## Recommended Phase

- Phase 1: documentation and lint heuristics only.
- Phase 2: optional toolkit lint warnings for missing verification or trigger sections.
