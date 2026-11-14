import { lstatSync, realpathSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const cleanupBlockName = '.eval-capture-cleanup-unconfirmed.json';
const present = path => {
  try { lstatSync(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
};

/** Shared discovery/capture guard; cleanup evidence never authorizes model execution. */
export function createEvaluationHomeGuard(home) {
  const canonicalHome = realpathSync(home), identity = lstatSync(home);
  const assertIdentity = () => {
    const current = lstatSync(home);
    if (!current.isDirectory() || current.isSymbolicLink() || realpathSync(home) !== canonicalHome ||
        current.dev !== identity.dev || current.ino !== identity.ino) {
      throw new Error('evaluation home identity changed or is not an owned directory');
    }
  };
  const assertReusable = () => {
    assertIdentity();
    if (present(join(home, 'auth.json'))) throw new Error('evaluation home must not contain copied auth');
    if (present(join(home, cleanupBlockName))) throw new Error('evaluation home blocked by unconfirmed cleanup');
  };
  assertReusable();
  return {
    assertReusable,
    async recordCleanup(result) {
      if (!result.cleanupUnconfirmed) return result;
      try {
        assertIdentity();
        await writeFile(join(home, cleanupBlockName), JSON.stringify({ status: 'cleanup-unconfirmed', createdAt: new Date().toISOString() }) + '\n', { flag: 'wx' });
        result.cleanupBlockPersisted = true;
      } catch (error) {
        result.cleanupBlockPersisted = false;
        result.cleanupBlockError = error.message;
      }
      return result;
    },
  };
}
