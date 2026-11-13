import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, linkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assessCapture, parseArgs, producerInput, retryPreflightRoot, selectCase, snapshotFiles, workspaceSnapshot } from '../../scripts/lib/design-study.mjs';

test('retry permits only a matching preflight failure before any credentials or model capture', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'design-retry-test-'));
  try {
    const root = join(workspace, '.cache/design-study-case-candidate-example');
    mkdirSync(join(root, 'home'), { recursive: true });
    writeFileSync(join(root, 'home/.skill-eval-home'), 'disposable evaluation home');
    writeFileSync(join(root, 'failure.json'), JSON.stringify({ phase: 'preflight', infrastructureFailure: true }));
    assert.equal(retryPreflightRoot(workspace, root, 'case', 'candidate'), root);
    assert.throws(() => retryPreflightRoot(workspace, root, 'other', 'candidate'), /mismatch/);
    for (const name of ['home/auth.json', 'frozen.json']) {
      writeFileSync(join(root, name), '{}');
      assert.throws(() => retryPreflightRoot(workspace, root, 'case', 'candidate'), /only a failed preflight/);
      rmSync(join(root, name));
    }
    mkdirSync(join(root, 'evidence'));
    assert.throws(() => retryPreflightRoot(workspace, root, 'case', 'candidate'), /only a failed preflight/);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

test('retry rejects linked child paths and hardlinked configuration before any writes', t => {
  const workspace = mkdtempSync(join(tmpdir(), 'design-retry-link-'));
  try {
    const root = join(workspace, '.cache/design-study-case-candidate-example'), outside = join(workspace, 'outside');
    mkdirSync(join(root, 'home'), { recursive: true }); mkdirSync(outside);
    writeFileSync(join(root, 'failure.json'), JSON.stringify({ phase: 'preflight', infrastructureFailure: true }));
    writeFileSync(join(root, 'home/.skill-eval-home'), 'disposable evaluation home');
    writeFileSync(join(outside, 'config.toml'), 'external configuration');
    linkSync(join(outside, 'config.toml'), join(root, 'home/config.toml'));
    assert.throws(() => retryPreflightRoot(workspace, root, 'case', 'candidate'), /linked or special files/);
    rmSync(join(root, 'home/config.toml'));
    try { symlinkSync(outside, join(root, 'project'), process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) {
      if (!process.env.CI && ['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) { t.skip(`junction creation unavailable: ${error.code}; hardlink rejection passed`); return; }
      throw error;
    }
    assert.throws(() => retryPreflightRoot(workspace, root, 'case', 'candidate'), /retry links are forbidden/);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

test('incomplete, mutated and unconfirmed-cleanup captures cannot pass validity gate', () => {
  const integrity = Object.fromEntries(['snapshotUnchanged', 'suiteUnchanged', 'fixtureUnchanged', 'hostConfigUnchanged', 'hostAuthUnchanged'].map(key => [key, true]));
  const capture = { status: 'complete', cleanupUnconfirmed: false };
  assert.equal(assessCapture(capture, integrity).validCapture, true);
  assert.equal(assessCapture(capture, integrity).assessment, 'pending independent scoring');
  for (const key of Object.keys(integrity)) {
    for (const value of [false, undefined]) {
      const result = assessCapture(capture, { ...integrity, [key]: value });
      assert.equal(result.validCapture, false); assert.equal(result.assessment, 'inconclusive');
      assert.ok(result.invalidReasons.includes(key));
    }
  }
  assert.equal(assessCapture({ ...capture, status: 'inconclusive' }, integrity).validCapture, false);
  assert.equal(assessCapture({ ...capture, cleanupUnconfirmed: true }, integrity).validCapture, false);
});

test('suite selection sends input without oracle and only the selected explicit skill', () => {
  const item = selectCase({ cases: [{ id: 'x', input: 'prompt', oracle: { secret: 'private' } }] }, 'x');
  assert.deepEqual(item, { id: 'x', input: 'prompt' });
  assert.equal(JSON.stringify(producerInput(item, 'start', 'C:/installed')).includes('private'), false);
  assert.match(producerInput(item, 'start', 'C:/installed')[1].name, /:start$/);
  assert.match(producerInput(item, 'design', 'C:/installed')[1].name, /:visual-refinement$/);
  assert.throws(() => selectCase({ cases: [] }, 'missing'), /case missing/);
});

test('argument parser requires explicit execution parameters and rejects stray flags', () => {
  const base = ['--suite', 'design', '--case', 'x', '--arm', 'baseline'];
  assert.equal(parseArgs(base)['--execute'], undefined);
  assert.throws(() => parseArgs([...base, '--execute']), /requires/);
  assert.throws(() => parseArgs([...base, '--unknown']), /invalid argument/);
  assert.throws(() => parseArgs([...base, '--case', 'y']), /invalid argument/);
});

test('snapshot path stays within workspace cache and rejects incomplete content', () => {
  const root = mkdtempSync(join(tmpdir(), 'design-study-test-'));
  try {
    const cache = join(root, '.cache'), snapshot = join(cache, 'snapshot');
    mkdirSync(snapshot, { recursive: true });
    assert.equal(workspaceSnapshot(root, snapshot), snapshot);
    assert.throws(() => workspaceSnapshot(root, root), /within workspace/);
    assert.throws(() => workspaceSnapshot(root, 'relative'), /absolute/);
    assert.throws(() => snapshotFiles(snapshot), /missing/);
    for (const name of ['.agents/plugins/marketplace.json', 'plugins/zc-toolkit/skills/start/SKILL.md', 'plugins/zc-toolkit/skills/visual-refinement/SKILL.md']) {
      const path = join(snapshot, name); mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, 'content');
    }
    assert.equal(Object.keys(snapshotFiles(snapshot)).length, 3);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('snapshot inspection rejects a linked directory before reading its contents', t => {
  const root = mkdtempSync(join(tmpdir(), 'design-study-link-'));
  try {
    const snapshot = join(root, 'snapshot'), outside = join(root, 'outside');
    mkdirSync(snapshot); mkdirSync(outside); writeFileSync(join(outside, 'private.txt'), 'do not read');
    try { symlinkSync(outside, join(snapshot, 'linked'), process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) {
      if (!process.env.CI && ['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) { t.skip(`link creation unavailable: ${error.code}`); return; }
      throw error;
    }
    assert.throws(() => snapshotFiles(snapshot), /symlinks are forbidden/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
