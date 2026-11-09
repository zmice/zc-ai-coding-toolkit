import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cases = JSON.parse(readFileSync(fileURLToPath(new URL('./behavior-cases.json', import.meta.url)), 'utf8'));

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
