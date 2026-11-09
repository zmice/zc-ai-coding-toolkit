#!/usr/bin/env node
// Offline skill-eval fixture validation and host-trace adjudication. No model calls.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, isAbsolute } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suiteDir = resolve(root, 'tests/skill-evals');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const sha = /^[a-f0-9]{64}$/;
const names = new Set(['review', 'debug', 'build', 'ui']);
const kinds = new Set(['positive', 'negative', 'boundary']);
const dimensions = new Set(['zh', 'en', 'explicit', 'implicit', 'no-op', 'missing-dependency', 'compaction-recovery']);
const arrayOfStrings = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
const controlledSet = (value) => arrayOfStrings(value) && value.length > 0 && new Set(value).size === value.length;
const safePath = (path) => typeof path === 'string' && path.length > 0 && !isAbsolute(path) && !/^[A-Za-z]:/.test(path) && !path.split(/[\\/]/).includes('..');
const canonical = (value) => JSON.stringify(value, (_key, part) => part && typeof part === 'object' && !Array.isArray(part)
  ? Object.fromEntries(Object.entries(part).sort(([a], [b]) => a.localeCompare(b))) : part);
const validPermissions = (value) => typeof value === 'string' && value.length > 0 || value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;

export function loadSuite() {
  const fixtures = JSON.parse(readFileSync(resolve(suiteDir, 'fixtures.json'), 'utf8'));
  const oracles = JSON.parse(readFileSync(resolve(suiteDir, 'oracle.json'), 'utf8'));
  return { fixtures: fixtures.map((item) => ({ ...item, hash: hash(JSON.stringify(item)) })), oracles };
}

export function validateSuite({ fixtures, oracles }) {
  const errors = [];
  const ids = new Set();
  if (fixtures.length !== 16) errors.push(`expected 16 fixtures, got ${fixtures.length}`);
  for (const item of fixtures) {
    const prefix = item.id ?? '<missing id>';
    if (typeof item.id !== 'string' || ids.has(item.id)) errors.push(`${prefix}: missing or duplicate id`);
    ids.add(item.id);
    if (!names.has(item.domain) || !kinds.has(item.kind)) errors.push(`${prefix}: invalid domain/kind`);
    if (typeof item.input !== 'string' || !item.input.trim()) errors.push(`${prefix}: missing input`);
    if (!item.workspaceSeed || typeof item.workspaceSeed !== 'object' || Array.isArray(item.workspaceSeed) ||
      Object.entries(item.workspaceSeed).some(([path, content]) => !safePath(path) || typeof content !== 'string')) errors.push(`${prefix}: invalid workspaceSeed`);
    for (const key of ['expectedSkills', 'forbiddenSkills', 'allowedFiles', 'requiredEvidence', 'dimensions']) {
      if (!arrayOfStrings(item[key]) || (key === 'allowedFiles' && item[key].some((path) => !safePath(path)))) errors.push(`${prefix}: invalid ${key}`);
    }
    if (item.dimensions?.some((value) => !dimensions.has(value))) errors.push(`${prefix}: unknown dimension`);
    if (!Number.isInteger(item.maxTurns) || item.maxTurns < 1 || !Number.isInteger(item.maxDurationSec) || item.maxDurationSec < 1) errors.push(`${prefix}: invalid limits`);
    const oracle = oracles[item.id];
    if (!oracle) { errors.push(`${prefix}: missing oracle`); continue; }
    for (const key of ['requiredSkills', 'forbiddenSkills', 'requiredEvidence', 'allowedFiles']) {
      if (!arrayOfStrings(oracle[key])) errors.push(`${prefix}: invalid oracle ${key}`);
    }
    // Duplicate public expectations are a cross-check; adjudication reads only oracle.
    for (const [publicKey, privateKey] of [['expectedSkills','requiredSkills'],['forbiddenSkills','forbiddenSkills'],['requiredEvidence','requiredEvidence'],['allowedFiles','allowedFiles']]) {
      if (JSON.stringify(item[publicKey]) !== JSON.stringify(oracle[privateKey])) errors.push(`${prefix}: public/oracle mismatch ${publicKey}`);
    }
  }
  for (const id of Object.keys(oracles)) if (!ids.has(id)) errors.push(`${id}: orphan oracle`);
  for (const domain of names) {
    const cases = fixtures.filter((item) => item.domain === domain);
    if (cases.filter((item) => item.kind === 'positive').length !== 2 || cases.filter((item) => item.kind === 'negative').length !== 1 || cases.filter((item) => item.kind === 'boundary').length !== 1) errors.push(`${domain}: expected 2 positive, 1 negative, 1 boundary`);
  }
  for (const dimension of dimensions) if (!fixtures.some((item) => item.dimensions?.includes(dimension))) errors.push(`missing dimension ${dimension}`);
  return { layer: 'static-structure', status: errors.length ? 'fail' : 'pass', fixtureCount: fixtures.length, errors };
}

const outcome = (status, reasons) => ({ status, reasons });
export function judge(fixture, oracle, trace) {
  const reasons = [];
  const metadata = { fixtureId: fixture.id, fixtureHash: fixture.hash, oracleHash: hash(JSON.stringify(oracle)), sourceHash: trace?.sourceHash ?? null,
    contentHash: trace?.contentHash ?? null, host: trace?.host ?? null, model: trace?.model ?? null,
    effort: trace?.effort ?? null, permissions: trace?.permissions ?? null, effectiveSkills: trace?.effectiveSkills ?? null,
    controlledSkills: trace?.controlledSkills,
    status: trace?.status ?? null, eventStream: trace?.eventStream ?? null,
    events: trace?.events ?? null, fileDiff: trace?.fileDiff ?? null, elapsedMs: trace?.elapsedMs ?? null,
    turns: trace?.turns ?? null, usage: trace?.usage ?? null, arm: trace?.arm ?? null, repeat: trace?.repeat ?? null };
  if (!trace || trace.fixtureId !== fixture.id || trace.fixtureHash !== fixture.hash) reasons.push('fixture identity/hash mismatch');
  if (!sha.test(trace?.sourceHash ?? '') || !sha.test(trace?.contentHash ?? '')) reasons.push('missing source/content hash');
  if (!trace?.host?.surface || !trace?.host?.version || !trace?.model || !trace?.effort || !validPermissions(trace?.permissions) || !arrayOfStrings(trace?.effectiveSkills)) reasons.push('missing host/model/permission metadata');
  if (trace?.controlledSkills !== undefined && !controlledSet(trace.controlledSkills)) reasons.push('invalid controlledSkills');
  if (!['baseline', 'candidate', 'no-skill'].includes(trace?.arm) || ![1, 2, 3].includes(trace?.repeat)) reasons.push('invalid arm/repeat metadata');
  if (!Number.isFinite(trace?.elapsedMs) || trace.elapsedMs < 0 || !Number.isInteger(trace?.turns) || trace.turns < 0) reasons.push('invalid elapsedMs/turns metadata');
  if (trace?.status === 'auth-error' || trace?.status === 'network-error') reasons.push(`external failure: ${trace.status}`);
  if (trace?.arm === 'no-skill' && (!fixture.dimensions?.includes('implicit') || fixture.dimensions.includes('explicit'))) reasons.push('no-skill comparison requires an implicit task');
  if (trace?.arm === 'no-skill' && controlledSet(trace?.controlledSkills) &&
    oracle.requiredSkills.some((skill) => !trace.controlledSkills.includes(skill))) reasons.push('required skill omitted from controlledSkills');
  if (trace?.arm !== 'no-skill' && controlledSet(trace?.controlledSkills) && arrayOfStrings(trace?.effectiveSkills) &&
    trace.controlledSkills.some((skill) => !trace.effectiveSkills?.includes(skill))) reasons.push('controlled skill unavailable in effective catalog');
  if (trace?.arm !== 'no-skill' && arrayOfStrings(trace?.effectiveSkills) && oracle.requiredSkills.some((skill) => !trace.effectiveSkills.includes(skill))) reasons.push('required skill unavailable in effective catalog');
  if (trace?.status !== 'complete' || trace?.eventStream !== 'host' || !Array.isArray(trace?.events) || !Array.isArray(trace?.fileDiff) ||
    trace?.events?.some((event) => !event || typeof event !== 'object' || Array.isArray(event) ||
      (event.type === 'skill_loaded' && (typeof event.skill !== 'string' || !event.skill.trim())) ||
      (event.type === 'evidence' && (typeof event.key !== 'string' || !event.key.trim()))) ||
    trace?.fileDiff?.some((change) => !change || typeof change !== 'object' || Array.isArray(change) || !safePath(change.path) || typeof change.status !== 'string')) reasons.push('complete host event stream unavailable');
  if (reasons.length) return { ...metadata, selection: outcome('inconclusive', reasons), behavior: outcome('inconclusive', reasons), outcome: 'inconclusive', reasons };

  const loaded = new Set(trace.events.filter((event) => event.type === 'skill_loaded' && event.provenance === 'host').map((event) => event.skill));
  const evidence = new Set(trace.events.filter((event) => event.type === 'evidence' && event.provenance === 'host').map((event) => event.key));
  const selectReasons = [];
  if (trace.arm === 'no-skill') {
    const controlled = trace.controlledSkills;
    if (controlled === undefined ? trace.effectiveSkills.length > 0 : controlled.some((skill) => trace.effectiveSkills.includes(skill)))
      selectReasons.push('controlled skill available in no-skill arm');
    if (trace.events.some((event) => event.type === 'skill_loaded' &&
      (controlled === undefined || controlled.includes(event.skill)))) selectReasons.push('skill loaded in no-skill arm');
  } else {
    for (const skill of oracle.requiredSkills) if (!loaded.has(skill)) selectReasons.push(`required skill not loaded: ${skill}`);
    for (const skill of oracle.forbiddenSkills) if (loaded.has(skill)) selectReasons.push(`forbidden skill loaded: ${skill}`);
  }
  const behaviorReasons = [];
  for (const key of oracle.requiredEvidence) if (!evidence.has(key)) behaviorReasons.push(`missing host evidence: ${key}`);
  for (const change of trace.fileDiff) if (!safePath(change.path) || !oracle.allowedFiles.includes(change.path)) behaviorReasons.push(`write outside allowed files: ${change.path}`);
  if (!Number.isFinite(trace.elapsedMs) || trace.elapsedMs > fixture.maxDurationSec * 1000) behaviorReasons.push('duration limit exceeded or missing');
  if (!Number.isInteger(trace.turns) || trace.turns > fixture.maxTurns) behaviorReasons.push('turn limit exceeded or missing');
  const selection = outcome(selectReasons.length ? 'fail' : 'pass', selectReasons);
  const behavior = outcome(behaviorReasons.length ? 'fail' : 'pass', behaviorReasons);
  return { ...metadata, selection, behavior, outcome: selectReasons.length || behaviorReasons.length ? 'fail' : 'pass', reasons: [...selectReasons, ...behaviorReasons] };
}

export function summarize(results) {
  if (!Array.isArray(results)) return { status: 'inconclusive', invalidResults: ['results must be an array'], cases: [], comparisons: [] };
  const suite = loadSuite();
  const fixtures = new Map(suite.fixtures.map((fixture) => [fixture.id, fixture]));
  const groups = new Map();
  const invalidResults = [];
  for (const [index, item] of results.entries()) {
    if (!item || typeof item !== 'object' || !item.fixtureId || !sha.test(item.fixtureHash ?? '') ||
      !sha.test(item.oracleHash ?? '') || !sha.test(item.sourceHash ?? '') || !sha.test(item.contentHash ?? '') ||
      !item.host?.surface || !item.host?.version || !item.model || !item.effort || !validPermissions(item.permissions) ||
      !arrayOfStrings(item.effectiveSkills) || !['baseline', 'candidate', 'no-skill'].includes(item.arm) || ![1, 2, 3].includes(item.repeat) ||
      (item.controlledSkills !== undefined && !controlledSet(item.controlledSkills)) ||
      typeof item.status !== 'string' || typeof item.eventStream !== 'string' ||
      !['pass', 'fail', 'inconclusive'].includes(item.outcome) || !Number.isFinite(item.elapsedMs) || item.elapsedMs < 0 ||
      !Number.isInteger(item.turns) || item.turns < 0 || !Array.isArray(item.events) || item.events.some((event) => !event || typeof event !== 'object') ||
      !Array.isArray(item.fileDiff) || item.fileDiff.some((change) => !change || typeof change !== 'object') ||
      !['pass', 'fail', 'inconclusive'].includes(item.selection?.status) || !['pass', 'fail', 'inconclusive'].includes(item.behavior?.status) ||
      (item.outcome === 'pass' && (item.selection.status !== 'pass' || item.behavior.status !== 'pass')) ||
      (item.outcome === 'fail' && item.selection.status !== 'fail' && item.behavior.status !== 'fail')) {
      invalidResults.push(index); continue;
    }
    const fixture = fixtures.get(item.fixtureId);
    if (!fixture || fixture.hash !== item.fixtureHash || hash(JSON.stringify(suite.oracles[item.fixtureId])) !== item.oracleHash) {
      invalidResults.push(index); continue;
    }
    const checked = judge(fixture, suite.oracles[item.fixtureId], item);
    const actual = { ...item, outcome: checked.outcome, selection: checked.selection, behavior: checked.behavior };
    const config = canonical({ fixtureId: item.fixtureId, fixtureHash: item.fixtureHash, oracleHash: item.oracleHash,
      sourceHash: item.sourceHash, host: item.host, model: item.model, effort: item.effort,
      permissions: item.permissions, effectiveSkills: [...item.effectiveSkills].sort(),
      controlledSkills: item.controlledSkills === undefined ? null : [...item.controlledSkills].sort() });
    const key = canonical({ config, arm: item.arm, contentHash: item.contentHash });
    if (!groups.has(key)) groups.set(key, { config, items: [] });
    groups.get(key).items.push(actual);
  }
  const cases = [...groups.values()].map(({ config, items }) => {
    const repeats = new Set(items.map((item) => item.repeat));
    const counts = Object.fromEntries(['pass', 'fail', 'inconclusive'].map((value) => [value, items.filter((item) => item.outcome === value).length]));
    const behaviorCounts = Object.fromEntries(['pass', 'fail', 'inconclusive'].map((value) => [value, items.filter((item) => item.behavior.status === value).length]));
    return { config, fixtureId: items[0].fixtureId, arm: items[0].arm, contentHash: items[0].contentHash, counts, behaviorCounts,
      runs: items.length, status: items.length === 3 && [1, 2, 3].every((value) => repeats.has(value)) ? 'complete' : 'inconclusive',
      variance: counts.pass > 0 && counts.pass < 3, behaviorVariance: behaviorCounts.pass > 0 && behaviorCounts.pass < 3 };
  });
  const withoutCatalog = (config) => {
    const value = JSON.parse(config);
    if (value.controlledSkills) value.effectiveSkills = value.effectiveSkills.filter((skill) => !value.controlledSkills.includes(skill));
    else delete value.effectiveSkills;
    return canonical(value);
  };
  const byConfig = new Map();
  for (const item of cases.filter((entry) => entry.arm !== 'no-skill')) {
    if (!byConfig.has(item.config)) byConfig.set(item.config, []);
    byConfig.get(item.config).push(item);
  }
  const noSkillCases = cases.filter((item) => item.arm === 'no-skill');
  const comparableCatalogs = new Map();
  for (const config of byConfig.keys()) {
    const key = withoutCatalog(config);
    comparableCatalogs.set(key, (comparableCatalogs.get(key) ?? 0) + 1);
  }
  const comparisons = [...byConfig.values()].map((items) => {
    const baseline = items.filter((item) => item.arm === 'baseline');
    const candidate = items.filter((item) => item.arm === 'candidate');
    const key = withoutCatalog(items[0].config);
    const noSkill = noSkillCases.filter((item) => withoutCatalog(item.config) === key);
    const isolated = !noSkill.length || noSkill.length === 1 && noSkill[0].status === 'complete' && comparableCatalogs.get(key) === 1;
    const comparable = baseline.length === 1 && candidate.length === 1 && baseline[0].status === 'complete' && candidate[0].status === 'complete' && isolated;
    return { fixtureId: items[0].fixtureId, config: items[0].config, status: comparable ? 'comparable' : 'inconclusive',
      baseline: baseline.map((item) => ({ contentHash: item.contentHash, counts: item.counts,
        behaviorCounts: item.behaviorCounts, behaviorVariance: item.behaviorVariance })),
      candidate: candidate.map((item) => ({ contentHash: item.contentHash, counts: item.counts,
        behaviorCounts: item.behaviorCounts, behaviorVariance: item.behaviorVariance })),
      noSkill: noSkill.map((item) => ({ contentHash: item.contentHash, counts: item.counts,
        behaviorCounts: item.behaviorCounts, behaviorVariance: item.behaviorVariance })),
      regression: comparable && candidate[0].counts.fail > baseline[0].counts.fail };
  });
  for (const item of noSkillCases) if (!byConfig.size || ![...byConfig.keys()].some((config) => withoutCatalog(config) === withoutCatalog(item.config))) {
    comparisons.push({ fixtureId: item.fixtureId, config: item.config, status: 'inconclusive', baseline: [], candidate: [],
      noSkill: [{ contentHash: item.contentHash, counts: item.counts, behaviorCounts: item.behaviorCounts,
        behaviorVariance: item.behaviorVariance }], regression: false });
  }
  const incomplete = invalidResults.length || !cases.length || cases.some((item) => item.status !== 'complete') || comparisons.some((item) => item.status !== 'comparable') || cases.some((item) => item.counts.inconclusive);
  const failed = cases.some((item) => item.counts.fail);
  return { status: incomplete ? 'inconclusive' : failed ? 'fail' : 'pass', invalidResults, cases, comparisons };
}

function main(argv) {
  const [command, ...args] = argv;
  const suite = loadSuite();
  const staticResult = validateSuite(suite);
  if (command === 'validate') { console.log(JSON.stringify(staticResult, null, 2)); return staticResult.status === 'pass' ? 0 : 1; }
  if (staticResult.status !== 'pass') throw new Error(staticResult.errors.join('\n'));
  if (command === 'export') {
    const fixture = suite.fixtures.find((item) => item.id === args[0]);
    if (!fixture) throw new Error('unknown fixture');
    const { id, input, workspaceSeed, maxTurns, maxDurationSec, hash: fixtureHash } = fixture;
    console.log(JSON.stringify({ id, input, workspaceSeed, maxTurns, maxDurationSec, fixtureHash }, null, 2));
    return 0;
  }
  if (command === 'judge') {
    if (!args[0]) throw new Error('usage: judge <trace.json> [result.json]');
    const trace = JSON.parse(readFileSync(resolve(args[0]), 'utf8'));
    const fixture = suite.fixtures.find((item) => item.id === trace.fixtureId);
    if (!fixture) throw new Error('unknown fixture');
    const result = judge(fixture, suite.oracles[fixture.id], trace);
    const output = JSON.stringify(result, null, 2);
    if (args[1]) writeFileSync(resolve(args[1]), `${output}\n`); else console.log(output);
    return result.outcome === 'pass' ? 0 : result.outcome === 'fail' ? 1 : 2;
  }
  if (command === 'summary') {
    if (!args[0]) throw new Error('usage: summary <results.json>');
    const result = summarize(JSON.parse(readFileSync(resolve(args[0]), 'utf8')));
    console.log(JSON.stringify(result, null, 2));
    return result.status === 'pass' ? 0 : result.status === 'fail' ? 1 : 2;
  }
  throw new Error('usage: skill-evals.mjs validate | export <id> | judge <trace.json> [result.json] | summary <results.json>');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
