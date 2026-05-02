# GStack

Source: `https://github.com/garrytan/gstack`

## Status

Registered from historical upstream tracking. Initial baseline snapshot captured in the new governance layer.

## Historical Role

- Commit history previously tracked it as an architecture reference.
- It influenced strategic filtering, UX review, and "role embedded in command" style decisions.

## Expected Downstream Value

- UX and workflow review heuristics
- Command-layer product framing
- Prompt architecture references for design-heavy tasks

## Boundaries

- Treat it as a reference for behavior and architecture, not as a direct source tree to replicate.

## Snapshot Baseline

- baseline: `references/snapshots/gstack/2026-04-18T18-02-14-539Z-2026-04-19-baseline.json`
- current governance status: `active`

## Latest Reviewed Upstream

- remote head: `675717e3200d8f54b7e179a3425a21bdae33414b`
- observed date: 2026-04-29
- notable upstream change: v1.17.0.0 wires up a gbrain federation surface and continues the prompt style shift toward outcome-framed questions, proactive routing, question tuning, and explicit stop gates.

## Extractable Upgrades

- Keep plan-mode questions few, outcome-framed, and preference-aware.
- Treat review/eval evidence as a plan artifact before claiming readiness.
- Diff-based test selection and real PTY E2E are useful as future verification architecture references.
- Add `command:start` tie-breakers for when to ask versus when to proceed: ask only for high-stakes ambiguity, otherwise choose the conservative workflow and state the assumption.
- Add a privacy / persistence stop-gate rule: anything that would write cross-session memory, sync across machines, or mutate project routing files must be explicit and opt-in.
- Extend plan-review and task-planning content so review findings become plan artifacts with evidence, risks, and verification gates.

## Non-Adoption Boundary

- Do not import gstack telemetry, auto-upgrade, browser runtime, heavy preambles, or paid eval harness into `zc`.
- Do not make plan-mode writes part of default `zc` behavior.
- Do not adopt gbrain-style cross-machine memory sync or question-preference storage as a default runtime capability.

## Recommended Phase

- Phase 1: extract wording and workflow discipline into documentation only.
- Phase 3: revisit PTY/E2E harness ideas if `zc team` needs end-to-end runtime tests.
