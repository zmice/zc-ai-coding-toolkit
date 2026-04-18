# Snapshots Semantics

`references/snapshots/` holds immutable captures of upstream state.

Use snapshots for:

- reproducible comparison against a later upstream state
- review evidence for manual sync approval
- audit trails for what was observed before a generated change was accepted

Rules:

- Snapshots are append-only. Do not edit them after they are created.
- Snapshot content should be stable enough to support diffs without depending on live upstream availability.
- Store one snapshot set per upstream, grouped by sync event or capture timestamp.

Recommended file shape:

- `references/snapshots/<upstream-id>/<timestamp>-<label>.md`
- `references/snapshots/<upstream-id>/<timestamp>-<label>.yaml`

