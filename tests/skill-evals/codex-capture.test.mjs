import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureCodex, createCodexCaptureSession } from '../../scripts/lib/codex-eval-capture.mjs';
import { createReusableEvaluationEnvironment } from '../../scripts/lib/reusable-eval-environment.mjs';
import { startCodexAppServer } from '../../scripts/lib/codex-app-server-session.mjs';
import { createEvaluationHomeGuard } from '../../scripts/lib/eval-home-guard.mjs';

const fakeSource = `
const readline = require('node:readline');
const fs = require('node:fs');
const childProcess = require('node:child_process');
const mode = process.argv[2];
const emit = object => process.stdout.write(JSON.stringify(object) + '\\n');
let initCount = 0;
let threadCount = 0;
if (mode === 'exit') process.exit(7);
if (mode === 'tree-eof') {
  const ownedWorker = childProcess.spawn(process.execPath, ['-e', 'setTimeout(() => {}, 1800)'], {stdio:'ignore',windowsHide:true});
  fs.writeFileSync(process.argv[3], String(ownedWorker.pid));
}
if (mode === 'no-newline-flood') { process.stdout.write('x'.repeat(100000)); setInterval(() => {}, 1000); }
readline.createInterface({input:process.stdin}).on('line', line => {
  const msg = JSON.parse(line);
  if (msg.id == null) return;
  if (mode === 'initialize-hang' && msg.method === 'initialize') return;
  if (mode === 'slow-init' && msg.method === 'initialize') {
    initCount++; setTimeout(() => emit({id:msg.id,result:{codexHome:process.env.CODEX_HOME}}), 80); return;
  }
  let result;
  if (msg.method === 'initialize') { initCount++; result = {codexHome:mode === 'home' ? process.cwd() : process.env.CODEX_HOME}; }
  else if (msg.method === 'skills/list') {
    if (mode === 'discovery-error') { emit({id:msg.id,error:{code:-32000,message:'synthetic discovery failure'}}); return; }
    if (mode === 'discovery-request') { emit({id:778,method:'account/login/start',params:{secret:'do-not-log'}}); return; }
    result = {data:[{cwd:mode === 'wrong-discovery-cwd' ? process.env.CODEX_HOME : msg.params.cwds[0],errors:[],skills:[{name:'fixture:review',path:process.env.CODEX_HOME + '/skills/review/SKILL.md',enabled:true,pluginId:mode === 'reuse' ? String(process.pid) : mode === 'slow-init' || mode.startsWith('batch') ? String(initCount) : 'fixture'}]}]};
  }
  else if (msg.method === 'thread/start') result = {cwd:msg.params.cwd,model:mode === 'model' ? 'wrong' : msg.params.model,reasoningEffort:msg.params.config.model_reasoning_effort,approvalPolicy:'never',activePermissionProfile:{id:'eval'},runtimeWorkspaceRoots:[msg.params.cwd],thread:{id:mode.startsWith('batch') ? 'thread-' + (++threadCount) : 'thread-1'}};
  else if (msg.method === 'turn/start') {
    if (mode.startsWith('batch')) {
      const threadId = msg.params.threadId, turnId = 'turn-' + threadId;
      emit({id:msg.id,result:{turn:{id:turnId}}});
      if (mode === 'batch-deadline') return;
      const status = mode === 'batch-fail' && threadId === 'thread-1' ? 'failed' : 'completed';
      setTimeout(() => emit({method:'turn/completed',params:{threadId,turn:{id:turnId,status,items:[]}}}),
        mode === 'batch-late' && threadId === 'thread-2' ? 100 : 20);
      if (mode === 'batch-late' && threadId === 'thread-1') {
        setTimeout(() => emit({method:'item/completed',params:{threadId,turnId,item:{type:'agentMessage',text:'LATE_PREVIOUS_CASE_MARKER'}}}), 60);
      }
      return;
    }
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
    if (mode === 'server-request') { emit({id:777,method:'account/login/start',params:{secret:'do-not-log'}}); return; }
    if (mode === 'output-limit') { emit({method:'item/completed',params:{threadId:'thread-1',turnId:'turn-1',item:{type:'agentMessage',text:'x'.repeat(10000)}}}); return; }
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

test('rejects interactive server requests without persisting their contents', async () => {
  const options = await fixture('server-request');
  const receipt = await captureCodex(options);
  assert.equal(receipt.status, 'inconclusive');
  assert.match(receipt.reason, /server request: account\/login\/start/);
  assert.equal((await readFile(join(options.outputDir, 'host-events.jsonl'), 'utf8')).includes('do-not-log'), false);
});

test('stops at stdout output budget', async () => {
  const options = await fixture('output-limit'); options.maxOutputBytes = 4096;
  const receipt = await captureCodex(options);
  assert.equal(receipt.status, 'inconclusive');
  assert.match(receipt.reason, /maxOutputBytes: stdout/);
});

test('cancels a pending capture through AbortSignal', async () => {
  const options = await fixture('deadline');
  const controller = new AbortController(); options.signal = controller.signal;
  const timer = setTimeout(() => controller.abort(), 150);
  try {
    const receipt = await captureCodex(options);
    assert.equal(receipt.status, 'inconclusive');
    assert.match(receipt.reason, /cancelled/);
  } finally { clearTimeout(timer); }
});

test('reports startup failure as inconclusive', async () => {
  const options = await fixture('happy'); options.binary = join(options.home, 'missing-codex');
  const started = Date.now();
  const receipt = await captureCodex(options);
  assert.equal(receipt.status, 'inconclusive');
  assert.match(receipt.reason, /app-server startup/);
  assert.ok(Date.now() - started < 4_000, 'failed startup must return within bounded cleanup');
  assert.equal(receipt.cleanupUnconfirmed, true);
  assert.equal(receipt.cleanupEvidence.reason, 'missing PID');
  assert.equal(receipt.cleanupBlockPersisted, true);
});

test('counts stdout without waiting for a newline', async () => {
  const options = await fixture('no-newline-flood'); options.maxOutputBytes = 4096;
  const receipt = await captureCodex(options);
  assert.equal(receipt.status, 'inconclusive');
  assert.match(receipt.reason, /maxOutputBytes: stdout/);
});

test('rejects an evaluation home containing copied auth before starting a process', async () => {
  const options = await fixture('happy');
  await writeFile(join(options.home, 'auth.json'), 'synthetic secret');
  await assert.rejects(captureCodex(options), /must not contain copied auth/);
});

test('capture refuses an empty auth.json directory without reporting copied credentials', async () => {
  const options = await fixture('happy');
  await mkdir(join(options.home, 'auth.json'));
  await assert.rejects(captureCodex(options), /auth.json directory; sandbox sentinel state requires review/);
});

test('one capture session reuses initialization but gives each case its own thread, cwd and evidence', async () => {
  const options = await fixture('batch-late');
  const secondCwd = join(options.cwd, '..', 'cwd-two'), secondOutput = join(options.cwd, '..', 'capture-two');
  await mkdir(secondCwd);
  const session = await createCodexCaptureSession(options);
  const first = await session.capture(options);
  assert.equal(first.status, 'pending-cleanup');
  const second = await session.capture({ ...options, cwd: secondCwd, outputDir: secondOutput });
  assert.equal(second.status, 'pending-cleanup');
  const cleanup = await session.close();
  assert.notEqual(first.threadId, second.threadId);
  assert.equal(first.discoveredSkills[0].pluginId, '1');
  assert.equal(second.discoveredSkills[0].pluginId, '1');
  assert.equal(first.status, cleanup.cleanupUnconfirmed ? 'inconclusive' : 'complete');
  assert.equal(second.status, cleanup.cleanupUnconfirmed ? 'inconclusive' : 'complete');
  assert.equal(JSON.parse(await readFile(join(secondOutput, 'capture.json'))).status, second.status);
  const secondEvents = await readFile(join(secondOutput, 'host-events.jsonl'), 'utf8');
  assert.equal(secondEvents.includes('LATE_PREVIOUS_CASE_MARKER'), false);
  assert.ok(secondEvents.includes(second.threadId));
  await assert.rejects(session.capture({ ...options, cwd: secondCwd, outputDir: secondOutput }), /closed/);
});

test('a failed case stops the reusable capture session before another case', async () => {
  const options = await fixture('batch-fail');
  const secondCwd = join(options.cwd, '..', 'cwd-two'), secondOutput = join(options.cwd, '..', 'capture-two');
  await mkdir(secondCwd);
  const session = await createCodexCaptureSession(options);
  try {
    const first = await session.capture(options);
    assert.equal(first.status, 'inconclusive');
    assert.match(first.reason, /turn status: failed/);
    await assert.rejects(session.capture({ ...options, cwd: secondCwd, outputDir: secondOutput }), /failed/);
  } finally { await session.close(); }
});

test('reusable capture deadline stops the batch and closes within a bound', async () => {
  const options = await fixture('batch-deadline'); options.timeoutMs = 150;
  const session = await createCodexCaptureSession(options);
  const started = Date.now();
  const receipt = await session.capture(options);
  assert.match(receipt.reason, /deadline/);
  await session.close();
  assert.ok(Date.now() - started < 4_000);
  await assert.rejects(session.capture(options), /closed/);
});

test('uncertain cleanup persists a block before another session can start', async t => {
  if (process.platform !== 'win32') { t.skip('Windows process-tree uncertainty fixture'); return; }
  const options = await fixture('exit');
  const receipt = await captureCodex(options);
  assert.equal(receipt.cleanupUnconfirmed, true);
  assert.equal(receipt.cleanupBlockPersisted, true);
  const marker = JSON.parse(await readFile(join(options.home, '.eval-capture-cleanup-unconfirmed.json'), 'utf8'));
  assert.equal(marker.status, 'cleanup-unconfirmed');
  await assert.rejects(createCodexCaptureSession(options), /blocked by unconfirmed cleanup/);
});

test('capture reserves the session before async validation and close cannot overtake it', async () => {
  const options = await fixture('batch');
  const secondCwd = join(options.cwd, '..', 'cwd-two'), secondOutput = join(options.cwd, '..', 'capture-two');
  await mkdir(secondCwd);
  const session = await createCodexCaptureSession(options);
  const first = session.capture(options);
  assert.equal(session.status, 'busy');
  await assert.rejects(session.capture({ ...options, cwd: secondCwd, outputDir: secondOutput }), /busy/);
  await assert.rejects(session.close(), /active/);
  assert.equal((await first).status, 'pending-cleanup');
  await session.close();
});

test('rejects nested case directories and nested output directories', async () => {
  const options = await fixture('batch');
  const nestedCwd = join(options.cwd, 'nested'), secondCwd = join(options.cwd, '..', 'cwd-two');
  await mkdir(nestedCwd); await mkdir(secondCwd);
  const session = await createCodexCaptureSession(options);
  try {
    await session.capture(options);
    await assert.rejects(session.capture({ ...options, cwd: nestedCwd, outputDir: join(options.cwd, '..', 'nested-capture') }), /non-overlapping/);
    await assert.rejects(session.capture({ ...options, cwd: secondCwd, outputDir: join(options.outputDir, 'nested') }), /non-overlapping/);
  } finally { await session.close(); }
});

async function reusableFixture(mode) {
  const workspace = await mkdtemp(join(tmpdir(), 'reusable-eval-test-'));
  const cache = join(workspace, '.cache'), home = join(cache, 'home'), cwd = join(cache, 'project');
  await mkdir(cache); await mkdir(home); await mkdir(cwd);
  await writeFile(join(home, '.skill-eval-home'), 'disposable');
  const fake = join(cache, 'fake.cjs'); await writeFile(fake, fakeSource);
  return { workspace, home, cwd, binary: process.execPath, binaryArgs: [fake, mode], timeoutMs: 2_000, maxOutputBytes: 4096 };
}

test('reuses a credential-free app-server for repeated discovery', async () => {
  const options = await reusableFixture('reuse');
  const batch = createReusableEvaluationEnvironment(options);
  try {
    const first = await batch.discoverSkills();
    const second = await batch.discoverSkills();
    assert.equal(first[0].pluginId, second[0].pluginId);
    assert.equal(batch.status, 'discovery-only');
  } finally {
    const cleanup = await batch.close();
    assert.equal(typeof cleanup.cleanupUnconfirmed, 'boolean');
    assert.equal(batch.status, 'stopped');
    await assert.rejects(batch.discoverSkills(), /stopped/);
  }
});

test('concurrent discovery shares a single initialization', async () => {
  const options = await reusableFixture('slow-init');
  const batch = createReusableEvaluationEnvironment(options);
  try {
    const [first, second] = await Promise.all([batch.discoverSkills(), batch.discoverSkills()]);
    assert.equal(first[0].pluginId, '1');
    assert.equal(second[0].pluginId, '1');
  } finally { await batch.close(); }
});

test('failed initialization preserves actual cleanup evidence', async () => {
  const options = await reusableFixture('home');
  const batch = createReusableEvaluationEnvironment(options);
  await assert.rejects(batch.discoverSkills(), /unexpected codexHome/);
  const cleanup = await batch.close();
  assert.notEqual(cleanup.cleanupEvidence?.processStarted, false);
  assert.equal(batch.status, 'stopped');
});

test('discovery stops its batch on a server authentication request', async () => {
  const options = await reusableFixture('discovery-request');
  const batch = createReusableEvaluationEnvironment(options);
  try {
    await assert.rejects(batch.discoverSkills(), /server request: account\/login\/start/);
    assert.equal(batch.status, 'stopped');
    await assert.rejects(batch.discoverSkills(), /stopped/);
  } finally { await batch.close(); }
});

test('discovery rejects a result for another cwd and stops the batch', async () => {
  const options = await reusableFixture('wrong-discovery-cwd');
  const batch = createReusableEvaluationEnvironment(options);
  try {
    await assert.rejects(batch.discoverSkills(), /skills\/list incomplete/);
    assert.equal(batch.status, 'stopped');
    await assert.rejects(batch.discoverSkills(), /stopped/);
  } finally { await batch.close(); }
});

test('reusable environment rejects copied auth before spawning', async () => {
  const options = await reusableFixture('reuse');
  await writeFile(join(options.home, 'auth.json'), 'synthetic secret');
  assert.throws(() => createReusableEvaluationEnvironment(options), /must not contain copied auth/);
});

test('discovery refuses an empty auth.json directory before spawning', async () => {
  const options = await reusableFixture('reuse');
  await mkdir(join(options.home, 'auth.json'));
  assert.throws(() => createReusableEvaluationEnvironment(options), /auth.json directory; sandbox sentinel state requires review/);
});

test('discovery rejects a home blocked by capture cleanup before startup', async () => {
  const options = await reusableFixture('reuse');
  await writeFile(join(options.home, '.eval-capture-cleanup-unconfirmed.json'), '{}');
  assert.throws(() => createReusableEvaluationEnvironment(options), /blocked by unconfirmed cleanup/);
});

for (const name of ['auth.json', '.eval-capture-cleanup-unconfirmed.json']) {
  test(`discovery rechecks ${name} added after construction`, async () => {
    const options = await reusableFixture('reuse');
    const batch = createReusableEvaluationEnvironment(options);
    await writeFile(join(options.home, name), '{}');
    try {
      await assert.rejects(batch.discoverSkills(), /copied auth|unconfirmed cleanup/);
      assert.equal(batch.status, 'stopped');
    } finally {
      const cleanup = await batch.close();
      assert.equal(cleanup.cleanupEvidence.processStarted, false);
    }
  });
}

test('concurrent discovery close calls share final cleanup evidence', async () => {
  const options = await reusableFixture('reuse');
  const batch = createReusableEvaluationEnvironment(options);
  await batch.discoverSkills();
  const [first, second] = await Promise.all([batch.close(), batch.close()]);
  assert.strictEqual(first, second);
  assert.strictEqual(await batch.close(), first);
});

test('discovery RPC error stops reuse instead of retrying the failed batch', async () => {
  const options = await reusableFixture('discovery-error');
  const batch = createReusableEvaluationEnvironment(options);
  try {
    await assert.rejects(batch.discoverSkills(), /synthetic discovery failure/);
    assert.equal(batch.status, 'stopped');
    await assert.rejects(batch.discoverSkills(), /stopped/);
  } finally { await batch.close(); }
});

test('discovery uncertain cleanup blocks both discovery and capture sessions', async t => {
  if (process.platform !== 'win32') { t.skip('Windows process-tree uncertainty fixture'); return; }
  const options = await reusableFixture('exit');
  const batch = createReusableEvaluationEnvironment(options);
  await assert.rejects(batch.discoverSkills(), /exited/);
  const cleanup = await batch.close();
  assert.equal(cleanup.cleanupUnconfirmed, true);
  assert.equal(cleanup.cleanupBlockPersisted, true);
  assert.throws(() => createReusableEvaluationEnvironment(options), /blocked by unconfirmed cleanup/);
  await assert.rejects(createCodexCaptureSession({ ...options, model: 'test', effort: 'medium' }), /blocked by unconfirmed cleanup/);
});

test('cleanup guard preserves an existing block rather than overwriting evidence', async () => {
  const options = await reusableFixture('reuse');
  const guard = createEvaluationHomeGuard(options.home);
  const marker = join(options.home, '.eval-capture-cleanup-unconfirmed.json');
  await writeFile(marker, 'original evidence');
  const result = await guard.recordCleanup({ cleanupUnconfirmed: true });
  assert.equal(result.cleanupBlockPersisted, false);
  assert.match(result.cleanupBlockError, /EEXIST/);
  assert.equal(await readFile(marker, 'utf8'), 'original evidence');
  assert.throws(() => guard.assertReusable(), /blocked by unconfirmed cleanup/);
});

test('cleanup guard refuses a replacement home without writing into it', async () => {
  const options = await reusableFixture('reuse');
  const guard = createEvaluationHomeGuard(options.home);
  await rename(options.home, options.home + '-original');
  await mkdir(options.home);
  assert.throws(() => guard.assertReusable(), /identity changed/);
  const result = await guard.recordCleanup({ cleanupUnconfirmed: true });
  assert.equal(result.cleanupBlockPersisted, false);
  assert.match(result.cleanupBlockError, /identity changed/);
  await assert.rejects(readFile(join(options.home, '.eval-capture-cleanup-unconfirmed.json')), { code: 'ENOENT' });
});

test('discovery rechecks the home before reusing an already opened server', async () => {
  const options = await reusableFixture('reuse');
  const batch = createReusableEvaluationEnvironment(options);
  try {
    await batch.discoverSkills();
    await writeFile(join(options.home, '.eval-capture-cleanup-unconfirmed.json'), 'external block');
    await assert.rejects(batch.discoverSkills(), /blocked by unconfirmed cleanup/);
    assert.equal(batch.status, 'stopped');
  } finally { await batch.close(); }
});

test('close during initialization stops discovery and shares cleanup', async () => {
  const options = await reusableFixture('slow-init');
  const batch = createReusableEvaluationEnvironment(options);
  const discovery = assert.rejects(batch.discoverSkills(), /stopped/);
  const [first, second] = await Promise.all([batch.close(), batch.close()]);
  await discovery;
  assert.strictEqual(first, second);
  assert.equal(batch.status, 'stopped');
});

test('RPC timeout stops the whole app-server session', async () => {
  const options = await reusableFixture('initialize-hang');
  const session = startCodexAppServer({ binary: options.binary, args: options.binaryArgs, cwd: options.cwd,
    env: { ...process.env, CODEX_HOME: options.home }, timeoutMs: 2_000, maxOutputBytes: 4096 });
  try {
    await assert.rejects(session.rpc('initialize', {}, 50), /RPC timeout: initialize/);
    assert.equal(session.stopReason, 'RPC timeout: initialize');
    await assert.rejects(session.rpc('skills/list', {}), /RPC timeout: initialize/);
  } finally { await session.close(); }
});

test('pre-aborted signal does not start app-server', async () => {
  const options = await reusableFixture('reuse');
  const controller = new AbortController(); controller.abort();
  assert.throws(() => startCodexAppServer({ binary: options.binary, args: options.binaryArgs, cwd: options.cwd,
    env: { ...process.env, CODEX_HOME: options.home }, timeoutMs: 2_000, maxOutputBytes: 4096, signal: controller.signal }), /cancelled before/);
});

test('Windows cleanup targets an owned parent and its short-lived child before sending EOF', async t => {
  if (process.platform !== 'win32') { t.skip('Windows taskkill /T behavior'); return; }
  const options = await reusableFixture('tree-eof');
  const childPidFile = join(options.workspace, '.cache', 'owned-child-pid.txt');
  const session = startCodexAppServer({ binary: options.binary, args: [options.binaryArgs[0], 'tree-eof', childPidFile], cwd: options.cwd,
    env: { ...process.env, CODEX_HOME: options.home }, timeoutMs: 2_000, maxOutputBytes: 4096 });
  await session.rpc('initialize', {});
  const ownedChildPid = Number(await readFile(childPidFile, 'utf8'));
  assert.ok(Number.isSafeInteger(ownedChildPid) && ownedChildPid > 0);
  const cleanup = await session.close();
  assert.equal(cleanup.cleanupEvidence.command, 'taskkill /PID /T /F');
  assert.equal(typeof cleanup.cleanupUnconfirmed, 'boolean');
  if (cleanup.cleanupEvidence.outcome.code === 0) assert.equal(cleanup.cleanupUnconfirmed, false);
});

test('an already exited app-server is not mistaken for confirmed tree cleanup', async t => {
  if (process.platform !== 'win32') { t.skip('Windows tree-cleanup uncertainty'); return; }
  const options = await reusableFixture('exit');
  const session = startCodexAppServer({ binary: options.binary, args: options.binaryArgs, cwd: options.cwd,
    env: { ...process.env, CODEX_HOME: options.home }, timeoutMs: 2_000, maxOutputBytes: 4096 });
  await assert.rejects(session.rpc('initialize', {}), /exited/);
  const cleanup = await session.close();
  assert.equal(cleanup.cleanupUnconfirmed, true);
  assert.equal(cleanup.cleanupEvidence.reason, 'exited before tree cleanup');
});

test('cleanup remains bounded when a fake app-server does not answer', async () => {
  const options = await reusableFixture('initialize-hang');
  const session = startCodexAppServer({ binary: options.binary, args: options.binaryArgs, cwd: options.cwd,
    env: { ...process.env, CODEX_HOME: options.home }, timeoutMs: 120, maxOutputBytes: 4096 });
  const started = Date.now();
  await assert.rejects(session.rpc('initialize', {}), /deadline|RPC timeout/);
  const cleanup = await session.close();
  assert.ok(Date.now() - started < 6_000, 'owned cleanup must return within its deadline');
  assert.equal(typeof cleanup.cleanupUnconfirmed, 'boolean');
});
