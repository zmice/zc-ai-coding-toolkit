---
"@zmice/zc": minor
---

Add native Codex plugin command and agent surfaces, keep a receipt-backed `--with-agents` compatibility lifecycle for traditional config roles, and avoid forcing local marketplace generation to mutate user-level agent configuration.

Harden local plugin cleanup so `--include-agents` removes only receipt-owned direct-install agents, preserves unrelated TOML array tables and custom roles, reports the config and receipt paths it inspected, and uses `$zc-toolkit:<skill>` for plugin-qualified skill examples. Context initialization now records only files that actually exist and remains idempotent when `AGENTS.md` contains only the generated managed block.
