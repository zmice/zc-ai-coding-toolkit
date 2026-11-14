// Historical first-turn visual cases remain available for planning only.
// Real model execution requires a reusable, verified environment runner.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionGate, sha } from './lib/design-study.mjs';

const [caseId, arm, mode = '--plan', ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0, 'unexpected arguments');
assert.ok(['--plan', '--execute'].includes(mode), 'Use --plan or --execute');
assert.equal(resolve(process.cwd()), resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'Run from the repository root');
assert.ok(['baseline', 'candidate'].includes(arm), 'Use baseline or candidate');
const suiteBytes = readFileSync('tests/visual-refinement/behavior-cases.json');
const suite = JSON.parse(suiteBytes);
const cases = suite.cases.filter(item => item.id === caseId);
assert.equal(cases.length, 1, 'unknown or duplicated case');
const gate = executionGate({ '--execute': mode === '--execute' });
console.log(JSON.stringify({ ...gate, suite: 'visual-first-turn', caseId, arm,
  suiteHash: sha(suiteBytes), inputHash: sha(cases[0].input),
  externalProcessesStarted: 0, credentialsCopied: false, modelCalls: 0 }));
if (gate.status === 'blocked') process.exitCode = 2;
