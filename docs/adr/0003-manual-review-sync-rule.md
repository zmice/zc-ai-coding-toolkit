# ADR 0003: Require Manual Review for Upstream Syncs

Status: Accepted

## Context

The repository depends on upstream material, but automated syncs alone are too risky for content that may affect generated platform artifacts, public-facing prompt assets, or workspace documentation.

The governance layer needs a reviewable trail that shows what changed upstream, what was captured locally, and who approved the downstream application.

## Decision

All upstream syncs that affect repository-owned content will use a manual-review gate.

The sync flow is:

1. capture or refresh a snapshot in `references/snapshots/`
2. record human-readable context in `references/notes/`
3. compare the snapshot against the current workspace state
4. require explicit human review before updating generated or published outputs

Automated tools may prepare diffs and refresh snapshots, but they may not silently merge upstream changes into toolkit content, platform artifacts, or published package outputs.

## Consequences

- Upstream changes become auditable and reviewable.
- Generated artifacts cannot drift into a fully automated blind merge path.
- The review process adds a small amount of latency, but it protects content quality and prevents accidental promotion of unverified upstream changes.

