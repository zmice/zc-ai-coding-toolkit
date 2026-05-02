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

- remote head: `19e49a094d79540e635b107cb3490926ddeac7a3`
- observed date: 2026-04-29
- notable upstream change: Gemini CLI setup and command docs were added; upstream now documents native `gemini skills install`, `.gemini/skills` / `.agents/skills` discovery, and the importance of frontmatter descriptions for automatic skill activation.

## Extractable Upgrades

- Adopt the skill anatomy checklist as a governance heuristic: trigger clarity, workflow steps, anti-rationalization, red flags, verification evidence.
- Reuse the OpenCode idea of agent-driven skill routing through `AGENTS.md` rather than forcing slash-command parity on platforms that do not natively support it.
- Keep reference checklists as optional supporting material, not always-loaded context.
- Strengthen `command:start` routing language: descriptions and trigger conditions must say both what a workflow does and when to activate it, because platforms increasingly auto-discover skills from short metadata.
- Prefer on-demand skill loading over persistent always-on context; reserve persistent files such as `AGENTS.md` / `GEMINI.md` for project conventions and canonical routing.
- Extend the same discovery/context rule into `using-agent-skills` and `context-engineering`, not only the `start` command.

## Non-Adoption Boundary

- Do not mirror upstream skill names or prose directly into `packages/toolkit`.
- Do not add platform setup instructions that imply unsupported native plugin behavior.
- Do not add Gemini as a supported `zc platform` target until the CLI install model, generated layout, and tests are designed in `packages/platform-*`.

## Recommended Phase

- Phase 1: start/workflow routing wording plus meta-skill/context-engineering documentation heuristics.
- Phase 2: optional toolkit lint warnings for missing verification, trigger, or negative-exclusion sections.
- Phase 3: evaluate a dedicated Gemini platform adapter if there is user demand.
