import { createWriteStream } from 'node:fs';
import { access, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { startCodexAppServer } from './codex-app-server-session.mjs';
import { createEvaluationHomeGuard } from './eval-home-guard.mjs';

const toolTypes = new Set(['commandExecution', 'fileChange', 'mcpToolCall', 'dynamicToolCall', 'webSearch', 'imageGeneration', 'collabToolCall', 'functionCall']);
const inside = (parent, child) => {
  const path = relative(parent, child);
  return path === '' || path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path);
};
const finishStream = stream => stream.destroyed || stream.writableFinished ? Promise.resolve() : new Promise(resolveEnd => stream.end(resolveEnd));
const exists = async path => { try { await access(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
const canonicalFuturePath = async path => {
  let current = resolve(path);
  const suffix = [];
  while (!await exists(current)) { suffix.unshift(basename(current)); current = dirname(current); }
  return resolve(await realpath(current), ...suffix).toLowerCase();
};
const overlaps = (left, right) => inside(left, right) || inside(right, left);

/** One app-server and one immutable model configuration. Each capture gets a new ephemeral thread. */
export async function createCodexCaptureSession(options) {
  const { binary, home, cwd: initialCwd, model, effort, permissionProfile = 'eval',
    timeoutMs = 12 * 60_000, maxToolCalls = 20, maxTokens = 40_000, maxOutputBytes = 16 * 1024 * 1024,
    extraBinaryArgs = [], signal } = options;
  for (const [name, value] of Object.entries({ binary, home, cwd: initialCwd })) {
    if (typeof value !== 'string' || !isAbsolute(value)) throw new Error(`${name} must be an absolute path`);
  }
  if (!model || !effort || permissionProfile !== 'eval' ||
      ![timeoutMs, maxToolCalls, maxTokens, maxOutputBytes].every(value => Number.isSafeInteger(value) && value > 0) ||
      !Array.isArray(extraBinaryArgs) || !extraBinaryArgs.every(arg => typeof arg === 'string')) throw new Error('invalid capture options');
  await readFile(join(home, '.skill-eval-home'));
  const homeGuard = createEvaluationHomeGuard(home);
  const allowedEnv = /^(PATH|PATHEXT|SystemRoot|ComSpec|WINDIR|TEMP|TMP|TMPDIR|USERPROFILE|HOME|APPDATA|LOCALAPPDATA|PROGRAMFILES(?:\(X86\))?|PROGRAMW6432|PROCESSOR_[A-Z0-9_]+|NUMBER_OF_PROCESSORS|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|GIT_CONFIG_GLOBAL|GIT_CONFIG_NOSYSTEM|GIT_OPTIONAL_LOCKS)$/i;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowedEnv.test(key)));
  env.CODEX_HOME = home;
  const realHome = (await realpath(home)).toLowerCase();
  let transport, active, opening, closing, closed = false, failed = false, busy = false, cleanupResult;
  const discoveredByCwd = new Map(), seenCwds = new Set(), seenOutputDirs = new Set(), seenThreads = new Set(), captures = [];

  const processTurnEvent = event => {
    if (!active || event.params?.threadId !== active.threadId) return;
    const eventTurnId = event.method === 'turn/completed' ? event.params.turn?.id : event.params.turnId;
    if (!active.turnId) { active.early.push(event); return; }
    if (eventTurnId !== active.turnId) return;
    if (event.method === 'item/started' && toolTypes.has(event.params.item?.type)) {
      active.toolCalls++;
      if (active.toolCalls >= maxToolCalls) transport.interrupt('maxToolCalls');
    }
    if (event.method === 'thread/tokenUsage/updated') {
      active.usage = event.params.tokenUsage;
      if ((active.usage?.total?.totalTokens ?? 0) >= maxTokens) transport.interrupt('maxTokens');
    }
    if (event.method === 'turn/completed') { active.completed = event.params.turn; active.finishTurn(); }
  };
  const onNotification = (event, line) => {
    if (!active?.threadId || event.params?.threadId !== active.threadId) return;
    active.hostEvents.write(line + '\n');
    if (['item/started', 'thread/tokenUsage/updated', 'turn/completed'].includes(event.method)) processTurnEvent(event);
  };
  const open = async () => {
    if (transport) return;
    if (opening) return opening;
    opening = (async () => {
      transport = startCodexAppServer({ binary, args: extraBinaryArgs, cwd: initialCwd, env, timeoutMs, maxOutputBytes, signal,
        onNotification, onStderr: chunk => active?.stderr.write(chunk),
        onStop: reason => { failed = true; if (active) { active.stopReason = reason; active.finishTurn(); } } });
      const initialized = await transport.rpc('initialize', { clientInfo: { name: 'zc-skill-eval-capture', version: '1.0.0' }, capabilities: { experimentalApi: true } });
      if (resolve(initialized?.codexHome ?? '') !== resolve(home)) throw new Error(`unexpected codexHome: ${initialized?.codexHome}`);
      transport.notify({ method: 'initialized', params: {} });
    })();
    try { await opening; } finally { opening = null; }
  };
  const discover = async cwd => {
    if (discoveredByCwd.has(cwd)) return discoveredByCwd.get(cwd);
    const listed = await transport.rpc('skills/list', { cwds: [cwd], forceReload: true });
    if (!Array.isArray(listed?.data) || listed.data.length !== 1 || !Array.isArray(listed.data[0].skills) ||
        typeof listed.data[0].cwd !== 'string' || resolve(listed.data[0].cwd) !== resolve(cwd) || (listed.data[0].errors ?? []).length) {
      throw new Error('skills/list incomplete or contains errors');
    }
    const skills = listed.data[0].skills.map(({ name, path, enabled, pluginId }) => ({ name, path, enabled, pluginId }));
    discoveredByCwd.set(cwd, skills);
    return skills;
  };
  const capture = async ({ cwd = initialCwd, outputDir, input, skillName } = {}) => {
    if (closed || failed || busy || active || opening && !transport) throw new Error('capture session is closed, failed, or busy');
    busy = true;
    try {
    if (typeof cwd !== 'string' || !isAbsolute(cwd) || typeof outputDir !== 'string' || !isAbsolute(outputDir) ||
        !Array.isArray(input) || !input.length ||
        !input.every(item => item?.type === 'text' && typeof item.text === 'string' || item?.type === 'skill' && typeof item.name === 'string' && isAbsolute(item.path))) {
      throw new Error('invalid capture options');
    }
    const cwdKey = (await realpath(cwd)).toLowerCase(), outputKey = await canonicalFuturePath(outputDir);
    if (overlaps(realHome, cwdKey) || overlaps(realHome, outputKey) || overlaps(cwdKey, outputKey) ||
        [...seenCwds].some(path => overlaps(path, cwdKey) || overlaps(path, outputKey)) ||
        [...seenOutputDirs].some(path => overlaps(path, cwdKey) || overlaps(path, outputKey))) {
      throw new Error('each case requires non-overlapping cwd and outputDir outside home');
    }
    homeGuard.assertReusable();
    try { if ((await readdir(outputDir)).length) throw new Error('outputDir must be empty'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; await mkdir(outputDir, { recursive: true }); }
    seenCwds.add(cwdKey); seenOutputDirs.add(outputKey);
    const hostEvents = createWriteStream(join(outputDir, 'host-events.jsonl'), { flags: 'wx' });
    const stderr = createWriteStream(join(outputDir, 'stderr.log'), { flags: 'wx' });
    const streamErrors = [];
    const receipt = { status: 'inconclusive', reason: null, model, effort, permissionProfile, home, cwd, outputDir,
      requestedSkill: skillName ?? null, resolvedSkill: null, discoveredSkills: [], threadId: null, turnId: null,
      turnInput: null, usage: null, toolCalls: 0, turnStatus: null, cleanupUnconfirmed: false, cleanupEvidence: null,
      cleanupScope: process.platform === 'win32' ? 'Windows process tree' : 'single process only; real study requires Windows',
      budgets: { timeoutMs, maxToolCalls, maxTokens, maxOutputBytes, enforcement: 'observed event limits; session-wide transport limits' } };
    let finishTurn;
    const turnDone = new Promise(resolveDone => { finishTurn = resolveDone; });
    active = { hostEvents, stderr, receipt, early: [], threadId: null, turnId: null, toolCalls: 0,
      usage: null, completed: null, stopReason: null, finishTurn };
    for (const [name, stream] of [['host-events', hostEvents], ['stderr', stderr]]) {
      stream.on('error', error => { streamErrors.push(`${name}: ${error.message}`); transport?.interrupt(`log write error: ${name}`); });
    }
    captures.push(receipt);
    try {
      await open();
      if (transport.stopReason) throw new Error(transport.stopReason);
      receipt.discoveredSkills = await discover(cwd);
      let turnInput = [...input];
      if (skillName) {
        const matches = receipt.discoveredSkills.filter(skill => skill.name === skillName && skill.enabled === true && isAbsolute(skill.path));
        if (matches.length !== 1) throw new Error(`skill discovery did not uniquely resolve enabled ${skillName}`);
        receipt.resolvedSkill = matches[0];
        turnInput = [...turnInput, { type: 'skill', name: matches[0].name, path: matches[0].path }];
      }
      receipt.turnInput = turnInput;
      const response = await transport.rpc('thread/start', { cwd, model, permissions: permissionProfile, approvalPolicy: 'never', ephemeral: true,
        config: { model_reasoning_effort: effort }, runtimeWorkspaceRoots: [cwd] });
      if (resolve(response?.cwd ?? '') !== resolve(cwd) || response.model !== model || response.reasoningEffort !== effort ||
          response.approvalPolicy !== 'never' || response.activePermissionProfile?.id !== permissionProfile || !response.thread?.id ||
          seenThreads.has(response.thread.id)) throw new Error('thread/start effective configuration mismatch');
      seenThreads.add(response.thread.id);
      active.threadId = response.thread.id; receipt.threadId = active.threadId;
      receipt.effectiveConfig = { cwd: response.cwd, model: response.model, reasoningEffort: response.reasoningEffort,
        approvalPolicy: response.approvalPolicy, activePermissionProfile: response.activePermissionProfile,
        runtimeWorkspaceRoots: response.runtimeWorkspaceRoots };
      const started = await transport.rpc('turn/start', { threadId: active.threadId, input: turnInput, effort });
      active.turnId = started?.turn?.id;
      if (!active.turnId) throw new Error('turn/start omitted turn id');
      receipt.turnId = active.turnId;
      for (const event of active.early) processTurnEvent(event);
      active.early.length = 0;
      await turnDone;
      receipt.turnStatus = active.completed?.status ?? null;
      receipt.status = active.completed?.status === 'completed' && !active.stopReason ? 'pending-cleanup' : 'inconclusive';
      receipt.reason = active.stopReason ?? (active.completed?.status === 'completed' ? null : `turn status: ${active.completed?.status ?? 'missing completion'}`);
    } catch (error) {
      receipt.reason = error.message; receipt.status = 'inconclusive';
      if (transport && !transport.stopReason) transport.interrupt(`capture failed: ${error.message}`);
    }
    finally {
      receipt.usage = active.usage;
      receipt.toolCalls = active.toolCalls;
      if (streamErrors.length) { receipt.status = 'inconclusive'; receipt.reason = [receipt.reason, ...streamErrors].filter(Boolean).join('; '); }
      if (receipt.status !== 'pending-cleanup') failed = true;
      active = null;
      await Promise.all([finishStream(hostEvents), finishStream(stderr)]);
      await writeFile(join(outputDir, 'capture.json'), JSON.stringify(receipt, null, 2) + '\n');
    }
    return receipt;
    } finally { busy = false; }
  };
  const close = async () => {
    if (closing) return closing;
    if (cleanupResult) return cleanupResult;
    if (busy || active) throw new Error('cannot close while capture is active');
    closed = true;
    closing = (async () => {
      try { cleanupResult = transport ? await transport.close() : { cleanupUnconfirmed: false, cleanupEvidence: { processStarted: false }, stopReason: null }; }
      catch (error) { cleanupResult = { cleanupUnconfirmed: true, cleanupEvidence: { error: error.message }, stopReason: 'cleanup failed' }; }
      if (cleanupResult.cleanupUnconfirmed || cleanupResult.stopReason) failed = true;
      await homeGuard.recordCleanup(cleanupResult);
      for (const receipt of captures) {
        receipt.cleanupUnconfirmed = cleanupResult.cleanupUnconfirmed;
        receipt.cleanupEvidence = cleanupResult.cleanupEvidence;
        if (cleanupResult.cleanupUnconfirmed) receipt.cleanupBlockPersisted = cleanupResult.cleanupBlockPersisted;
        if (receipt.status === 'pending-cleanup') receipt.status = cleanupResult.cleanupUnconfirmed || cleanupResult.stopReason ? 'inconclusive' : 'complete';
        if (cleanupResult.cleanupUnconfirmed || cleanupResult.stopReason) receipt.reason = [receipt.reason,
          cleanupResult.cleanupUnconfirmed && 'app-server process tree cleanup unconfirmed', cleanupResult.stopReason].filter(Boolean).join('; ');
        if (cleanupResult.cleanupUnconfirmed && !cleanupResult.cleanupBlockPersisted) {
          receipt.reason = [receipt.reason, `cleanup block not persisted: ${cleanupResult.cleanupBlockError}`].filter(Boolean).join('; ');
        }
        await writeFile(join(receipt.outputDir, 'capture.json'), JSON.stringify(receipt, null, 2) + '\n');
      }
      return cleanupResult;
    })();
    return closing;
  };
  return { capture, close, get status() { return closed ? 'closed' : failed ? 'failed' : busy ? 'busy' : 'ready'; } };
}

/** Compatibility API: one case uses the same reusable session collector. */
export async function captureCodex(options) {
  const session = await createCodexCaptureSession(options);
  let receipt;
  try { receipt = await session.capture(options); }
  finally { await session.close(); }
  return receipt;
}
