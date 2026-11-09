import assert from 'node:assert/strict';
import test from 'node:test';
import { loadToolkitManifest } from '../../packages/toolkit/dist/index.js';
import { createCodexPluginGenerationPlan } from '../../packages/platform-codex/dist/index.js';
import { createQwenGenerationPlan } from '../../packages/platform-qwen/dist/index.js';
import { createOpenCodeGenerationPlan } from '../../packages/platform-opencode/dist/index.js';
import { createQoderCnGenerationPlan } from '../../packages/platform-core/dist/index.js';
import { createClaudeGenerationPlan } from '../../packages/platform-claude/dist/index.js';

const loaded = (await loadToolkitManifest()).assets.find(asset => asset.id === 'skill:visual-refinement');
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
