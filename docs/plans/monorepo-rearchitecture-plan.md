# Implementation Plan: AI Coding Toolkit Monorepo Rearchitecture

## Overview
This plan migrates the repository from the current mixed root layout into a multi-package monorepo with:
- `apps/cli` as the unified operator/runtime CLI
- `packages/toolkit` as the only source of truth for skills/commands/agents
- `packages/platform-*` as generated platform packaging/install implementations
- `references/` as the upstream-governance layer

The migration must be staged. We first establish the workspace shape and package boundaries, then migrate package content in parallel, then reconnect everything through root-level build/generate/verify flows.

## Architecture Decisions
- Use a **parallelizable monorepo migration**, but only after the root workspace contract is established.
- Keep `toolkit` as the sole content source; no agent may create duplicate prompt assets in `cli` or `platform-*`.
- Let `apps/cli` become the single user-facing operator CLI, while platform implementation stays in `packages/platform-*`.
- Treat legacy root files as migration sources only; they are not the target architecture.
- Use **Cascade execution**:
  - Layer 0: workspace foundation
  - Layer 1: package migrations in parallel
  - Layer 2: integration, cleanup, verification

## Dependency Graph

```text
Workspace root contract
    │
    ├── apps/cli migration
    ├── packages/toolkit migration
    ├── packages/platform-* scaffolding
    └── references/docs restructuring
            │
            ▼
    Cross-package wiring
            │
            ▼
    Root scripts / CI-style verify flow
            │
            ▼
    Legacy layout cleanup
```

## Parallel Execution Model

### Serial foundation first
- Task 1 must land first because it defines package names, paths, and workspace tooling.

### Parallel batch after foundation
- Once the workspace contract exists, these tracks can proceed in parallel with disjoint write scopes:
  - Agent 1: `apps/cli/**`
  - Agent 2: `packages/toolkit/**`
  - Agent 3: `packages/platform-qwen/**`, `packages/platform-codex/**`, `packages/platform-qoder/**`
  - Agent 4: `references/**`, `docs/adr/**`, migration docs

### Serial fan-in
- Root verification scripts, cross-package wiring, and legacy cleanup happen after parallel tasks complete.

## Task List

### Phase 1: Foundation

## Task 1: Establish workspace root and monorepo contract

**Description:** Create the root workspace structure and package-management contract that all later tasks depend on.

**Acceptance criteria:**
- [ ] Root workspace files exist: `package.json`, `pnpm-workspace.yaml`, `turbo.json`
- [ ] Top-level directories exist: `apps/`, `packages/`, `references/`, `docs/`, `scripts/`, `tests/`
- [ ] Package naming and root script conventions match the approved spec
- [ ] No package-specific migration begins before this contract is set

**Verification:**
- [ ] Root install/build commands are defined and parse correctly
- [ ] Workspace discovery includes `apps/*` and `packages/*`
- [ ] Manual check: target directory layout matches the spec

**Dependencies:** None

**Files likely touched:**
- `package.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- `README.md`
- new top-level directories

**Estimated scope:** Medium

### Checkpoint: Foundation
- [ ] Workspace structure is defined
- [ ] Package names and root scripts are locked
- [ ] Ready for parallel migration
- [ ] Human review before proceeding

### Phase 2: Parallel Package Migration

## Task 2: Migrate `zc` into `apps/cli` and redefine it as the operator CLI

**Agent ownership:** Agent 1

**Description:** Move the current `zc` runtime into `apps/cli`, preserve runtime behavior, and prepare the command surface for future `toolkit/platform/upstream` subcommands.

**Acceptance criteria:**
- [ ] Existing `zc` runtime code is relocated into `apps/cli`
- [ ] Current runtime capabilities still work after relocation
- [ ] CLI structure is ready for future command namespaces such as `runtime`, `toolkit`, `platform`, `upstream`
- [ ] No prompt content is duplicated into `apps/cli`

**Verification:**
- [ ] Package tests pass for `apps/cli`
- [ ] Build succeeds for `apps/cli`
- [ ] Manual check: CLI help reflects the new operator role or planned namespace scaffolding

**Dependencies:** Task 1

**Files likely touched:**
- `apps/cli/**`
- root workspace wiring for app package

**Estimated scope:** Medium

## Task 3: Create `packages/toolkit` and migrate content into the structured asset model

**Agent ownership:** Agent 2

**Description:** Build the toolkit package and migrate legacy `skills/`, `commands/`, and `agents/` into the new structured model: `meta.yaml + body.md + assets/`.

**Acceptance criteria:**
- [ ] `packages/toolkit` exists with content/schema/loaders/manifests layout
- [ ] Legacy prompt assets are migrated into structured content units
- [ ] Common schema and validation exist for asset metadata
- [ ] Toolkit can emit a normalized manifest consumed by other packages

**Verification:**
- [ ] Toolkit schema validation passes
- [ ] Toolkit tests pass
- [ ] Manual check: at least representative skill/command/agent assets migrated correctly

**Dependencies:** Task 1

**Files likely touched:**
- `packages/toolkit/**`
- migrated copies of legacy content

**Estimated scope:** Large

## Task 4: Create platform packages and generation/install scaffolding

**Agent ownership:** Agent 3

**Description:** Create `platform-qwen`, `platform-codex`, and `platform-qoder` packages that consume toolkit manifests and generate platform-specific artifacts.

**Acceptance criteria:**
- [ ] `packages/platform-qwen`, `packages/platform-codex`, and `packages/platform-qoder` exist
- [ ] Each package has generator/install scaffolding and templates
- [ ] Platform packages depend on toolkit outputs instead of hand-maintained root files
- [ ] Platform artifacts are treated as generated outputs, not source files

**Verification:**
- [ ] Platform package tests pass
- [ ] Build succeeds for platform packages
- [ ] Manual check: generation pipeline shape matches spec (even if templates are initially minimal)

**Dependencies:** Task 1

**Files likely touched:**
- `packages/platform-qwen/**`
- `packages/platform-codex/**`
- `packages/platform-qoder/**`

**Estimated scope:** Medium

## Task 5: Build the upstream governance layer and architecture records

**Agent ownership:** Agent 4

**Description:** Formalize upstream management into `references/` and document the architecture via ADRs/migration notes.

**Acceptance criteria:**
- [ ] `references/upstreams.yaml` exists
- [ ] `references/notes/` and `references/snapshots/` exist with clear semantics
- [ ] ADR(s) record the monorepo split, toolkit truth model, and manual-review sync rule
- [ ] Migration docs explain old-to-new mapping

**Verification:**
- [ ] Docs lint/check passes if configured
- [ ] Manual check: architecture decisions are discoverable and non-duplicative

**Dependencies:** Task 1

**Files likely touched:**
- `references/**`
- `docs/adr/**`
- `docs/architecture/**`

**Estimated scope:** Medium

### Checkpoint: Parallel Batch Complete
- [ ] `apps/cli` migrated
- [ ] `packages/toolkit` structured content model exists
- [ ] `packages/platform-*` scaffolding exists
- [ ] `references/` and ADRs exist
- [ ] No file ownership conflicts across agent tracks
- [ ] Human review before integration

### Phase 3: Fan-In, Wiring, and Cleanup

## Task 6: Wire cross-package dependencies and generation flows

**Description:** Connect `apps/cli`, `packages/toolkit`, and `packages/platform-*` into a working workspace dependency graph.

**Acceptance criteria:**
- [ ] `apps/cli` consumes toolkit APIs/manifests instead of legacy root assets
- [ ] `platform-*` packages consume toolkit outputs and generate platform artifacts
- [ ] Root `generate` and `verify` flows execute package tasks in dependency order
- [ ] Cross-package integration tests exist or are updated

**Verification:**
- [ ] `pnpm build` passes
- [ ] `pnpm generate` passes
- [ ] `pnpm verify` passes

**Dependencies:** Tasks 2, 3, 4, 5

**Files likely touched:**
- root workspace config
- `apps/cli/**`
- `packages/toolkit/**`
- `packages/platform-*/**`
- `tests/**`

**Estimated scope:** Medium

## Task 7: Remove legacy root-source model and repoint docs

**Description:** Retire the legacy root layout as a source model and update repository documentation to the monorepo structure.

**Acceptance criteria:**
- [ ] Root hand-maintained source files for old platform entrypoints are removed or deprecated out of the source model
- [ ] Legacy `skills/`, `commands/`, `agents/` no longer act as the authoritative source
- [ ] Root README reflects the new monorepo and package boundaries
- [ ] Legacy-to-new mapping is documented for maintainers

**Verification:**
- [ ] Manual check: no ambiguity remains about where source-of-truth content lives
- [ ] `pnpm verify` still passes after cleanup

**Dependencies:** Task 6

**Files likely touched:**
- legacy root content directories/files
- `README.md`
- migration docs

**Estimated scope:** Medium

## Task 8: Final workspace verification and release-readiness

**Description:** Run full workspace verification and confirm that the new independent-package publishing model is operational.

**Acceptance criteria:**
- [ ] Workspace lint/test/build/generate/verify commands all pass
- [ ] Changesets/release workflow is configured for independent package publishing
- [ ] Generated platform artifacts are reproducible from source
- [ ] Repository is ready for `/quality-review`

**Verification:**
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm generate`
- [ ] `pnpm verify`
- [ ] `pnpm changeset status`

**Dependencies:** Task 7

**Files likely touched:**
- root release/config files
- any final verification fixes

**Estimated scope:** Small

### Checkpoint: Complete
- [ ] Spec success criteria are satisfied
- [ ] Workspace verification is green
- [ ] Ready for review and then staged rollout / publishing

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Workspace contract changes mid-migration | High | Lock Task 1 first and gate before parallel work |
| Toolkit migration becomes too large for one pass | High | Migrate representative assets first, then complete bulk migration with validation |
| CLI absorbs platform logic during integration | High | Enforce package API boundaries and review dependency directions |
| Parallel agents touch overlapping root files | Medium | Restrict agent ownership; integrate root wiring only in fan-in phase |
| Legacy cleanup breaks generation or docs | Medium | Delay Task 7 until all package flows are green |
| Upstream governance becomes stale after move | Medium | Define `references/upstreams.yaml` and ADRs in the same migration batch, not later |

## Open Questions
- None blocking. The next gate is approval to begin implementation, after which multi-agent execution can start using the ownership boundaries above.
