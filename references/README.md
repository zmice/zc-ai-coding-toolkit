# References Governance Layer

`references/` is the repository's upstream governance layer. It exists to track where source material comes from, how it is reviewed, and what state was captured during each sync.

## Structure

- `references/upstreams.yaml` is the canonical inventory of tracked upstreams.
- `references/notes/` stores human-readable sync notes, review context, and open questions.
- `references/snapshots/` stores frozen captures of upstream state for diffing and audit.

## Operating Rules

- Treat `references/` as governance metadata, not runtime input.
- Record upstream changes here before they are reflected in generated or published outputs.
- Keep notes mutable and snapshots immutable.
- Require manual review for syncs that affect toolkit content, generated platform files, or published packaging artifacts.

