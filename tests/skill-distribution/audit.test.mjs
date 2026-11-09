import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditDistribution } from '../../scripts/skill-distribution-audit.mjs';

const sample = () => ({
  schemaVersion: 1,
  consumer: { name: 'codex-cli', version: '0.167.0' },
  intended: { sourceRevision: 'source-sha256', identities: ['zc:start', 'zc:build'] },
  manifest: { sourceRevision: 'source-sha256', identities: ['zc:start', 'zc:build'] },
  discovered: {
    sourceRevision: 'source-sha256', consumer: { name: 'codex-cli', version: '0.167.0' },
    complete: true, identities: ['zc:start', 'zc:build'], errors: [],
  },
});

test('matching evidence passes with an explicit distribution-only scope', () => {
  const report = auditDistribution(sample());
  assert.equal(report.status, 'pass');
  assert.match(report.scope, /distribution|分发/i);
  assert.equal(report.provesModelLoad, false);
  assert.deepEqual(report.comparisons.intendedManifest, { missing: [], extra: [] });
});

test('equal counts with one omission and one addition fail every affected comparison', () => {
  const input = sample();
  input.manifest.identities = ['zc:start', 'zc:ui'];
  input.discovered.identities = ['zc:start', 'zc:debug'];
  const report = auditDistribution(input);
  assert.equal(report.status, 'mismatch');
  assert.deepEqual(report.comparisons.intendedManifest, { missing: ['zc:build'], extra: ['zc:ui'] });
  assert.deepEqual(report.comparisons.intendedDiscovered, { missing: ['zc:build'], extra: ['zc:debug'] });
  assert.deepEqual(report.comparisons.manifestDiscovered, { missing: ['zc:ui'], extra: ['zc:debug'] });
});

test('duplicates fail without silently collapsing identity lists', () => {
  for (const layer of ['intended', 'manifest', 'discovered']) {
    const input = sample();
    input[layer].identities.push('zc:start');
    const report = auditDistribution(input);
    assert.equal(report.status, 'mismatch', layer);
    assert.ok(report.issues.some((issue) => issue.code === 'duplicate-identity' && issue.layer === layer));
  }
});

test('identity comparisons preserve case and whitespace rather than normalizing', () => {
  const input = sample();
  input.manifest.identities[0] = 'ZC:start';
  input.discovered.identities[0] = 'zc:start ';
  const report = auditDistribution(input);
  assert.equal(report.status, 'mismatch');
  assert.deepEqual(report.comparisons.intendedManifest.missing, ['zc:start']);
  assert.deepEqual(report.comparisons.intendedDiscovered.extra, ['zc:start ']);
});

test('a leaked template identity is reported as an unexpected distributed identity', () => {
  const input = sample();
  input.manifest.identities.push('{{skill-name}}');
  input.discovered.identities.push('{{skill-name}}');
  const report = auditDistribution(input);
  assert.equal(report.status, 'mismatch');
  assert.deepEqual(report.comparisons.intendedManifest.extra, ['{{skill-name}}']);
  assert.deepEqual(report.comparisons.intendedDiscovered.extra, ['{{skill-name}}']);
});

test('missing intended identities is inconclusive rather than a successful empty audit', () => {
  const input = sample();
  input.intended.identities = [];
  assert.equal(auditDistribution(input).status, 'inconclusive');
});

test('bad identities and schema are rejected as inconclusive evidence', () => {
  for (const value of ['', '  ', null, 42]) {
    const input = sample();
    input.manifest.identities[0] = value;
    assert.equal(auditDistribution(input).status, 'inconclusive', String(value));
  }
  const input = sample();
  input.schemaVersion = 2;
  assert.equal(auditDistribution(input).status, 'inconclusive');
});

test('missing versions, revisions or mismatched consumer make evidence inconclusive', () => {
  for (const mutate of [
    (x) => { delete x.consumer.version; },
    (x) => { x.discovered.consumer.version = ''; },
    (x) => { x.discovered.consumer.name = 'desktop'; },
    (x) => { x.manifest.sourceRevision = 'old-source'; },
    (x) => { delete x.discovered.sourceRevision; },
  ]) {
    const input = sample(); mutate(input);
    assert.equal(auditDistribution(input).status, 'inconclusive');
  }
});

test('incomplete, truncated and errored discovery cannot pass even with equal sets', () => {
  for (const mutate of [
    (x) => { x.discovered.complete = false; },
    (x) => { delete x.discovered.complete; },
    (x) => { x.discovered.errors = ['page 2 unavailable']; },
    (x) => { x.discovered.identities = ['zc:start']; x.discovered.complete = false; },
  ]) {
    const input = sample(); mutate(input);
    assert.equal(auditDistribution(input).status, 'inconclusive');
  }
});

test('CLI reads one JSON file and returns 0, 1 or 2 with JSON output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skill-distribution-'));
  const script = fileURLToPath(new URL('../../scripts/skill-distribution-audit.mjs', import.meta.url));
  try {
    for (const [expected, mutate] of [
      [0, () => {}],
      [1, (x) => { x.manifest.identities[0] = 'wrong'; }],
      [2, (x) => { x.discovered.complete = false; }],
    ]) {
      const input = sample(); mutate(input);
      const path = join(dir, 'input.json');
      writeFileSync(path, JSON.stringify(input));
      const run = spawnSync(process.execPath, [script, path], { encoding: 'utf8' });
      assert.equal(run.status, expected, run.stderr);
      assert.equal(JSON.parse(run.stdout).status, ['pass', 'mismatch', 'inconclusive'][expected]);
    }
    const path = join(dir, 'invalid.json');
    writeFileSync(path, '{');
    assert.equal(spawnSync(process.execPath, [script, path], { encoding: 'utf8' }).status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
