import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executionGate, parseArgs, selectCase, sha, snapshotFiles, workspaceSnapshot } from './lib/design-study.mjs';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
assert.equal(resolve(process.cwd()), workspace, 'run from repository root');
const suitePath = join(workspace, 'tests/visual-refinement', args['--suite'] === 'start' ? 'start-routing-cases.json' : 'design-workflow-cases.json');
const suiteBytes = readFileSync(suitePath);
const item = selectCase(JSON.parse(suiteBytes), args['--case']);
const snapshot = workspaceSnapshot(workspace, args[`--${args['--arm']}`]);
const otherSnapshot = (args['--execute'] || args['--prepare-only']) ? workspaceSnapshot(workspace, args[args['--arm'] === 'baseline' ? '--candidate' : '--baseline']) : null;
if (otherSnapshot) assert.notEqual(snapshot, otherSnapshot, 'baseline and candidate must be separate frozen directories');
const sourceHashes = snapshotFiles(snapshot);
const marketplace = JSON.parse(readFileSync(join(snapshot, '.agents/plugins/marketplace.json'), 'utf8'));
assert.equal(typeof marketplace.name, 'string');
assert.ok(marketplace.name.length > 0 && /^[a-zA-Z0-9_-]+$/.test(marketplace.name));
assert.deepEqual(marketplace.plugins?.map(plugin => plugin.name), ['zc-toolkit']);
assert.equal(marketplace.plugins[0].source?.source, 'local');
assert.equal(marketplace.plugins[0].source?.path.replaceAll('\\', '/').replace(/^\.\//, ''), 'plugins/zc-toolkit');
const plan = { suite: args['--suite'], caseId: item.id, arm: args['--arm'], snapshot, snapshotHash: sha(JSON.stringify(sourceHashes)), suiteHash: sha(suiteBytes), inputHash: sha(item.input), explicitSkill: args['--suite'] === 'start' ? 'start' : 'visual-refinement', model: args['--model'] ?? null, effort: args['--effort'] ?? null, execution: Boolean(args['--execute']) };
if (args['--prepare-only']) {
  const root = mkdtempSync(join(workspace, '.cache', `design-study-${item.id}-${args['--arm']}-`));
  const home = join(root, 'home'), project = join(root, 'project'), market = join(root, 'market');
  mkdirSync(home); mkdirSync(project);
  writeFileSync(join(home, '.skill-eval-home'), 'disposable evaluation home');
  cpSync(snapshot, market, { recursive: true, errorOnExist: true });
  writeFileSync(join(project, 'README.md'), '# Design planning probe\nSynthetic read-only fixture.\n');
  const quote = value => JSON.stringify(value.replaceAll('\\', '/'));
  writeFileSync(join(home, 'config.toml'), `# Prepared only. Sandbox and provider are not initialized.\nmodel = ${JSON.stringify(args['--model'])}\nmodel_reasoning_effort = ${JSON.stringify(args['--effort'])}\napproval_policy = "never"\nweb_search = "disabled"\n[permissions.eval.filesystem]\n":root" = "read"\n${quote(workspace)} = "deny"\n${quote(snapshot)} = "deny"\n${quote(otherSnapshot)} = "deny"\n${quote(join(home, 'config.toml'))} = "deny"\n${quote(join(home, 'auth.json'))} = "deny"\n[permissions.eval.network]\nenabled = false\n`);
  const status = { ...executionGate(args), root, plan, externalProcessesStarted: 0, credentialsCopied: false, sandboxInitialized: false };
  writeFileSync(join(root, 'preparation.json'), JSON.stringify(status, null, 2));
  console.log(JSON.stringify(status));
  process.exit(2);
}
if (!args['--execute']) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }
const gate = executionGate(args);
if (gate.status === 'blocked') {
  console.log(JSON.stringify({ ...gate, plan, externalProcessesStarted: 0, credentialsCopied: false }));
  process.exit(2);
}
