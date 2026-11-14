import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { startCodexAppServer } from './codex-app-server-session.mjs';
import { createEvaluationHomeGuard } from './eval-home-guard.mjs';

const inside = (parent, child) => {
  const rel = relative(parent, child);
  return rel === '' || rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
};

/** Reuse one credential-free home and app-server for discovery probes in a batch.
 * This is deliberately discovery-only. Model execution needs a separately verified sandbox runner.
 */
export function createReusableEvaluationEnvironment({ workspace, home, cwd, binary, binaryArgs = [], env,
  timeoutMs = 45_000, maxOutputBytes = 1024 * 1024, signal, onStderr }) {
  if (![workspace, home, cwd, binary].every(path => typeof path === 'string' && isAbsolute(path))) throw new Error('absolute workspace, home, cwd and binary required');
  if (!Array.isArray(binaryArgs) || !binaryArgs.every(arg => typeof arg === 'string')) throw new Error('invalid binaryArgs');
  const cache = realpathSync(join(workspace, '.cache'));
  if (!inside(cache, realpathSync(home)) || !inside(cache, realpathSync(cwd))) throw new Error('evaluation paths must stay within workspace .cache');
  if (!readFileSync(join(home, '.skill-eval-home'), 'utf8').includes('disposable')) throw new Error('disposable evaluation home marker required');
  const homeGuard = createEvaluationHomeGuard(home);
  const allowedEnv = /^(PATH|PATHEXT|SystemRoot|ComSpec|WINDIR|TEMP|TMP|TMPDIR|USERPROFILE|HOME|APPDATA|LOCALAPPDATA|PROGRAMFILES(?:\(X86\))?|PROGRAMW6432|PROCESSOR_[A-Z0-9_]+|NUMBER_OF_PROCESSORS|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY)$/i;
  const sessionEnv = Object.fromEntries(Object.entries(env ?? process.env).filter(([key]) => allowedEnv.test(key)));
  sessionEnv.CODEX_HOME = home;
  let session, opening, closing, stopReason, cleanupResult;
  const cleanup = async () => {
    if (cleanupResult) return cleanupResult;
    try { cleanupResult = session ? await session.close() : { cleanupUnconfirmed: false, cleanupEvidence: { processStarted: false } }; }
    catch (error) { cleanupResult = { cleanupUnconfirmed: true, cleanupEvidence: { error: error.message } }; }
    await homeGuard.recordCleanup(cleanupResult);
    session = null;
    return cleanupResult;
  };
  const open = async () => {
    if (stopReason) throw new Error(`evaluation batch stopped: ${stopReason}`);
    try { homeGuard.assertReusable(); }
    catch (error) { stopReason = error.message; session?.interrupt(stopReason); throw error; }
    if (opening) return opening;
    if (session) return;
    opening = (async () => {
      session = startCodexAppServer({ binary, args: binaryArgs, cwd, env: sessionEnv, timeoutMs, maxOutputBytes, signal,
        onStderr, onStop: reason => { stopReason = reason; } });
      try {
        const init = await session.rpc('initialize', { clientInfo: { name: 'zc-reusable-eval-discovery', version: '1.0.0' }, capabilities: { experimentalApi: true } });
        if (resolve(init?.codexHome ?? '') !== resolve(home)) throw new Error('unexpected codexHome');
        session.notify({ method: 'initialized', params: {} });
      } catch (error) {
        stopReason = error.message;
        await cleanup();
        throw error;
      }
    })();
    try { await opening; } finally { opening = null; }
  };
  return {
    get status() { return stopReason ? 'stopped' : session ? 'discovery-only' : 'needs-environment'; },
    get stopReason() { return stopReason; },
    async discoverSkills() {
      await open();
      if (stopReason) throw new Error(`evaluation batch stopped: ${stopReason}`);
      try {
        const result = await session.rpc('skills/list', { cwds: [cwd], forceReload: true });
        if (!Array.isArray(result?.data) || result.data.length !== 1 ||
            typeof result.data[0].cwd !== 'string' || !isAbsolute(result.data[0].cwd) || resolve(result.data[0].cwd) !== resolve(cwd) ||
            !Array.isArray(result.data[0].skills) || (result.data[0].errors ?? []).length) {
          throw new Error('skills/list incomplete or contains errors');
        }
        return result.data[0].skills;
      } catch (error) {
        stopReason = error.message;
        session?.interrupt(stopReason);
        throw error;
      }
    },
    stop(reason = 'cancelled') { stopReason = reason; session?.interrupt(reason); },
    async close() {
      if (closing) return closing;
      if (!stopReason) stopReason = 'closed';
      closing = (async () => {
        if (opening) { try { await opening; } catch { /* Preserve its cleanup evidence. */ } }
        return cleanup();
      })();
      return closing;
    },
  };
}
