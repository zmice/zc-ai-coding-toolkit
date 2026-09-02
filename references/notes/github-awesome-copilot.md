# Awesome GitHub Copilot

Source: `https://github.com/github/awesome-copilot`

## Status

Active GitHub-maintained community collection. Use it primarily as a governance and validation reference rather than a prompt catalog to mirror.

## Latest Remote Evidence

- remote head: `8ae5a99109124c22288eee0254da61741e44d12a`
- observed date: 2026-07-29
- evidence: sparse checkout of `README.md`, `AGENTS.md`, schemas, skill-authoring instructions, and validation scripts

## Extractable Upgrades

- Treat discovery metadata as a contract: concise WHAT, WHEN, and high-signal keywords.
- Distinguish scripts, references, static assets, and editable templates.
- Put non-obvious gotchas ahead of general explanations.
- Validate names, descriptions, folder identity, links, and bounded asset sizes with machine checks.
- Offer a machine-readable catalog surface without injecting the whole catalog into agent context.

## Non-Adoption Boundary

- Community-contributed assets require individual security, provenance, and license review.
- Do not import hundreds of skills, agents, hooks, or workflows wholesale.
- Do not assume GitHub Copilot directory conventions are native to Codex.

## Recommended Phase

- Use the repository's validation discipline to strengthen toolkit authoring guidance and future lint rules.
- Keep cross-platform directory mapping in platform adapters.

## Latest Remote Evidence 2026-08-05

- remote head: `dab758a392cd6b06e806c1aa0444e2bc463b32f9`
- previous reviewed head: `8ae5a99109124c22288eee0254da61741e44d12a`
- notable change: the external marketplace added `GoogleChrome/modern-web-guidance` with Apache-2.0 provenance and a pinned release reference
- validation changes: external plugin metadata validation now covers semver, SPDX identifiers, author fields, and unknown fields more strictly
- adjacent examples: new canvas extensions and accessibility / Playwright learning-hub material provide evaluation scenarios, not prompt content to copy

## Current Decision 2026-08-05

- Track `.github/plugin/marketplace.json`, `plugins/external.json`, and `eng/lib` as governance inputs.
- Register `modern-web-guidance` independently instead of importing it through the GitHub marketplace catalog.
- Continue rejecting wholesale marketplace content absorption.

## Review Update 2026-09-01

- remote head: `5eaae7e2cde26b5cf86682fb31e758da0288aef7`
- registered changes mainly describe Agent Plugins v1 packaging, marketplace generation and pinned external plugin refs
- the plugin v1 layout is a separate platform-compatibility topic; this review does not change `packages/platform-*`
- unregistered `anti-ui-slop` repeats local project-design-system, minimal-reference and real-render finish gates; the paid MCP dependency and community catalog are not adopted
- keep immutable external refs as a governance principle, but do not widen `source_paths` to mirror the community skill catalog
