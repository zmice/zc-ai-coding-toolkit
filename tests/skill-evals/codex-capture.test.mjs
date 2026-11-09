import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureCodex } from '../../scripts/lib/codex-eval-capture.mjs';

const fakeSource = `
const readline = require('node:readline');
const mode = process.argv[2];
const emit = object => process.stdout.write(JSON.stringify(object) + '\\n');
if (mode === 'exit') process.exit(7);
readline.createInterface({input:process.stdin}).on('line', line => {
  const msg = JSON.parse(line);
  if (msg.id == null) return;
  if (mode === 'initialize-hang' && msg.method === 'initialize') return;
  let result;
  if (msg.method === 'initialize') result = {codexHome:mode === 'home' ? process.cwd() : process.env.CODEX_HOME};
  else if (msg.method === 'skills/list') result = {data:[{cwd:process.cwd(),errors:[],skills:[{name:'fixture:review',path:process.env.CODEX_HOME + '/skills/review/SKILL.md',enabled:true,pluginId:'fixture'}]}]};
  else if (msg.method === 'thread/start') result = {cwd:msg.params.cwd,model:mode === 'model' ? 'wrong' : msg.params.model,reasoningEffort:msg.params.config.model_reasoning_effort,approvalPolicy:'never',activePermissionProfile:{id:'eval'},runtimeWorkspaceRoots:[msg.params.cwd],thread:{id:'thread-1'}};
  else if (msg.method === 'turn/start') {
    result = {turn:{id:'turn-1'}};
    if (mode === 'wrong-completion') {
      emit({method:'turn/completed',params:{threadId:'thread-1',turn:{id:'wrong-turn',status:'completed',items:[]}}});
      setTimeout(() => emit({id:msg.id,result}), 20);
      return;
    }
    if (mode === 'early-budget') {
      emit({method:'item/started',params:{threadId:'thread-1',turnId:'turn-1',item:{id:'tool-1',type:'commandExecution'}}});
      setTimeout(() => emit({id:msg.id,result}), 20);
      return;
    }
    emit({id:msg.id,result});
    if (mode === 'deadline') return;
    if (mode === 'invalid-stdout') { process.stdout.write('not json\\n'); return; }
    setTimeout(() => {
      if (mode === 'budget') emit({method:'item/started',params:{threadId:'thread-1',turnId:'turn-1',item:{id:'tool-1',type:'commandExecution'}}});
      else emit({method:'turn/completed',params:{threadId:'thread-1',turn:{id:'turn-1',status:'completed',items:[]}}});
    }, 20);
    return;
  } else if (msg.method === 'turn/interrupt') result = {};
  emit({id:msg.id,result});
});`;

async function fixture(mode) {
  const root = await mkdtemp(join(tmpdir(), 'codex-capture-test-'));
  const home = join(root, 'home'), cwd = join(root, 'cwd'), outputDir = join(root, 'capture');
  await mkdir(home); await mkdir(cwd);
  await writeFile(join(home, '.skill-eval-home'), 'test');
  const fake = join(root, 'fake.cjs'); await writeFile(fake, fakeSource);
  return { binary: process.execPath, extraBinaryArgs: [fake, mode], home, cwd, outputDir,
    model: 'gpt-test', effort: 'medium', permissionProfile: 'eval',
    input: [{ type:'text', text:'review', text_elements:[] }], timeoutMs: 2_000, maxToolCalls: 2, maxTokens: 100 };
}

test('captures completed turn, effective configuration and native skill input', async () => {
  const options = await fixture('happy'); options.skillName = 'fixture:review';
  const receipt = await captureCodex(options);
  if (receipt.cleanupUnconfirmed) {
    assert.equal(receipt.status, 'inconclusive');
    assert.match(receipt.reason, /cleanup unconfirmed/);
  } else assert.equal(receipt.status, 'complete', receipt.reason);
  assert.equal(receipt.resolvedSkill.name, options.skillName);
  assert.equal(receipt.turnInput.at(-1).type, 'skill');
  const events = await readFile(join(options.outputDir, 'host-events.jsonl'), 'utf8');
  assert.ok(events.includes('turn/completed'));
  assert.equal(JSON.parse(await readFile(join(options.outputDir, 'capture.json'))).status, receipt.status);
});

for (const mode of ['home', 'model', 'exit']) test(`reports ${mode} mismatch or early exit`, async () => {
  const options = await fixture(mode);
  const receipt = await captureCodex(options);
  assert.equal(receipt.status, 'inconclusive');
  assert.match(receipt.reason, mode === 'home' ? /codexHome/ : mode === 'model' ? /configuration mismatch/ : /exited/);
  if (mode === 'exit' && process.platform === 'win32') assert.equal(receipt.cleanupUnconfirmed, true);
});

test('interrupts at observed tool budget', async () => {
  const options = await fixture('budget'); options.maxToolCalls = 1;
  const receipt = await captureCodex(options);
  assert.match(receipt.reason, /^maxToolCalls/);
  assert.equal(receipt.toolCalls, 1);
});

test('deadline ends an uncompleted turn', async () => {
  const options = await fixture('deadline'); options.timeoutMs = 150;
  const receipt = await captureCodex(options);
  assert.equal(receipt.status, 'inconclusive');
  assert.match(receipt.reason, /^deadline/);
});

test('deadline cancels a pending initialize RPC', async () => {
  const options = await fixture('initialize-hang'); options.timeoutMs = 150;
  const receipt = await captureCodex(options);
  assert.match(receipt.reason, /^deadline/);
  assert.equal(receipt.turnId, null);
});

test('counts a tool notification before turn/start response', async () => {
  const options = await fixture('early-budget'); options.maxToolCalls = 1;
  const receipt = await captureCodex(options);
  assert.match(receipt.reason, /^maxToolCalls/);
  assert.equal(receipt.toolCalls, 1);
});

test('ignores a completion for another turn before turn/start response', async () => {
  const options = await fixture('wrong-completion'); options.timeoutMs = 180;
  const receipt = await captureCodex(options);
  assert.equal(receipt.status, 'inconclusive');
  assert.match(receipt.reason, /^deadline/);
  assert.equal(receipt.turnId, 'turn-1');
  assert.equal(receipt.turnStatus, null);
});

test('treats non-JSON app-server stdout as inconclusive', async () => {
  const options = await fixture('invalid-stdout');
  const receipt = await captureCodex(options);
  assert.equal(receipt.status, 'inconclusive');
  assert.match(receipt.reason, /invalid JSON-RPC stdout/);
});
