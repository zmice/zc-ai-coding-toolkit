// Inspect a disposable local installation in a fresh app-server; never starts a model turn.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { createReusableEvaluationEnvironment } from './lib/reusable-eval-environment.mjs';
import { workspaceSnapshot } from './lib/design-study.mjs';
import { installedSkillPaths, auditInstalledDiscovery } from './lib/codex-install-discovery.mjs';

const [homeArg, binary, execute] = process.argv.slice(2);
assert.equal(execute, '--execute', 'Usage: node scripts/verify-codex-design-install.mjs <isolated-home> <absolute-codex.exe> --execute');
assert.ok(isAbsolute(binary || ''));
assert.equal(process.platform, 'win32', 'Windows process-tree cleanup required');
const home = workspaceSnapshot(process.cwd(), homeArg);
const installed = installedSkillPaths(home);
assert.ok(readFileSync(join(home, '.skill-eval-home'), 'utf8').includes('disposable'));
assert.equal(existsSync(join(home, 'auth.json')), false, 'Discovery does not need credentials');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(CODEX_|OPENAI_)/i.test(key)));
env.CODEX_HOME = home;
let stderr = '';
const session = createReusableEvaluationEnvironment({ workspace: process.cwd(), binary, home, cwd: home, env, timeoutMs: 45_000, maxOutputBytes: 1024 * 1024,
  onStderr: bytes => { stderr = (stderr + bytes.toString()).slice(-16000); } });
const receipt = { status: 'incomplete', home, modelCalls: 0, runtimeVerified: false, methods: ['initialize', 'skills/list'] };
try {
  const listed = await session.discoverSkills();
  const required = ['start', 'visual-refinement', 'frontend-ui-engineering', 'spec-driven-development', 'planning-and-task-breakdown', 'incremental-implementation', 'sdd-tdd-workflow', 'browser-qa-testing'];
  receipt.discovery = auditInstalledDiscovery(installed, listed, required);
  assert.equal(receipt.discovery.status, 'pass', 'installed skills and host discovery differ');
  receipt.skills = required.map(name => ({ name, path: installed.paths.get(name), enabled: true }));
  receipt.status = 'passed';
} catch (error) { receipt.status = 'failed'; receipt.failure = error.message; process.exitCode = 1; }
finally {
  const cleanup = await session.close();
  receipt.cleanupConfirmed = !cleanup.cleanupUnconfirmed;
  receipt.cleanupEvidence = cleanup.cleanupEvidence;
  if (cleanup.cleanupUnconfirmed) {
    receipt.cleanupBlockPersisted = cleanup.cleanupBlockPersisted;
    if (cleanup.cleanupBlockError) receipt.cleanupBlockError = cleanup.cleanupBlockError;
  }
  receipt.cleanupScope = 'Inspection-only app-server; no model turn or tool execution';
  if (cleanup.stopReason) { receipt.failure = [receipt.failure, cleanup.stopReason].filter(Boolean).join('; '); receipt.status = 'inconclusive'; process.exitCode = 1; }
  if (!receipt.cleanupConfirmed) { receipt.status = 'inconclusive'; process.exitCode = 1; }
  writeFileSync(join(home, '..', 'discovery-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  if (receipt.status !== 'passed') writeFileSync(join(home, '..', 'discovery-stderr.log'), stderr);
  console.log(JSON.stringify(receipt));
}
