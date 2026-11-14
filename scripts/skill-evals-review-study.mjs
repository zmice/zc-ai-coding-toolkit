// Historical fresh-home execution is gated until a verified reusable runner exists.
// Planning remains available without processes, credentials, or sandbox initialization.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionGate } from './lib/design-study.mjs';

const [caseId, arm, repeatArg, fourth = '--plan', fifth, ...extra] = process.argv.slice(2);
const mode = fourth.startsWith('--') ? fourth : fifth ?? '--plan';
assert.equal(extra.length, 0, 'unexpected arguments');
assert.ok(fourth.startsWith('--') ? fifth === undefined : true, 'unexpected arguments');
assert.ok(['--plan', '--execute'].includes(mode), 'Use --plan or --execute');
// Keep the historical positional binary accepted, but planning does not use it.
assert.equal(resolve(process.cwd()), resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'Run from the repository root');
assert.ok(['baseline', 'candidate'].includes(arm));
const repeat = Number(repeatArg);
assert.ok([1, 2, 3].includes(repeat));
const suite = JSON.parse(readFileSync('tests/skill-evals/review-coverage-cases.json', 'utf8'));
assert.ok(suite.cases.some(item => item.id === caseId), 'unknown case');
const gate = executionGate({ '--execute': mode === '--execute' });
console.log(JSON.stringify({ ...gate, caseId, arm, repeat, externalProcessesStarted: 0, credentialsCopied: false, modelCalls: 0 }));
if (gate.status === 'blocked') process.exitCode = 2;
