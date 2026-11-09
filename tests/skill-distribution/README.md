# Skill distribution identity audit

Run the standalone audit with Node:

```sh
node scripts/skill-distribution-audit.mjs path/to/evidence.json
node --test tests/skill-distribution/audit.test.mjs
```

Example input (`schemaVersion: 1`):

```json
{
  "schemaVersion": 1,
  "consumer": { "name": "codex-cli", "version": "0.167.0" },
  "intended": {
    "sourceRevision": "sha256-of-source-tree-or-git-commit",
    "identities": ["zc:start", "zc:build"]
  },
  "manifest": {
    "sourceRevision": "sha256-of-source-tree-or-git-commit",
    "identities": ["zc:start", "zc:build"]
  },
  "discovered": {
    "sourceRevision": "sha256-of-source-tree-or-git-commit",
    "consumer": { "name": "codex-cli", "version": "0.167.0" },
    "complete": true,
    "identities": ["zc:start", "zc:build"],
    "errors": []
  }
}
```

The collector supplies three independent identity lists: intended source assets, distributed manifest, and the named consumer's observed discovery result. Use the same pinned source revision in all three layers. `sourceRevision` may be a Git commit or a working-tree SHA-256; this audit only checks that all three nonempty strings agree. The collector is responsible for proving the revision and the authenticity of imported evidence. Set `complete: true` only after collecting every discovery page without truncation; include any collection failures in `errors`.

The report compares intended–manifest, intended–discovered, and manifest–discovered. Each comparison's `missing` identities appear on its left side and `extra` identities on its right side. Identities are case sensitive and retain their exact text. Duplicate identities fail even when set membership otherwise matches. A leaked template identity will appear as a difference if it is not in the intended list. Blank or non-string identities are invalid evidence.

Exit codes: `0` means `pass`, `1` means `mismatch`, and `2` means `inconclusive`. Missing versions, empty intent, mismatched source revisions or consumers, invalid input, incomplete discovery, and discovery errors are inconclusive. If incomplete evidence also contains identity differences, the overall result remains inconclusive; inspect the comparisons for the observed differences.

This audits distribution identity only. It does not run skill bodies or installers, validate the collector, prove that a model loaded a skill, or prove task behavior. Consumer-specific discovery and model behavior require separate evidence.
