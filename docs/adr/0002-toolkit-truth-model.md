# ADR 0002: Make `toolkit` the Single Source of Truth for Content Assets

Status: Accepted

## Context

The repository needs one canonical content source for skills, commands, and agents. If multiple packages can define those assets independently, the workspace will drift and the generated platform outputs will diverge.

The spec requires platform-specific files to become generated artifacts, not hand-maintained source files.

## Decision

`packages/toolkit` will be the only source of truth for prompt/content assets.

Toolkit content will use a structured asset model:

- each asset has metadata
- each asset has a body
- optional auxiliary assets live alongside the body
- downstream consumers read toolkit manifests rather than scanning ad hoc directories

Derived artifacts may be generated from toolkit content, but they must not become alternate sources of truth.

## Consequences

- Content changes happen in one place.
- Platform packages and CLI workflows can rely on normalized manifests instead of directory conventions.
- Validation can focus on schema and manifest correctness.
- Legacy root-level content files can be removed from the source model once migration is complete.

