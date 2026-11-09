import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { isAbsolute, relative, resolve, sep, join } from 'node:path';

const toolTypes = new Set(['commandExecution', 'fileChange', 'mcpToolCall', 'dynamicToolCall', 'webSearch', 'imageGeneration', 'collabToolCall', 'functionCall']);
const inside = (parent, child) => child === parent || (!relative(parent, child).startsWith('..' + sep) && relative(parent, child) !== '..' && !isAbsolute(relative(parent, child)));
const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));

/** Capture one isolated Codex app-server turn. Budgets are observed event limits, not provider hard caps. */
export async function captureCodex(options) {
  const { binary, home, cwd, outputDir, model, effort, permissionProfile = 'eval', input, skillName,
    timeoutMs = 12 * 60_000, maxToolCalls = 20, maxTokens = 40_000, maxOutputBytes = 16 * 1024 * 1024, extraBinaryArgs = [] } = options;
  for (const [name, value] of Object.entries({ binary, home, cwd, outputDir })) {
    if (typeof value !== 'string' || !isAbsolute(value)) throw new Error(`${name} must be an absolute path`);
  }
  if (new Set([home, cwd, outputDir].map(path => resolve(path).toLowerCase())).size !== 3 || inside(resolve(home), resolve(outputDir)) || inside(resolve(cwd), resolve(outputDir))) {
    throw new Error('home, cwd and outputDir must be separate; outputDir must be outside home and cwd');
  }
  if (!model || !effort || permissionProfile !== 'eval' || !Array.isArray(input) || input.length === 0 ||
      !input.every(item => item?.type === 'text' && typeof item.text === 'string' || item?.type === 'skill' && typeof item.name === 'string' && isAbsolute(item.path)) ||
      ![timeoutMs, maxToolCalls, maxTokens, maxOutputBytes].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error('invalid capture options');
  if (!Array.isArray(extraBinaryArgs) || !extraBinaryArgs.every(arg => typeof arg === 'string')) throw new Error('invalid extraBinaryArgs');
  await readFile(join(home, '.skill-eval-home'));
  try { if ((await readdir(outputDir)).length) throw new Error('outputDir must be empty'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; await mkdir(outputDir, { recursive: true }); }

  const allowedEnv = /^(PATH|PATHEXT|SystemRoot|ComSpec|WINDIR|TEMP|TMP|TMPDIR|USERPROFILE|HOME|APPDATA|LOCALAPPDATA|PROGRAMFILES(?:\(X86\))?|PROGRAMW6432|PROCESSOR_[A-Z0-9_]+|NUMBER_OF_PROCESSORS|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|GIT_CONFIG_GLOBAL|GIT_CONFIG_NOSYSTEM|GIT_OPTIONAL_LOCKS)$/i;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowedEnv.test(key)));
  env.CODEX_HOME = home;
  const hostEvents = createWriteStream(join(outputDir, 'host-events.jsonl'), { flags: 'wx' });
  const stderr = createWriteStream(join(outputDir, 'stderr.log'), { flags: 'wx' });
  const child = spawn(binary, [...extraBinaryArgs, 'app-server', '--stdio'], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const streamErrors = [], protocolErrors = [];
  let cleaningUp = false;
  for (const [name, stream] of [['host-events', hostEvents], ['stderr', stderr]]) {
    stream.on('error', error => { streamErrors.push(`${name}: ${error.message}`); interrupt(`log write error: ${name}`); });
  }
  let hostBytes = 0, stderrBytes = 0;
  child.stderr.on('data', chunk => {
    if (stderrBytes >= maxOutputBytes) { interrupt('maxOutputBytes: stderr'); return; }
    const remaining = maxOutputBytes - stderrBytes;
    stderr.write(chunk.subarray(0, remaining));
    stderrBytes += chunk.length;
    if (stderrBytes > maxOutputBytes) interrupt('maxOutputBytes: stderr');
  });
  const pending = new Map();
  let nextId = 0, threadId, turnId, completed, usage, toolCalls = 0, stopReason, exited = false, fatal;
  const earlyEvents = [];
  let finishTurn;
  const turnDone = new Promise(resolveDone => { finishTurn = resolveDone; });
  const capture = { status: 'inconclusive', reason: null, model, effort, permissionProfile, home, cwd, outputDir,
    requestedSkill: skillName ?? null, resolvedSkill: null, discoveredSkills: [], threadId: null, turnId: null,
    turnInput: null, usage: null, toolCalls: 0, turnStatus: null,
    cleanupUnconfirmed: false, cleanupEvidence: null,
    cleanupScope: process.platform === 'win32' ? 'Windows process tree' : 'single process only; real study requires Windows',
    budgets: { timeoutMs, maxToolCalls, maxTokens, maxOutputBytes, enforcement: 'observed event limits' } };
  const rejectPending = error => { for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); } pending.clear(); };
  const write = message => { if (!child.stdin.destroyed && child.stdin.writable) child.stdin.write(JSON.stringify(message) + '\n'); };
  const rpc = (method, params, ms = Math.min(timeoutMs, 30_000)) => new Promise((resolveRequest, reject) => {
    if (stopReason && method !== 'turn/interrupt') return reject(new Error(stopReason));
    if (exited || fatal) return reject(fatal ?? new Error('app-server exited'));
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`RPC timeout: ${method}`)); }, ms);
    pending.set(id, { resolve: resolveRequest, reject, timer });
    write({ id, method, params });
  });
  const interrupt = reason => {
    if (stopReason || completed) return;
    stopReason = reason;
    rejectPending(new Error(reason));
    if (threadId && turnId) rpc('turn/interrupt', { threadId, turnId }, 3_000).catch(() => {});
    finishTurn();
  };
  const deadline = setTimeout(() => interrupt('deadline'), timeoutMs);
  const processTurnEvent = event => {
    if (event.params?.threadId !== threadId) return;
    const eventTurnId = event.method === 'turn/completed' ? event.params.turn?.id : event.params.turnId;
    if (eventTurnId !== turnId) return;
    if (event.method === 'item/started' && toolTypes.has(event.params.item?.type)) {
      toolCalls++;
      if (toolCalls >= maxToolCalls) interrupt('maxToolCalls');
    }
    if (event.method === 'thread/tokenUsage/updated') {
      usage = event.params.tokenUsage;
      if ((usage?.total?.totalTokens ?? 0) >= maxTokens) interrupt('maxTokens');
    }
    if (event.method === 'turn/completed') {
      completed = event.params.turn;
      finishTurn();
    }
  };
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  lines.on('line', line => {
    let event;
    try { event = JSON.parse(line); } catch { protocolErrors.push('invalid JSON-RPC stdout'); interrupt('invalid JSON-RPC stdout'); return; }
    if (!event || typeof event !== 'object' || Array.isArray(event) || (event.id == null && typeof event.method !== 'string')) {
      protocolErrors.push('invalid JSON-RPC stdout');
      interrupt('invalid JSON-RPC stdout'); return;
    }
    if (event.id != null && event.method) {
      // Never persist server-initiated requests, which may contain credential prompts.
      write({ id: event.id, error: { code: -32000, message: 'Evaluation capture rejects server requests' } });
      interrupt(`server request: ${event.method}`);
      return;
    }
    if (event.id != null) {
      const request = pending.get(event.id);
      if (request) { clearTimeout(request.timer); pending.delete(event.id); event.error ? request.reject(new Error(JSON.stringify(event.error))) : request.resolve(event.result); }
      return;
    }
    if (!event.method) return;
    const eventLine = line + '\n';
    const lineBytes = Buffer.byteLength(eventLine);
    if (hostBytes + lineBytes > maxOutputBytes) {
      interrupt('maxOutputBytes: host-events');
      return;
    }
    hostEvents.write(eventLine);
    hostBytes += lineBytes;
    if (!['item/started', 'thread/tokenUsage/updated', 'turn/completed'].includes(event.method)) return;
    if (event.params?.threadId !== threadId) return;
    if (!turnId) earlyEvents.push(event);
    else processTurnEvent(event);
  });
  child.stdout.on('error', error => interrupt(`stdout read error: ${error.message}`));
  lines.on('error', error => interrupt(`stdout read error: ${error.message}`));
  child.stdin.on('error', error => { if (!cleaningUp) interrupt(`stdin write error: ${error.message}`); });
  const onExit = (code, signal) => {
    exited = true;
    fatal = new Error(`app-server exited before capture completed (${code ?? signal ?? 'unknown'})`);
    rejectPending(fatal);
    finishTurn();
  };
  child.once('exit', onExit);
  child.once('error', error => { fatal = error; rejectPending(error); finishTurn(); });
  try {
    const initialized = await rpc('initialize', { clientInfo: { name: 'zc-skill-eval-capture', version: '1.0.0' }, capabilities: { experimentalApi: true } });
    if (resolve(initialized?.codexHome ?? '') !== resolve(home)) throw new Error(`unexpected codexHome: ${initialized?.codexHome}`);
    write({ method: 'initialized', params: {} });
    const skills = await rpc('skills/list', { cwds: [cwd], forceReload: true });
    if (!Array.isArray(skills?.data) || skills.data.length !== 1 || !Array.isArray(skills.data[0].skills) || skills.data[0].cwd && resolve(skills.data[0].cwd) !== resolve(cwd) || (skills.data[0].errors ?? []).length) throw new Error('skills/list incomplete or contains errors');
    capture.discoveredSkills = skills.data[0].skills.map(({ name, path, enabled, pluginId }) => ({ name, path, enabled, pluginId }));
    let turnInput = [...input];
    if (skillName) {
      const matches = capture.discoveredSkills.filter(skill => skill.name === skillName && skill.enabled === true && isAbsolute(skill.path));
      if (matches.length !== 1) throw new Error(`skill discovery did not uniquely resolve enabled ${skillName}`);
      capture.resolvedSkill = matches[0];
      turnInput = [...turnInput, { type: 'skill', name: matches[0].name, path: matches[0].path }];
    }
    capture.turnInput = turnInput;
    const response = await rpc('thread/start', { cwd, model, permissions: permissionProfile, approvalPolicy: 'never', ephemeral: true,
      config: { model_reasoning_effort: effort }, runtimeWorkspaceRoots: [cwd] });
    if (resolve(response?.cwd ?? '') !== resolve(cwd) || response.model !== model || response.reasoningEffort !== effort ||
      response.approvalPolicy !== 'never' || response.activePermissionProfile?.id !== permissionProfile) throw new Error('thread/start effective configuration mismatch');
    threadId = response.thread?.id;
    if (!threadId) throw new Error('thread/start omitted thread id');
    capture.threadId = threadId;
    capture.effectiveConfig = { cwd: response.cwd, model: response.model, reasoningEffort: response.reasoningEffort,
      approvalPolicy: response.approvalPolicy, activePermissionProfile: response.activePermissionProfile,
      runtimeWorkspaceRoots: response.runtimeWorkspaceRoots };
    const started = await rpc('turn/start', { threadId, input: turnInput, effort });
    turnId = started?.turn?.id;
    if (!turnId) throw new Error('turn/start omitted turn id');
    capture.turnId = turnId;
    for (const event of earlyEvents) processTurnEvent(event);
    earlyEvents.length = 0;
    await turnDone;
    if (stopReason && !completed) await delay(250);
    if (fatal && !completed) throw fatal;
    capture.turnStatus = completed?.status ?? null;
    capture.status = completed?.status === 'completed' && !stopReason ? 'complete' : 'inconclusive';
    capture.reason = stopReason ?? (completed?.status === 'completed' ? null : `turn status: ${completed?.status ?? 'missing completion'}`);
  } catch (error) {
    capture.reason = error.message;
  } finally {
    clearTimeout(deadline);
    capture.usage = usage ?? null;
    capture.toolCalls = toolCalls;
    rejectPending(new Error('capture closed'));
    cleaningUp = true;
    lines.close();
    const waitExit = ms => exited ? Promise.resolve(true) : Promise.race([
      new Promise(resolveExit => child.once('exit', () => resolveExit(true))), delay(ms).then(() => false),
    ]);
    if (process.platform === 'win32') {
      if (exited || !child.pid) {
        capture.cleanupUnconfirmed = true;
        capture.cleanupEvidence = exited ? 'app-server exited before process-tree cleanup' : 'missing app-server PID';
      } else {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        const outcome = await Promise.race([
          new Promise(resolveKill => { killer.once('exit', (code, signal) => resolveKill({ code, signal })); killer.once('error', error => resolveKill({ error: error.message })); }),
          delay(2_000).then(() => ({ timeout: true })),
        ]);
        await waitExit(2_000);
        capture.cleanupEvidence = { command: 'taskkill /PID /T /F', pid: child.pid, outcome, parentExited: exited };
        capture.cleanupUnconfirmed = outcome.code !== 0 || !exited;
      }
      if (!exited) { child.kill('SIGKILL'); await waitExit(500); }
      child.stdin.end();
    } else {
      child.stdin.end();
      if (!await waitExit(500)) child.kill('SIGTERM');
      if (!await waitExit(2_000)) {
        child.kill('SIGKILL');
        await waitExit(2_000);
      }
      capture.cleanupUnconfirmed = !exited;
      capture.cleanupEvidence = { parentExited: exited, scope: 'single process only' };
    }
    const finishStream = stream => stream.destroyed || stream.writableFinished ? Promise.resolve() : new Promise(resolveEnd => stream.end(resolveEnd));
    await Promise.all([finishStream(hostEvents), finishStream(stderr)]);
    if (capture.cleanupUnconfirmed || streamErrors.length || protocolErrors.length) {
      capture.status = 'inconclusive';
      capture.reason = [capture.reason, capture.cleanupUnconfirmed && 'app-server process tree cleanup unconfirmed', ...streamErrors, ...protocolErrors].filter(Boolean).join('; ');
    }
    await writeFile(join(outputDir, 'capture.json'), JSON.stringify(capture, null, 2) + '\n');
  }
  return capture;
}
