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

- remote head: `026751ea2012ec7cbedc149ba615929a20026501`
- observed date: 2026-05-18
- notable upstream change: upstream advanced through v1.40.x with plan-mode `EXIT PLAN MODE` gating, Implementation Tasks aggregation, stronger stop-gate tests, browser sanitization, and additional gbrain hardening.

## Extractable Upgrades

- Keep plan-mode questions few, outcome-framed, and preference-aware.
- Treat review/eval evidence as a plan artifact before claiming readiness.
- Diff-based test selection and real PTY E2E are useful as future verification architecture references.
- Add `command:start` tie-breakers for when to ask versus when to proceed: ask only for high-stakes ambiguity, otherwise choose the conservative workflow and state the assumption.
- Add a privacy / persistence stop-gate rule: anything that would write cross-session memory, sync across machines, or mutate project routing files must be explicit and opt-in.
- Extend plan-review and task-planning content so review findings become plan artifacts with evidence, risks, and verification gates.
- Adopt the useful part of document-generation work: choose the document type first, then write; do not mix tutorial, how-to, reference, explanation, and ADR purposes in one artifact.
- Keep gbrain as a reference for memory architecture tradeoffs only; cross-machine memory sync remains opt-in and out of the default toolkit runtime.
- Upgrade `planning-and-task-breakdown`, `multi-perspective-review`, and `plan-review` wording so route-changing findings trigger explicit stop gates and review findings become P1/P2/P3 Implementation Tasks.

## Non-Adoption Boundary

- Do not import gstack telemetry, auto-upgrade, browser runtime, heavy preambles, or paid eval harness into `zc`.
- Do not make plan-mode writes part of default `zc` behavior.
- Do not adopt gbrain-style cross-machine memory sync or question-preference storage as a default runtime capability.
- Do not import the document-generation skill wholesale; this repo already has `documentation-and-adrs` and `release-documentation-sync`.
- Do not copy gstack's exact plan-mode phrasing; this repo keeps the behavior in toolkit content as `stop gate` and `Implementation Tasks` artifacts.

## Recommended Phase

- Phase 1: extract wording and workflow discipline into documentation only, including plan-mode / stop-gate report shape.
- Phase 3: revisit PTY/E2E harness ideas if `zc team` needs end-to-end runtime tests.
