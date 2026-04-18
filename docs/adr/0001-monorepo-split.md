# ADR 0001: Split the Repository into a Monorepo with Explicit Boundaries

Status: Accepted

## Context

The current repository mixes runtime code, prompt/content assets, platform-specific entry files, and upstream management concerns at the root. That makes ownership unclear, increases accidental coupling, and makes generated artifacts easy to confuse with source material.

The rearchitecture spec calls for a multi-package workspace with explicit boundaries between:

- `apps/cli` for runtime and operator commands
- `packages/toolkit` for content truth and asset metadata
- `packages/platform-*` for generated platform outputs and install adapters
- `references/` for upstream governance
- `docs/` for architectural records and migration guidance

## Decision

We will reorganize the repository into a workspace with clear top-level layers and domain-specific package ownership.

The new model is:

- `apps/cli` orchestrates user-facing workflows.
- `packages/toolkit` owns the canonical content model for skills, commands, and agents.
- `packages/platform-*` consume toolkit output and produce platform-specific artifacts.
- `references/` stores upstream governance metadata, notes, and snapshots.
- `docs/adr/` records durable architecture decisions.
- `docs/architecture/` explains the high-level repository map and migration boundaries.

## Consequences

- Ownership becomes explicit, which reduces duplication and makes drift easier to detect.
- Generated outputs can be separated from source-of-truth content.
- Migration work can proceed in parallel without each track redefining the same concepts.
- Documentation must stay in sync with the workspace shape because the old mixed-root layout is no longer the source model.

