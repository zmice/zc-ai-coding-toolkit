import assert from 'node:assert/strict';
import test from 'node:test';
import { loadToolkitManifest, recommendToolkitAssets } from '../../packages/toolkit/dist/index.js';
import { createCodexPluginGenerationPlan } from '../../packages/platform-codex/dist/index.js';
import { createQwenGenerationPlan } from '../../packages/platform-qwen/dist/index.js';
import { createOpenCodeGenerationPlan } from '../../packages/platform-opencode/dist/index.js';
import { createQoderCnGenerationPlan } from '../../packages/platform-core/dist/index.js';
import { createClaudeGenerationPlan } from '../../packages/platform-claude/dist/index.js';

const toolkit = await loadToolkitManifest();
const loaded = toolkit.assets.find(asset => asset.id === 'skill:visual-refinement');
assert.ok(loaded, 'Canonical visual-refinement asset exists');
const manifest = { source: 'visual-distribution-test', assets: [{
  id: loaded.id, kind: loaded.meta.kind, name: loaded.meta.name,
  title: loaded.meta.title, summary: loaded.meta.description,
  platforms: loaded.meta.platforms, body: loaded.body, attachments: loaded.attachments,
}] };

for (const [platform, generate] of Object.entries({ codex: createCodexPluginGenerationPlan, qwen: createQwenGenerationPlan, opencode: createOpenCodeGenerationPlan, 'qoder-cn': createQoderCnGenerationPlan })) {
  test(`${platform} distributes the complete skill, scripts and license without changing attachment bytes`, () => {
    const plan = generate(manifest);
    assert.ok(plan.artifacts.some(artifact => artifact.path.endsWith('/SKILL.md') && artifact.content.includes('Visual Refinement')));
    for (const attachment of loaded.attachments) {
      const suffix = '/' + attachment.relativePath.replace(/^assets\//, '');
      const matches = plan.artifacts.filter(artifact => artifact.path.endsWith(suffix));
      assert.equal(matches.length, 1, suffix);
      assert.equal(matches[0].content, attachment.contents, suffix);
    }
    assert.ok(loaded.attachments.some(item => item.relativePath.endsWith('scripts/story.mjs')));
    assert.ok(loaded.attachments.some(item => item.relativePath.endsWith('references/LICENSE-unslop.txt')));
  });
}

test('Claude currently skips skills, so it cannot claim visual-refinement delivery', () => {
  const plan = createClaudeGenerationPlan(manifest);
  assert.ok(!plan.artifacts.some(artifact => artifact.path.includes('visual-refinement')));
});

test('start recommendations expose design, implementation and browser verification without another workflow', () => {
  const recommendation = recommendToolkitAssets(toolkit, 'start');
  assert.equal(recommendation.target.id, 'command:start');
  for (const id of ['skill:visual-refinement', 'skill:frontend-ui-engineering', 'skill:ui-ux-review', 'skill:browser-qa-testing']) {
    assert.ok(recommendation.suggested.some(asset => asset.id === id), id);
  }
  assert.deepEqual(recommendation.route.workflows, [
    'product-analysis', 'full-delivery', 'bugfix', 'review-closure', 'docs-release', 'investigation',
  ]);
});

test('Codex bundles the complete start-to-design lifecycle and its planning reference', () => {
  const ids = new Set([
    'command:start', 'command:ui', 'skill:sdd-tdd-workflow', 'skill:spec-driven-development',
    'skill:planning-and-task-breakdown', 'skill:incremental-implementation',
    'skill:visual-refinement', 'skill:frontend-ui-engineering', 'skill:browser-qa-testing',
  ]);
  const selected = toolkit.assets.filter(asset => ids.has(asset.id));
  assert.equal(selected.length, ids.size);
  const plan = createCodexPluginGenerationPlan({ source: 'ui-lifecycle-test', assets: selected.map(asset => ({
    id: asset.id, kind: asset.meta.kind, name: asset.meta.name,
    title: asset.meta.title, summary: asset.meta.description, platforms: asset.meta.platforms,
    body: asset.body, attachments: asset.attachments,
  })) });
  for (const asset of selected) {
    const artifact = plan.artifacts.find(item => ('/' + item.path).endsWith(`/skills/${asset.meta.name}/SKILL.md`));
    assert.ok(artifact, asset.id);
    assert.ok(artifact.content.includes(asset.body.trim()), asset.id);
  }
  const reference = loaded.attachments.find(item => item.relativePath === 'assets/references/design-plan.md');
  assert.ok(reference);
  assert.ok(plan.artifacts.some(item => item.path.endsWith('/visual-refinement/references/design-plan.md') && item.content === reference.contents));
});
