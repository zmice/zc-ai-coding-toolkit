import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadSuite, validateSuite, judge, summarize } from '../../scripts/skill-evals.mjs';

const { fixtures, oracles } = loadSuite();
const fixture = fixtures.find((item) => item.id === 'review-en-explicit');
const base = () => ({
  fixtureId: fixture.id, fixtureHash: fixture.hash, sourceHash: 'a'.repeat(64), contentHash: 'b'.repeat(64),
  host: { surface: 'codex-cli', version: 'test' }, model: 'test-model', effort: 'medium',
  permissions: 'workspace-write', effectiveSkills: ['code-review-and-quality'],
  arm: 'baseline', repeat: 1,
  status: 'complete', eventStream: 'host', elapsedMs: 1000, turns: 2, usage: null,
  events: [{ type: 'skill_loaded', skill: 'code-review-and-quality', provenance: 'host' },
    { type: 'evidence', key: 'authorization-bypass-finding', provenance: 'host' }], fileDiff: [],
});

test('16 frozen cases cover four domains and all boundary dimensions', () => {
  assert.equal(validateSuite({ fixtures, oracles }).status, 'pass');
  assert.equal(fixtures.length, 16);
  for (const domain of ['review', 'debug', 'build', 'ui']) {
    const cases = fixtures.filter((item) => item.domain === domain);
    assert.deepEqual(cases.map((item) => item.kind).sort(), ['boundary', 'negative', 'positive', 'positive']);
  }
  assert.deepEqual(new Set(fixtures.flatMap((item) => item.dimensions)), new Set([
    'zh', 'en', 'explicit', 'implicit', 'no-op', 'missing-dependency', 'compaction-recovery',
  ]));
  for (const item of fixtures) assert.ok(oracles[item.id]);
  const broken = fixtures.map((item) => ({ ...item }));
  broken[0].allowedFiles = ['../outside'];
  assert.equal(validateSuite({ fixtures: broken, oracles }).status, 'fail');
});

test('host evidence passes; wrong routing, unsafe write and absent evidence fail', () => {
  assert.equal(judge(fixture, oracles[fixture.id], base()).outcome, 'pass');
  const wrong = base(); wrong.events[0].skill = 'ui-ux-review';
  assert.equal(judge(fixture, oracles[fixture.id], wrong).outcome, 'fail');
  const write = base(); write.fileDiff = [{ path: 'src/unsafe.ts', status: 'modified' }];
  assert.equal(judge(fixture, oracles[fixture.id], write).outcome, 'fail');
  const missing = base(); missing.events.pop();
  assert.equal(judge(fixture, oracles[fixture.id], missing).outcome, 'fail');
});

test('legitimate follow-up review and read-only UI inspection are allowed', () => {
  const buildFixture = fixtures.find((item) => item.id === 'build-en-explicit');
  const buildTrace = { ...base(), fixtureId: buildFixture.id, fixtureHash: buildFixture.hash,
    effectiveSkills: ['build', 'code-review-and-quality'],
    events: [{ type: 'skill_loaded', skill: 'build', provenance: 'host' },
      { type: 'skill_loaded', skill: 'code-review-and-quality', provenance: 'host' },
      { type: 'evidence', key: 'implementation-diff', provenance: 'host' },
      { type: 'evidence', key: 'behavior-verification', provenance: 'host' }] };
  assert.equal(judge(buildFixture, oracles[buildFixture.id], buildTrace).outcome, 'pass');
  const uiFixture = fixtures.find((item) => item.id === 'ui-en-negative');
  const uiTrace = { ...base(), fixtureId: uiFixture.id, fixtureHash: uiFixture.hash,
    effectiveSkills: ['ui'], events: [{ type: 'skill_loaded', skill: 'ui', provenance: 'host' },
      { type: 'evidence', key: 'no-change-reason', provenance: 'host' }] };
  assert.equal(judge(uiFixture, oracles[uiFixture.id], uiTrace).outcome, 'pass');
});

test('three adjacent negative cases reject the prohibited workflow trigger', () => {
  for (const [id, forbidden, key] of [
    ['review-en-negative', 'code-review-and-quality', 'plain-summary'],
    ['debug-en-negative', 'debug', 'short-explanation'],
    ['build-en-negative', 'build', 'options-only'],
  ]) {
    const item = fixtures.find((fixture) => fixture.id === id);
    const trace = { ...base(), fixtureId: id, fixtureHash: item.hash, effectiveSkills: [forbidden],
      events: [{ type: 'skill_loaded', skill: forbidden, provenance: 'host' },
        { type: 'evidence', key, provenance: 'host' }] };
    assert.equal(judge(item, oracles[id], trace).selection.status, 'fail');
  }
});

test('auth failure, missing host events and mismatched fixture are inconclusive', () => {
  const auth = base(); auth.status = 'auth-error';
  assert.equal(judge(fixture, oracles[fixture.id], auth).outcome, 'inconclusive');
  const noEvents = base(); noEvents.eventStream = 'none';
  assert.equal(judge(fixture, oracles[fixture.id], noEvents).outcome, 'inconclusive');
  const stale = base(); stale.fixtureHash = '0'.repeat(64);
  assert.equal(judge(fixture, oracles[fixture.id], stale).outcome, 'inconclusive');
  const unavailable = base(); unavailable.effectiveSkills = [];
  assert.equal(judge(fixture, oracles[fixture.id], unavailable).outcome, 'inconclusive');
  for (const field of ['arm', 'repeat', 'model']) {
    const invalid = base(); delete invalid[field];
    assert.equal(judge(fixture, oracles[fixture.id], invalid).outcome, 'inconclusive');
  }
  for (const field of ['elapsedMs', 'turns']) {
    const invalid = base(); invalid[field] = -1;
    assert.notEqual(judge(fixture, oracles[fixture.id], invalid).outcome, 'pass');
  }
  for (const field of ['events', 'fileDiff']) {
    const invalid = base(); invalid[field] = [null];
    assert.equal(judge(fixture, oracles[fixture.id], invalid).outcome, 'inconclusive');
  }
});

test('summary requires three comparable repeats per arm', () => {
  const result = judge(fixture, oracles[fixture.id], base());
  assert.equal(summarize([result]).status, 'inconclusive');
  const baseline = [1, 2, 3].map((repeat) => ({ ...result, arm: 'baseline', repeat }));
  const candidate = [1, 2, 3].map((repeat) => ({ ...result, arm: 'candidate', repeat, contentHash: 'c'.repeat(64) }));
  candidate[1].events = candidate[1].events.filter((event) => event.type !== 'evidence');
  const comparison = summarize([...baseline, ...candidate]);
  assert.equal(comparison.status, 'fail');
  assert.equal(comparison.comparisons[0].status, 'comparable');
  assert.equal(comparison.comparisons[0].regression, true);
});

test('summary does not hide a second configuration or an ambiguous content group', () => {
  const pass = judge(fixture, oracles[fixture.id], base());
  const runs = (arm, contentHash, permissions, outcome = 'pass') => [1, 2, 3].map((repeat) => ({
    ...pass, arm, repeat, contentHash, permissions, outcome,
    events: outcome === 'fail' ? pass.events.filter((event) => event.type !== 'evidence') : pass.events,
    behavior: { status: outcome, reasons: outcome === 'fail' ? ['missing evidence'] : [] },
  }));
  const first = [...runs('baseline', 'b'.repeat(64), { mode: 'workspace-write', scope: 'one' }),
    ...runs('candidate', 'c'.repeat(64), { mode: 'workspace-write', scope: 'one' })];
  const second = [...runs('baseline', 'd'.repeat(64), { mode: 'workspace-write', scope: 'two' }),
    ...runs('candidate', 'e'.repeat(64), { mode: 'workspace-write', scope: 'two' }, 'fail')];
  const summary = summarize([...first, ...second]);
  assert.equal(summary.comparisons.length, 2);
  assert.equal(summary.status, 'fail');
  assert.equal(summary.comparisons.filter((item) => item.regression).length, 1);
  const ambiguous = summarize([...first, ...runs('candidate', 'f'.repeat(64), { mode: 'workspace-write', scope: 'one' })]);
  assert.equal(ambiguous.status, 'inconclusive');
  assert.equal(ambiguous.comparisons[0].status, 'inconclusive');
  const invalid = summarize([...first, { ...first[0], repeat: 4, outcome: 'unknown' }]);
  assert.equal(invalid.status, 'inconclusive');
  assert.equal(summarize([{ ...first[0], outcome: 'pass', selection: { status: 'fail', reasons: ['wrong route'] } }, ...first.slice(1)]).status, 'inconclusive');
  assert.equal(summarize(first).status, 'pass');
  const catalogChange = first.map((item) => item.arm === 'candidate' ? { ...item, effectiveSkills: ['code-review-and-quality', 'other-skill'] } : item);
  assert.equal(summarize(catalogChange).status, 'inconclusive');
  assert.equal(summarize(first.map((item) => ({ ...item, oracleHash: '0'.repeat(64) }))).status, 'inconclusive');
  assert.equal(summarize(first.map((item) => item.arm === 'candidate' ? { ...item, events: [] } : item)).status, 'fail');
});

test('summary CLI returns nonzero for fail and inconclusive', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skill-evals-'));
  const script = resolve('scripts/skill-evals.mjs');
  const result = judge(fixture, oracles[fixture.id], base());
  const runs = (arm, outcome = 'pass') => [1, 2, 3].map((repeat) => ({
    ...result, arm, repeat, contentHash: arm === 'baseline' ? 'b'.repeat(64) : 'c'.repeat(64), outcome,
    events: outcome === 'fail' ? result.events.filter((event) => event.type !== 'evidence') : result.events,
    behavior: { status: outcome, reasons: outcome === 'fail' ? ['missing evidence'] : [] },
  }));
  try {
    const file = join(dir, 'results.json');
    writeFileSync(file, JSON.stringify([...runs('baseline'), ...runs('candidate', 'fail')]));
    assert.equal(spawnSync(process.execPath, [script, 'summary', file]).status, 1);
    writeFileSync(file, JSON.stringify(runs('baseline')));
    assert.equal(spawnSync(process.execPath, [script, 'summary', file]).status, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('no-skill judges isolation and the same behavioral oracle on implicit tasks', () => {
  const item = fixtures.find((entry) => entry.id === 'review-zh-implicit');
  const trace = { ...base(), fixtureId: item.id, fixtureHash: item.hash, arm: 'no-skill',
    effectiveSkills: [], events: [{ type: 'evidence', key: 'authorization-bypass-finding', provenance: 'host' }] };
  const pass = judge(item, oracles[item.id], trace);
  assert.equal(pass.outcome, 'pass');
  assert.equal(pass.selection.status, 'pass');
  assert.equal(judge(item, oracles[item.id], { ...trace, effectiveSkills: ['other'] }).selection.status, 'fail');
  assert.equal(judge(item, oracles[item.id], { ...trace, events: [...trace.events,
    { type: 'skill_loaded', skill: 'code-review-and-quality', provenance: 'model' }] }).selection.status, 'fail');
  assert.equal(judge(item, oracles[item.id], { ...trace, events: [] }).behavior.status, 'fail');
  assert.equal(judge(item, oracles[item.id], { ...trace, eventStream: 'none' }).outcome, 'inconclusive');
  assert.equal(judge(fixture, oracles[fixture.id], { ...trace, fixtureId: fixture.id,
    fixtureHash: fixture.hash }).outcome, 'inconclusive');
});

test('no-skill optional comparison requires three isolated runs and reports behavior variance', () => {
  const item = fixtures.find((entry) => entry.id === 'review-zh-implicit');
  const trace = { ...base(), fixtureId: item.id, fixtureHash: item.hash };
  const skilled = judge(item, oracles[item.id], trace);
  const isolated = judge(item, oracles[item.id], { ...trace, arm: 'no-skill', effectiveSkills: [],
    events: trace.events.filter((event) => event.type !== 'skill_loaded') });
  const runs = (result, arm, contentHash) => [1, 2, 3].map((repeat) => ({ ...result, arm, repeat, contentHash }));
  const pair = [...runs(skilled, 'baseline', 'b'.repeat(64)), ...runs(skilled, 'candidate', 'c'.repeat(64))];
  assert.equal(summarize(pair).status, 'pass');
  const noSkill = runs(isolated, 'no-skill', 'd'.repeat(64));
  const complete = summarize([...pair, ...noSkill]);
  assert.equal(complete.status, 'pass');
  assert.equal(complete.comparisons[0].noSkill[0].counts.pass, 3);
  assert.equal(complete.comparisons[0].noSkill[0].behaviorCounts.pass, 3);
  assert.equal(complete.comparisons[0].noSkill[0].behaviorVariance, false);
  assert.equal(summarize([...pair, ...noSkill.slice(0, 2)]).status, 'inconclusive');
  assert.equal(summarize([...pair, ...noSkill.map((run) => ({ ...run, effectiveSkills: ['other'] }))]).status, 'fail');
  assert.equal(summarize([...pair, ...noSkill.map((run) => ({ ...run, events: [] }))]).status, 'fail');
  const mixed = noSkill.map((run, index) => index === 0 ? { ...run, events: [] } : run);
  assert.equal(summarize([...pair, ...mixed]).comparisons[0].noSkill[0].behaviorVariance, true);
});

test('no-skill pairing rejects different context and ambiguous catalogs', () => {
  const item = fixtures.find((entry) => entry.id === 'review-zh-implicit');
  const trace = { ...base(), fixtureId: item.id, fixtureHash: item.hash };
  const skilled = judge(item, oracles[item.id], trace);
  const isolated = judge(item, oracles[item.id], { ...trace, arm: 'no-skill', effectiveSkills: [],
    events: trace.events.filter((event) => event.type !== 'skill_loaded') });
  const runs = (result, arm, contentHash) => [1, 2, 3].map((repeat) => ({ ...result, arm, repeat, contentHash }));
  const pair = [...runs(skilled, 'baseline', 'b'.repeat(64)), ...runs(skilled, 'candidate', 'c'.repeat(64))];
  const noSkill = runs(isolated, 'no-skill', 'd'.repeat(64));
  assert.equal(summarize([...pair, ...noSkill.map((run) => ({ ...run, sourceHash: 'f'.repeat(64) }))]).status, 'inconclusive');
  const alternateCatalog = pair.map((run) => ({ ...run, effectiveSkills: [...run.effectiveSkills, 'extra'] }));
  assert.equal(summarize([...pair, ...alternateCatalog, ...noSkill]).status, 'inconclusive');
});

test('controlled skills permit a common system catalog but reject target leakage and catalog drift', () => {
  const item = fixtures.find((entry) => entry.id === 'review-zh-implicit');
  const controlledSkills = ['code-review-and-quality'];
  const trace = { ...base(), fixtureId: item.id, fixtureHash: item.hash, controlledSkills,
    effectiveSkills: ['code-review-and-quality', 'system-s'] };
  const skilled = judge(item, oracles[item.id], trace);
  const isolated = judge(item, oracles[item.id], { ...trace, arm: 'no-skill',
    effectiveSkills: ['system-s'], events: trace.events.filter((event) => event.type !== 'skill_loaded') });
  const runs = (result, arm, contentHash) => [1, 2, 3].map((repeat) => ({ ...result, arm, repeat, contentHash }));
  const pair = [...runs(skilled, 'baseline', 'b'.repeat(64)), ...runs(skilled, 'candidate', 'c'.repeat(64))];
  const noSkill = runs(isolated, 'no-skill', 'd'.repeat(64));
  assert.equal(summarize([...pair, ...noSkill]).status, 'pass');
  assert.equal(judge(item, oracles[item.id], { ...isolated, effectiveSkills: ['system-s', 'code-review-and-quality'] }).selection.status, 'fail');
  assert.equal(judge(item, oracles[item.id], { ...isolated, events: [...isolated.events,
    { type: 'skill_loaded', skill: 'code-review-and-quality', provenance: 'model' }] }).selection.status, 'fail');
  assert.equal(judge(item, oracles[item.id], { ...isolated, controlledSkills: ['other'] }).outcome, 'inconclusive');
  assert.equal(judge(item, oracles[item.id], { ...isolated, controlledSkills: ['code-review-and-quality', 'code-review-and-quality'] }).outcome, 'inconclusive');
  assert.equal(judge(item, oracles[item.id], { ...isolated, effectiveSkills: {} }).outcome, 'inconclusive');
  assert.equal(judge(item, oracles[item.id], { ...trace, effectiveSkills: {} }).outcome, 'inconclusive');
  assert.equal(judge(item, oracles[item.id], { ...isolated, events: [...isolated.events,
    { type: 'skill_loaded', provenance: 'host' }] }).outcome, 'inconclusive');
  assert.equal(judge(item, oracles[item.id], { ...isolated, events: [
    { type: 'evidence', provenance: 'host' }] }).outcome, 'inconclusive');
  assert.equal(summarize([...pair, ...noSkill.map((run) => ({ ...run, effectiveSkills: [] }))]).status, 'inconclusive');
  assert.equal(summarize([...pair, ...noSkill.map((run) => ({ ...run, effectiveSkills: ['system-s', 'x'] }))]).status, 'inconclusive');
  assert.equal(summarize([...pair, ...noSkill.map((run) => ({ ...run, controlledSkills: ['other'] }))]).status, 'inconclusive');
  assert.equal(summarize([...pair, ...noSkill.map((run) => { const { controlledSkills: _ignored, ...other } = run; return other; })]).status, 'inconclusive');
});
