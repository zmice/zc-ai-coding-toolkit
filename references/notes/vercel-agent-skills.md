# Vercel Agent Skills

Source: `https://github.com/vercel-labs/agent-skills`

## Status

Active official Vercel skill collection. Use it as a domain-specific quality reference and for context-efficient script contracts.

## Latest Remote Evidence

- remote head: `7c180d9044c9ae2b442b567aad4e42a28dd5ed62`
- observed date: 2026-07-29
- evidence: shallow clone review of `AGENTS.md`, React guidance, composition patterns, web-design guidance, and writing guidance

## Extractable Upgrades

- Keep primary skill bodies below the point where variants dominate; link one level deep to references.
- Prefer executable scripts to repeated inline code when deterministic behavior matters.
- Write machine-readable results to stdout and progress / diagnostics to stderr.
- Clean temporary resources explicitly and make failure states actionable.
- Keep framework-specific knowledge in optional domain skills instead of global engineering rules.

## License Boundary

- The repository does not expose one top-level license file in the reviewed snapshot.
- Treat its content as reference-only unless the specific asset's license is confirmed.

## Recommended Phase

- Absorb script I/O and cleanup contracts into authoring quality gates.
- Revisit React-specific assets only when this toolkit adds an explicit framework pack.
