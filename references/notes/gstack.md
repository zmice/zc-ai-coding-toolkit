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

- remote head: `dde55103fcc42bd446d804ddc15567ced8455ac1`
- observed date: 2026-04-27
- notable upstream change: v1.15.0.0 with slimmer preamble and real-PTY plan-mode E2E harness

## Extractable Upgrades

- Keep plan-mode questions few, outcome-framed, and preference-aware.
- Treat review/eval evidence as a plan artifact before claiming readiness.
- Diff-based test selection and real PTY E2E are useful as future verification architecture references.

## Non-Adoption Boundary

- Do not import gstack telemetry, auto-upgrade, browser runtime, heavy preambles, or paid eval harness into `zc`.
- Do not make plan-mode writes part of default `zc` behavior.

## Recommended Phase

- Phase 1: extract wording and workflow discipline into documentation only.
- Phase 3: revisit PTY/E2E harness ideas if `zc team` needs end-to-end runtime tests.
