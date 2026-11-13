import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const sha = value => createHash('sha256').update(value).digest('hex');
export function assessCapture(capture, integrity) {
  const required = ['snapshotUnchanged', 'suiteUnchanged', 'fixtureUnchanged', 'hostConfigUnchanged', 'hostAuthUnchanged'];
  const failures = required.filter(key => integrity[key] !== true);
  if (capture.status !== 'complete') failures.push('captureIncomplete');
  if (capture.cleanupUnconfirmed !== false) failures.push('cleanupUnconfirmed');
  return { validCapture: failures.length === 0, assessment: failures.length ? 'inconclusive' : 'pending independent scoring', invalidReasons: failures };
}
export const inside = (parent, child) => {
  const rel = relative(parent, child);
  return rel === '' || rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
};
export function workspaceSnapshot(workspace, candidate) {
  if (!candidate || !isAbsolute(candidate)) throw new Error('snapshot must be an absolute path');
  const root = resolve(workspace, '.cache');
  const path = resolve(candidate);
  if (!inside(root, path) || path === root || !inside(realpathSync(root), realpathSync(path))) throw new Error('snapshot must be within workspace .cache');
  if (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink()) throw new Error('snapshot must be a directory');
  return path;
}
export function retryPreflightRoot(workspace, candidate, caseId, arm) {
  const root = workspaceSnapshot(workspace, candidate);
  if (!basename(root).startsWith(`design-study-${caseId}-${arm}-`)) throw new Error('retry case/arm mismatch');
  // Inspect the entire existing tree before following metadata or writing credentials/config.
  const realRoot = realpathSync(root);
  const inspect = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name), stat = lstatSync(path);
      if (stat.isSymbolicLink() || !inside(realRoot, realpathSync(path))) throw new Error('retry links are forbidden');
      if (stat.isDirectory()) inspect(path);
      else if (!stat.isFile() || stat.nlink !== 1) throw new Error('retry linked or special files are forbidden');
    }
  };
  inspect(root);
  const failure = JSON.parse(readFileSync(join(root, 'failure.json'), 'utf8'));
  if (failure.phase !== 'preflight' || failure.infrastructureFailure !== true ||
      existsSync(join(root, 'frozen.json')) || existsSync(join(root, 'evidence')) || existsSync(join(root, 'home/auth.json'))) {
    throw new Error('only a failed preflight without credentials or model capture can be retried');
  }
  if (!readFileSync(join(root, 'home/.skill-eval-home'), 'utf8').includes('disposable')) throw new Error('missing disposable home marker');
  return root;
}
export function snapshotFiles(root) {
  const files = {};
  const walk = (dir, prefix = '') => {
    for (const item of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (item.isSymbolicLink()) throw new Error('snapshot symlinks are forbidden');
      const rel = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.isDirectory()) walk(join(dir, item.name), rel);
      else if (item.isFile()) files[rel] = sha(readFileSync(join(dir, item.name)));
      else throw new Error('snapshot contains unsupported file type');
    }
  };
  walk(root);
  for (const required of ['.agents/plugins/marketplace.json', 'plugins/zc-toolkit/skills/start/SKILL.md', 'plugins/zc-toolkit/skills/visual-refinement/SKILL.md']) {
    if (!files[required]) throw new Error(`snapshot missing ${required}`);
  }
  return files;
}
export function selectCase(suite, id) {
  const matches = suite.cases?.filter(item => item.id === id) ?? [];
  if (matches.length !== 1 || typeof matches[0].input !== 'string') throw new Error(`case missing or duplicated: ${id}`);
  return { id: matches[0].id, input: matches[0].input };
}
export function parseArgs(argv) {
  const allowed = new Set(['--suite', '--case', '--arm', '--baseline', '--candidate', '--binary', '--model', '--effort', '--retry-preflight', '--execute']);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!allowed.has(key) || Object.hasOwn(args, key)) throw new Error(`invalid argument: ${key}`);
    if (key === '--execute') { args[key] = true; continue; }
    if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`missing value: ${key}`);
    args[key] = argv[++i];
  }
  if (!['design', 'start'].includes(args['--suite']) || !['baseline', 'candidate'].includes(args['--arm']) || !args['--case']) throw new Error('required: --suite design|start --case ID --arm baseline|candidate');
  if (args['--execute'] && (!isAbsolute(args['--binary'] ?? '') || !args['--model'] || !args['--effort'] || !args['--baseline'] || !args['--candidate'])) throw new Error('--execute requires absolute --binary, --model, --effort and both --baseline/--candidate snapshots');
  return args;
}
export function producerInput(item, suite, installed) {
  const name = suite === 'start' ? 'start' : 'visual-refinement';
  return [{ type: 'text', text: item.input, text_elements: [] }, { type: 'skill', name: `zc-toolkit:${name}`, path: join(installed, 'skills', name, 'SKILL.md') }];
}
