// Inspect a disposable local installation in a fresh app-server; never starts a model turn.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { workspaceSnapshot } from './lib/design-study.mjs';

const [homeArg, binary, execute] = process.argv.slice(2);
assert.equal(execute, '--execute', 'Usage: node scripts/verify-codex-design-install.mjs <isolated-home> <absolute-codex.exe> --execute');
assert.ok(isAbsolute(binary || ''));
assert.equal(process.platform, 'win32', 'Windows process-tree cleanup required');
const home = workspaceSnapshot(process.cwd(), homeArg);
assert.ok(readFileSync(join(home, '.skill-eval-home'), 'utf8').includes('disposable'));
assert.equal(existsSync(join(home, 'auth.json')), false, 'Discovery does not need credentials');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(CODEX_|OPENAI_)/i.test(key)));
env.CODEX_HOME = home;
const child = spawn(binary, ['app-server', '--stdio'], { cwd: home, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
const pending = new Map();
let id = 0, exited = false, stderr = '';
child.stderr.on('data', bytes => { stderr = (stderr + bytes).slice(-16000); });
const rejectAll = error => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear(); };
child.on('error', rejectAll);
child.on('exit', () => { exited = true; rejectAll(new Error('app-server exited')); });
const lines = createInterface({ input: child.stdout });
lines.on('line', line => {
  let value; try { value = JSON.parse(line); } catch { rejectAll(new Error('invalid app-server JSON')); return; }
  if (value.id != null && value.method) { child.stdin.write(JSON.stringify({ id: value.id, error: { code: -32000, message: 'No server requests allowed' } }) + '\n'); return; }
  const request = pending.get(value.id);
  if (request) { pending.delete(value.id); clearTimeout(request.timer); value.error ? request.reject(new Error(JSON.stringify(value.error))) : request.resolve(value.result); }
});
child.stdin.on('error', rejectAll);
const rpc = (method, params) => new Promise((resolveResult, reject) => {
  const requestId = ++id;
  const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`timeout: ${method}`)); }, 15000);
  pending.set(requestId, { resolve: resolveResult, reject, timer });
  child.stdin.write(JSON.stringify({ id: requestId, method, params }) + '\n');
});
const receipt = { status: 'incomplete', home, modelCalls: 0, methods: ['initialize', 'skills/list'] };
try {
  const init = await rpc('initialize', { clientInfo: { name: 'zc-local-install-check', version: '1.0.0' }, capabilities: { experimentalApi: true } });
  assert.equal(resolve(init.codexHome), resolve(home));
  child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
  const listed = await rpc('skills/list', { cwds: [home], forceReload: true });
  assert.equal(listed.data.length, 1);
  assert.deepEqual(listed.data[0].errors ?? [], []);
  const required = ['start', 'visual-refinement', 'frontend-ui-engineering', 'spec-driven-development', 'planning-and-task-breakdown', 'incremental-implementation', 'sdd-tdd-workflow', 'browser-qa-testing'];
  receipt.skills = required.map(name => {
    const matches = listed.data[0].skills.filter(s => s.enabled && (s.name === name || s.name === `zc-toolkit:${name}`) && resolve(s.path).startsWith(resolve(home, 'plugins', 'cache')));
    assert.equal(matches.length, 1, `missing or ambiguous ${name}`);
    return { name, path: matches[0].path, enabled: true };
  });
  receipt.status = 'passed';
} catch (error) { receipt.status = 'failed'; receipt.failure = error.message; process.exitCode = 1; }
finally {
  lines.close(); rejectAll(new Error('inspection closed'));
  // No model turn or tool was started; first let the inspection-only server exit on EOF.
  child.stdin.end();
  await new Promise(done => {
    if (exited) { done(); return; }
    const timer = setTimeout(done, 2000);
    child.once('exit', () => { clearTimeout(timer); done(); });
  });
  if (!exited && child.pid) {
    const killed = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'pipe', timeout: 5000 });
    receipt.cleanupConfirmed = killed.status === 0;
  } else receipt.cleanupConfirmed = exited;
  receipt.cleanupScope = 'Inspection-only app-server; no model turn or tool execution';
  if (!receipt.cleanupConfirmed) { receipt.status = 'inconclusive'; process.exitCode = 1; }
  writeFileSync(join(home, '..', 'discovery-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  if (receipt.status !== 'passed') writeFileSync(join(home, '..', 'discovery-stderr.log'), stderr);
  console.log(JSON.stringify(receipt));
}
