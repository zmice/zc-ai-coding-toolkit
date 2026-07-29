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
