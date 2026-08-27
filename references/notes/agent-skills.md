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
- Exact or substantial copied material must retain the upstream MIT notice in generated skill attachments; repository-level attribution is recorded in `THIRD_PARTY_NOTICES.md`.

## Snapshot Baseline

- baseline: `references/snapshots/agent-skills/2026-04-14-baseline.json`
- current governance status: `active`

## Latest Reviewed Upstream

- remote head: `f17c6e88c904dc747381c374312c2d58e10647ae`
- observed date: 2026-05-18
- notable upstream change: upstream added `scripts/validate-skills.js` and a plugin-install CI workflow that validates skill `SKILL.md` presence, frontmatter shape, description budget, required sections, and dead cross-skill references.

## Latest Remote Evidence

- remote head: `7829ffd90d973b6325f5f12f1b1226dcace74443`
- observed date: 2026-07-28
- evidence: `references/snapshots/agent-skills/2026-07-28T08-27-50-843Z-2026-07-28-review.json`
- comparison baseline: `d187883b7d761265309cdcc0f202cc76b4b3fb06`
- finding: registered content and adjacent governance assets changed across 101 files, including 24 deterministic/behavioral eval cases, 45 fixtures, a three-tier eval runner, Definition of Done guidance, validator hardening, dependency upgrade discipline, observability guidance, and ecosystem-neutral command examples.

## 2026-07-28 Review Outcome

Already absorbed in this review:

- Restored the upstream accessibility, security, and performance checklists as per-skill supporting assets instead of always-loaded body content.
- Added the upstream MIT notice beside every copied checklist so Codex, Qwen, OpenCode, and vendored CLI outputs carry attribution with the material.
- Preserved progressive disclosure by emitting those assets beside each generated `SKILL.md`.
- Added a manifest lint error for missing local supporting-file references so broken `references/*.md` links block release.
- Propagated toolkit attachments through Codex, Qwen, and OpenCode skill-directory generation.
- Absorbed the latest ecosystem-aware dependency installation boundary and install-script gate through the restored security checklist.
- Added a localized `observability-and-instrumentation` skill and progressive-disclosure checklist covering on-call questions, structured logs, RED/USE metrics, trace continuity, bounded cardinality, symptom alerts, and induced-failure verification.
- Hardened `toolkit lint` so headings and asset/support-file references inside fenced examples no longer satisfy governance checks or create false dead-reference findings.

High-value follow-up candidates:

- Adopt the three-tier eval model: structural lint in CI, deterministic trigger/routing checks in CI, and fixture-backed behavioral evals on demand.
- Add deterministic trigger/routing checks as the next layer above structural lint, including positive prompts, negative ownership, collision thresholds, and a ratcheted rank-1 floor.
- Continue `toolkit lint` hardening for negated activation phrases; keep policy logic testable and separate from filesystem traversal.
- Extend code review dependency discipline so upgrades require changelog review, one-package-at-a-time isolation, lockfile diff review, and before/after behavior tests.

Already covered locally:

- Definition of Done is already separated from per-task acceptance criteria in `planning-and-task-breakdown`.
- Structural remedies are already present in `code-review-and-quality`, including explicit fixes for repeated branching, feature leakage into shared modules, and complexity relocation.
- Doubt handling is already covered by engineering principles plus bounded reviewer/agent loops; a separate recursive orchestration skill is unnecessary.
- Interview-style clarification remains covered by `idea-refine` and `product-analysis`.

## Extractable Upgrades

- Adopt the skill anatomy checklist as a governance heuristic: trigger clarity, workflow steps, anti-rationalization, red flags, verification evidence.
- Reuse the OpenCode idea of agent-driven skill routing through `AGENTS.md` rather than forcing slash-command parity on platforms that do not natively support it.
- Keep reference checklists as optional supporting material, not always-loaded context.
- Strengthen `command:start` routing language: descriptions and trigger conditions must say both what a workflow does and when to activate it, because platforms increasingly auto-discover skills from short metadata.
- Prefer on-demand skill loading over persistent always-on context; reserve persistent files such as `AGENTS.md` / `GEMINI.md` for project conventions and canonical routing.
- Extend the same discovery/context rule into `using-agent-skills` and `context-engineering`, not only the `start` command.
- Fold doubt-driven behavior into existing engineering principles: route-changing doubts should become explicit questions or assumptions before implementation.
- Keep local skill discovery names accurate; upstream references to a browser testing skill should map to this repo's `browser-qa-testing`.
- Treat interview-style clarification as already covered by `idea-refine` / `product-analysis`; no separate interview skill is needed yet.
- Absorb validator intent into `toolkit lint`: check description length, empty body, skill activation sections, and explicit skill / command / agent references without copying upstream's file layout.
- Code review content now has stronger structural-remedy language: repeated conditionals, feature logic leaking into shared modules, refactors that relocate rather than remove complexity, and large-file growth should become review signals.
- Definition-of-Done separation is useful: per-task acceptance criteria should sit under a project-wide done bar instead of replacing it.

## Non-Adoption Boundary

- Do not mirror upstream skill names or prose directly into `packages/toolkit`.
- Do not add platform setup instructions that imply unsupported native plugin behavior.
- Do not add Gemini as a supported `zc platform` target until the CLI install model, generated layout, and tests are designed in `packages/platform-*`.
- Do not import the upstream GitHub workflow directly; this repo should keep validation centered on manifest-aware `toolkit lint` and package tests.

## Recommended Phase

- Phase 1: complete the supporting-asset distribution and dead local-reference gate.
- Phase 2: design a platform-neutral trigger/routing eval schema and CI-safe deterministic runner before importing behavioral execution machinery.
- Phase 3: add fixture-backed behavioral evals for the highest-risk workflow skills after the deterministic routing layer is stable.
- Phase 4: evaluate a dedicated Gemini platform adapter only if there is user demand.

## Latest Remote Evidence 2026-08-05

- remote head: `bdf76c7c6b7b3b3e01bb15c9fdc42ac5351855c1`
- previous reviewed head: `7829ffd90d973b6325f5f12f1b1226dcace74443`
- finding: registered `skills` and `commands` did not change; adjacent plugin manifest, installation documentation, workflow, and command-validator regression coverage changed
- registry update: track `README.md`, `.claude-plugin/plugin.json`, `docs/getting-started.md`, the plugin-install workflow, and command-validator implementation/tests

## Current Decision 2026-08-05

- No frontend skill content sync is required for this head.
- Absorb the platform-manifest compatibility lesson and validator regression discipline through repository governance and tests.
- Keep the per-skill reference limitation visible because generated attachments must travel with every platform skill directory.

## Monitoring Coverage 2026-08-27

- remote head: `7cb7a20bb38b199728d456999c725a0488490ab6`
- expanded `source_paths` to include `evals`, `references`, and the complete `scripts` governance surface
- reason: deterministic routing fixtures, reference-link checks, artifact-path checks, and version validation must be visible to upstream review even when they are not copied into this toolkit
- non-adoption: upstream runner code and its fixed artifact paths remain reference-only; local routing evaluation requires a separate ranking contract because `recommendToolkitAssets` currently resolves exact identities rather than natural-language prompts
