import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export const sha = value => createHash('sha256').update(value).digest('hex');
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
  const allowed = new Set(['--suite', '--case', '--arm', '--baseline', '--candidate', '--binary', '--model', '--effort', '--retry-preflight', '--execute', '--prepare-only']);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!allowed.has(key) || Object.hasOwn(args, key)) throw new Error(`invalid argument: ${key}`);
    if (key === '--execute' || key === '--prepare-only') { args[key] = true; continue; }
    if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`missing value: ${key}`);
    args[key] = argv[++i];
  }
  if (!['design', 'start'].includes(args['--suite']) || !['baseline', 'candidate'].includes(args['--arm']) || !args['--case']) throw new Error('required: --suite design|start --case ID --arm baseline|candidate');
  if (args['--retry-preflight']) throw new Error('--retry-preflight is disabled; a failed runtime probe must be resolved before reuse');
  if (args['--execute'] && args['--prepare-only']) throw new Error('--execute and --prepare-only are mutually exclusive');
  if ((args['--execute'] || args['--prepare-only']) && (!isAbsolute(args['--binary'] ?? '') || !args['--model'] || !args['--effort'] || !args['--baseline'] || !args['--candidate'])) throw new Error('execution preparation requires absolute --binary, --model, --effort and both --baseline/--candidate snapshots');
  return args;
}
export function executionGate(args) {
  if (args['--execute']) return {
    status: 'blocked',
    reasonCode: 'trusted-runtime-validation-required',
    reason: 'reusable capture is available, but trusted runtime isolation and cleanup validation are still required; readiness alone cannot authorize execution or sandbox setup',
  };
  if (args['--prepare-only']) return { status: 'needs-environment', reason: 'prepared files do not verify Windows sandbox initialization or authorize model capture' };
  return { status: 'plan-only' };
}
