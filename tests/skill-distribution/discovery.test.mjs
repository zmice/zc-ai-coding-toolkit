import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditInstalledDiscovery, installedSkillPaths } from '../../scripts/lib/codex-install-discovery.mjs';

const fixture = run => {
  const home = mkdtempSync(join(tmpdir(), 'zc-discovery-'));
  try {
    const root = join(home, 'plugins', 'cache', 'market', 'zc-toolkit', '1.0');
    for (const name of ['start', 'build', 'qa']) {
      const dir = join(root, 'skills', name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'SKILL.md'), `# ${name}\n`);
    }
    return run(home, root);
  } finally { rmSync(home, { recursive: true, force: true }); }
};
const records = root => ['start', 'build', 'qa'].map(name => ({ name: `zc-toolkit:${name}`, path: join(root, 'skills', name, 'SKILL.md'), enabled: true }));

test('entire installed list passes and count follows files', () => fixture((home, root) => {
  const result = auditInstalledDiscovery(installedSkillPaths(home), records(root), ['start', 'qa']);
  assert.equal(result.status, 'pass', JSON.stringify(result));
  assert.equal(result.expectedCount, 3);
}));

test('omission, duplicate, wrong in-plugin path and disabled entries fail', () => fixture((home, root) => {
  const installed = installedSkillPaths(home);
  const base = records(root);
  for (const variant of [base.slice(1), [...base, base[0]],
    base.map((r, i) => i ? r : { ...r, path: join(root, 'skills', 'build', 'SKILL.md') }),
    base.map((r, i) => i ? r : { ...r, enabled: false })]) {
    assert.equal(auditInstalledDiscovery(installed, variant, ['start']).status, 'mismatch');
  }
}));

test('other plugin records do not count toward installation', () => fixture((home, root) => {
  const other = join(home, 'plugins', 'cache', 'other', 'zc-toolkit-extra', '1.0', 'skills', 'start', 'SKILL.md');
  const variant = records(root).slice(1).concat({ name: 'zc-toolkit:start', path: other, enabled: true });
  assert.equal(auditInstalledDiscovery(installedSkillPaths(home), variant).status, 'mismatch');
}));

test('unknown host record inside plugin is extra, and nonboolean enabled is ignored', () => fixture((home, root) => {
  const installed = installedSkillPaths(home);
  const base = records(root);
  const unexpected = { name: 'zc-toolkit:unknown', path: join(root, 'skills', 'unknown', 'SKILL.md'), enabled: true };
  const extra = auditInstalledDiscovery(installed, [...base, unexpected]);
  assert.equal(extra.status, 'mismatch');
  assert.deepEqual(extra.audit.comparisons.intendedDiscovered.extra, ['unknown']);
  assert.equal(extra.scope, 'installed-file-inventory-vs-host-discovery');
  const nonboolean = auditInstalledDiscovery(installed, base.map((r, i) => i ? r : { ...r, enabled: 'true' }));
  assert.equal(nonboolean.status, 'mismatch');
  assert.deepEqual(nonboolean.audit.comparisons.intendedDiscovered.missing, ['start']);
}));
