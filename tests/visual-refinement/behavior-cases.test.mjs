import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cases = JSON.parse(readFileSync(fileURLToPath(new URL('./behavior-cases.json', import.meta.url)), 'utf8'));
const designCases = JSON.parse(readFileSync(fileURLToPath(new URL('./design-workflow-cases.json', import.meta.url)), 'utf8'));
const routingCases = JSON.parse(readFileSync(fileURLToPath(new URL('./start-routing-cases.json', import.meta.url)), 'utf8'));

test('behavior probes preserve independent inputs and private, actionable oracles', () => {
  assert.equal(cases.version, 1);
  assert.match(cases.scope, /Read-only first-turn/);
  assert.equal(cases.cases.length, 3);
  assert.equal(new Set(cases.cases.map(({ id }) => id)).size, 3);
  for (const item of cases.cases) {
    assert.ok(item.input.length > 40, item.id);
    assert.deepEqual(Object.keys(item.oracle).sort(), ['mustDo', 'mustNot']);
    assert.ok(item.oracle.mustDo.length >= 2, item.id);
    assert.ok(item.oracle.mustNot.length >= 2, item.id);
  }
  assert.match(cases.cases[0].input, /大幅视觉重塑/);
  assert.match(cases.cases[1].input, /https:\/\//);
  assert.match(cases.cases[2].input, /只修这个功能错误/);
  for (const item of cases.cases) assert.match(item.input, /只读检查并给方案，不改代码/);
});

test('design workflow probe inputs and private oracles remain complete and separate', () => {
  assert.equal(designCases.version, 1);
  assert.match(designCases.scope, /not implementation or browser acceptance/);
  const ids = designCases.cases.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), [
    'consistent-page-light-touch', 'existing-page-structure', 'functional-only',
    'new-operations-page', 'plan-only-multiple-pages', 'reference-unavailable',
  ]);
  for (const item of designCases.cases) {
    assert.equal(typeof item.input, 'string', item.id);
    assert.ok(item.input.trim().length > 40, item.id);
    assert.deepEqual(Object.keys(item).sort(), ['id', 'input', 'oracle']);
    assert.deepEqual(Object.keys(item.oracle).sort(), ['mustDo', 'mustNot']);
    for (const criteria of Object.values(item.oracle)) {
      assert.ok(criteria.length >= 2, item.id);
      assert.ok(criteria.every(value => typeof value === 'string' && value.trim().length > 0), item.id);
      assert.equal(new Set(criteria).size, criteria.length, item.id);
    }
  }
});

test('start routing probes cover implicit design, resumption and neighboring tasks without naming the target skill', () => {
  assert.equal(routingCases.version, 1);
  assert.deepEqual(routingCases.cases.map(item => item.id).sort(), [
    'backend-negative', 'functional-bug-negative', 'new-page-implicit',
    'readonly-design-implicit', 'redesign-implicit', 'resume-approved-design',
  ]);
  for (const item of routingCases.cases) {
    assert.doesNotMatch(item.input, /Unslop|visual-refinement|视觉重塑技能/i, item.id);
    assert.deepEqual(Object.keys(item).sort(), ['id', 'input', 'oracle']);
    assert.deepEqual(Object.keys(item.oracle).sort(), ['mustDo', 'mustNot']);
    for (const criteria of Object.values(item.oracle)) {
      assert.ok(Array.isArray(criteria) && criteria.length > 0, item.id);
      assert.ok(criteria.every(value => typeof value === 'string' && value.trim().length > 0), item.id);
    }
  }
});
