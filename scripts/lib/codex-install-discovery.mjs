import { readdirSync, realpathSync } from 'node:fs';
import { join, relative, resolve, sep, isAbsolute } from 'node:path';
import { auditDistribution } from '../skill-distribution-audit.mjs';

const within = (root, candidate) => {
  const rel = relative(root, candidate);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};

export function installedSkillPaths(home) {
  const cache = join(home, 'plugins', 'cache');
  const roots = [];
  for (const market of readdirSync(cache, { withFileTypes: true }).filter(x => x.isDirectory())) {
    const plugin = join(cache, market.name, 'zc-toolkit');
    let versions;
    try { versions = readdirSync(plugin, { withFileTypes: true }); } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const version of versions.filter(x => x.isDirectory())) roots.push(join(plugin, version.name));
  }
  if (roots.length !== 1) throw new Error(`expected one installed zc-toolkit root, found ${roots.length}`);
  const root = realpathSync(roots[0]);
  const skillsDir = join(root, 'skills');
  const paths = new Map();
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const file = join(skillsDir, entry.name, 'SKILL.md');
    let actual;
    try { actual = realpathSync(file); } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (actual !== resolve(file) || !within(root, actual)) throw new Error(`unsafe installed skill path: ${file}`);
    paths.set(entry.name, actual);
  }
  if (!paths.size) throw new Error('installed zc-toolkit has no SKILL.md files');
  return { root, sourceRoot: resolve(roots[0]), paths };
}

export function auditInstalledDiscovery(installed, records, required = []) {
  if (!Array.isArray(records)) throw new Error('skills/list records must be an array');
  const expected = [...installed.paths.keys()].sort();
  const discovered = [];
  const pathIssues = [];
  for (const record of records) {
    if (record?.enabled !== true || typeof record.name !== 'string' || typeof record.path !== 'string') continue;
    const name = record.name.startsWith('zc-toolkit:') ? record.name.slice('zc-toolkit:'.length) : record.name;
    const expectedPath = installed.paths.get(name);
    if (!isAbsolute(record.path)) { pathIssues.push({ name, path: record.path }); continue; }
    const actual = resolve(record.path);
    const inPluginSkills = within(join(installed.root, 'skills'), actual) ||
      within(join(installed.sourceRoot, 'skills'), actual);
    if (!expectedPath) {
      if (inPluginSkills) discovered.push(name);
      continue;
    }
    let canonical;
    try { canonical = realpathSync(actual); } catch { canonical = null; }
    const equalPath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
    if (!canonical || !equalPath(canonical, expectedPath) ||
        !(within(installed.root, actual) || within(installed.sourceRoot, actual))) {
      // Same-name records from another plugin cannot establish discovery of this installation.
      if (within(installed.root, actual)) pathIssues.push({ name, path: record.path });
      continue;
    }
    discovered.push(name);
  }
  const revision = installed.root;
  const audit = auditDistribution({ schemaVersion: 1, consumer: { name: 'codex-app-server', version: 'local' },
    intended: { sourceRevision: revision, identities: expected },
    manifest: { sourceRevision: revision, identities: expected },
    discovered: { sourceRevision: revision, consumer: { name: 'codex-app-server', version: 'local' }, complete: true, identities: discovered, errors: [] } });
  const missingRequired = required.filter(name => !discovered.includes(name));
  return { scope: 'installed-file-inventory-vs-host-discovery',
    status: audit.status === 'pass' && !pathIssues.length && !missingRequired.length ? 'pass' : 'mismatch',
    expectedCount: expected.length, discoveredCount: discovered.length, audit, pathIssues, missingRequired };
}
