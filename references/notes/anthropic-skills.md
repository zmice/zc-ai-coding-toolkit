# Anthropic Skills

Source: `https://github.com/anthropics/skills`

## Status

Active official Agent Skills reference with a public specification pointer, examples, and a skill-creation evaluation workflow.

## Latest Remote Evidence

- remote head: `b29e7cf65e5cb78a5ac33d582270551bc74a14eb`
- observed date: 2026-07-29
- evidence: shallow clone review of `README.md`, `spec`, `template`, and `skills/skill-creator`

## Extractable Upgrades

- Evaluate skills with representative prompts rather than only linting Markdown structure.
- Compare a new skill with no guidance, and an updated skill with the previous version.
- Separate objective assertions from human judgment; do not force subjective quality into weak numeric checks.
- Preserve timing and token evidence where the execution harness exposes it.
- Iterate from observed failures, and generalize corrections instead of overfitting a few prompts.

## License Boundary

- Many example skills are Apache-2.0, but document skills can be source-available rather than open source.
- Review the license inside each skill directory before copying or adapting any content.
- This workspace absorbs rewritten governance mechanics, not document-skill source.

## Recommended Phase

- Fold the baseline / candidate / review loop into the toolkit skill-authoring workflow.
- Keep full benchmark viewers and provider-specific runners out of the core toolkit until a portable harness exists.

## Frontend Design Review 2026-08-05

- remote head remains `b29e7cf65e5cb78a5ac33d582270551bc74a14eb`
- reviewed asset: `skills/frontend-design`
- license: Apache-2.0 at the skill directory level
- extractable value: ground visual direction in the real subject, treat interface copy as design material, separate design planning from implementation, and critique generic defaults before build and after rendering
- registry update: track `skills/frontend-design` explicitly so future UI guidance changes are visible

## Frontend Design Boundary

- Do not copy its full prose or make one aesthetic direction globally mandatory.
- Reuse project design systems and user-provided visual targets before general anti-template advice.
- Keep visual exploration separate from evidence-based review and implementation verification.
