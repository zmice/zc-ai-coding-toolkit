import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { executionGate, parseArgs, selectCase, snapshotFiles, workspaceSnapshot } from '../../scripts/lib/design-study.mjs';

test('suite selection sends input without oracle and only the selected explicit skill', () => {
  const item = selectCase({ cases: [{ id: 'x', input: 'prompt', oracle: { secret: 'private' } }] }, 'x');
  assert.deepEqual(item, { id: 'x', input: 'prompt' });
  assert.throws(() => selectCase({ cases: [] }, 'missing'), /case missing/);
});

test('argument parser requires explicit execution parameters and rejects stray flags', () => {
  const base = ['--suite', 'design', '--case', 'x', '--arm', 'baseline'];
  assert.equal(parseArgs(base)['--execute'], undefined);
  assert.throws(() => parseArgs([...base, '--execute']), /requires/);
  assert.throws(() => parseArgs([...base, '--unknown']), /invalid argument/);
  assert.throws(() => parseArgs([...base, '--case', 'y']), /invalid argument/);
  assert.throws(() => parseArgs([...base, '--retry-preflight', 'x']), /disabled/);
  assert.equal(executionGate({ '--execute': true }).status, 'blocked');
  assert.equal(executionGate({ '--execute': true }).reasonCode, 'trusted-runtime-validation-required');
  assert.equal(executionGate({ '--prepare-only': true }).status, 'needs-environment');
});

test('execute blocks before binary startup and prepare-only creates no auth or sandbox receipt', () => {
  const workspace = resolve('.'), cache = join(workspace, '.cache');
  mkdirSync(cache, { recursive: true });
  const roots = [mkdtempSync(join(cache, 'gate-baseline-')), mkdtempSync(join(cache, 'gate-candidate-'))];
  try {
    for (const root of roots) {
      for (const name of ['start', 'visual-refinement']) {
        const dir = join(root, 'plugins/zc-toolkit/skills', name);
        mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, 'SKILL.md'), '# test');
      }
      const market = join(root, '.agents/plugins'); mkdirSync(market, { recursive: true });
      writeFileSync(join(market, 'marketplace.json'), JSON.stringify({ name: 'test', plugins: [{ name: 'zc-toolkit', source: { source: 'local', path: 'plugins/zc-toolkit' } }] }));
    }
    const common = ['--suite', 'design', '--case', 'new-operations-page', '--arm', 'candidate', '--baseline', roots[0], '--candidate', roots[1], '--binary', join(cache, 'does-not-exist.exe'), '--model', 'test', '--effort', 'low'];
    const script = join(workspace, 'scripts/skill-evals-design-study.mjs');
    const before = readdirSync(cache).filter(name => name.startsWith('design-study-new-operations-page-candidate-'));
    const blocked = spawnSync(process.execPath, [script, ...common, '--execute'], { cwd: workspace, encoding: 'utf8' });
    assert.equal(blocked.status, 2, blocked.stderr);
    assert.equal(JSON.parse(blocked.stdout).status, 'blocked');
    assert.deepEqual(readdirSync(cache).filter(name => name.startsWith('design-study-new-operations-page-candidate-')), before);
    const prepared = spawnSync(process.execPath, [script, ...common, '--prepare-only'], { cwd: workspace, encoding: 'utf8' });
    assert.equal(prepared.status, 2, prepared.stderr);
    const result = JSON.parse(prepared.stdout);
    assert.equal(result.status, 'needs-environment');
    assert.equal(result.externalProcessesStarted, 0);
    assert.equal(result.credentialsCopied, false);
    assert.equal(result.sandboxInitialized, false);
    assert.equal(existsSync(join(result.root, 'home/auth.json')), false);
    assert.equal(existsSync(join(result.root, 'home/.sandbox')), false);
    assert.equal(existsSync(join(result.root, 'evidence')), false);
    rmSync(result.root, { recursive: true, force: true });
  } finally { for (const root of roots) rmSync(root, { recursive: true, force: true }); }
});

test('review execution uses the same no-interaction gate without creating an environment', () => {
  const workspace = resolve('.'), cache = join(workspace, '.cache');
  mkdirSync(cache, { recursive: true });
  const suite = JSON.parse(readFileSync('tests/skill-evals/review-coverage-cases.json', 'utf8'));
  const before = readdirSync(cache).filter(name => name.startsWith('review-study-'));
  const command = [resolve('scripts/skill-evals-review-study.mjs'), suite.cases[0].id, 'candidate', '1', join(cache, 'nonexistent.exe')];
  const planned = spawnSync(process.execPath, [...command, '--plan'], { cwd: workspace, encoding: 'utf8' });
  assert.equal(planned.status, 0, planned.stderr);
  assert.equal(JSON.parse(planned.stdout).status, 'plan-only');
  const blocked = spawnSync(process.execPath, [...command, '--execute'], { cwd: workspace, encoding: 'utf8' });
  assert.equal(blocked.status, 2, blocked.stderr);
  assert.equal(JSON.parse(blocked.stdout).status, 'blocked');
  assert.deepEqual(readdirSync(cache).filter(name => name.startsWith('review-study-')), before);
  const withoutBinary = spawnSync(process.execPath, [command[0], command[1], 'candidate', '1', '--plan'], { cwd: workspace, encoding: 'utf8' });
  assert.equal(withoutBinary.status, 0, withoutBinary.stderr);
  assert.equal(JSON.parse(withoutBinary.stdout).status, 'plan-only');
});

test('historical visual study has only plan and blocked modes', () => {
  const script = resolve('scripts/skill-evals-visual-study.mjs');
  const command = [script, 'visual-major-redesign', 'candidate'];
  const planned = spawnSync(process.execPath, [...command, '--plan'], { cwd: resolve('.'), encoding: 'utf8' });
  assert.equal(planned.status, 0, planned.stderr);
  assert.equal(JSON.parse(planned.stdout).modelCalls, 0);
  const blocked = spawnSync(process.execPath, [...command, '--execute'], { cwd: resolve('.'), encoding: 'utf8' });
  assert.equal(blocked.status, 2, blocked.stderr);
  assert.equal(JSON.parse(blocked.stdout).status, 'blocked');
  assert.equal(JSON.parse(blocked.stdout).credentialsCopied, false);
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
