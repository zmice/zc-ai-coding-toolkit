import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Bounded JSON-RPC transport for an app-server owned by this process. */
export function startCodexAppServer({ binary, args = [], cwd, env, timeoutMs, maxOutputBytes,
  signal, onNotification = () => {}, onStderr = () => {}, onStop = () => {} }) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0) {
    throw new Error('positive timeoutMs and maxOutputBytes required');
  }
  if (signal?.aborted) throw new Error('cancelled before app-server startup');
  const child = spawn(binary, [...args, 'app-server', '--stdio'], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const pending = new Map();
  let nextId = 0, exited = false, stopReason = null, closing = false, stdoutBytes = 0, stderrBytes = 0;
  const rejectPending = error => { for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); } pending.clear(); };
  const interrupt = reason => {
    if (stopReason || closing) return;
    stopReason = reason;
    rejectPending(new Error(reason));
    onStop(reason);
  };
  const deadline = setTimeout(() => interrupt('deadline'), timeoutMs);
  const abort = () => interrupt('cancelled');
  signal?.addEventListener('abort', abort, { once: true });
  child.stderr.on('data', chunk => {
    const remaining = Math.max(0, maxOutputBytes - stderrBytes);
    stderrBytes += chunk.length;
    try { if (remaining) onStderr(chunk.subarray(0, remaining)); } catch (error) { interrupt(`stderr consumer: ${error.message}`); }
    if (stderrBytes > maxOutputBytes) interrupt('maxOutputBytes: stderr');
  });
  // Count raw chunks before readline can buffer a long line with no newline.
  child.stdout.on('data', chunk => {
    stdoutBytes += chunk.length;
    if (stdoutBytes > maxOutputBytes) { interrupt('maxOutputBytes: stdout'); child.stdout.pause(); }
  });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  lines.on('line', line => {
    if (stopReason) return;
    let message;
    try { message = JSON.parse(line); } catch { interrupt('invalid JSON-RPC stdout'); return; }
    if (!message || typeof message !== 'object' || Array.isArray(message) || (message.id == null && typeof message.method !== 'string')) {
      interrupt('invalid JSON-RPC stdout'); return;
    }
    if (message.id != null && message.method) {
      // Reject server prompts before they reach a consumer or persistent event log.
      notify({ id: message.id, error: { code: -32000, message: 'Evaluation session rejects server requests' } });
      interrupt(`server request: ${message.method}`);
      return;
    }
    if (message.id != null) {
      const request = pending.get(message.id);
      if (request) { clearTimeout(request.timer); pending.delete(message.id); message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result); }
      return;
    }
    try { onNotification(message, line); }
    catch (error) { interrupt(`notification consumer: ${error.message}`); }
  });
  lines.on('error', error => interrupt(`stdout read error: ${error.message}`));
  child.stdout.on('error', error => interrupt(`stdout read error: ${error.message}`));
  child.stdin.on('error', error => { if (!closing) interrupt(`stdin write error: ${error.message}`); });
  child.once('error', error => { interrupt(`app-server startup: ${error.message}`); });
  child.once('exit', (code, sig) => { exited = true; if (!closing) interrupt(`app-server exited (${code ?? sig ?? 'unknown'})`); });
  const notify = message => { if (!child.stdin.destroyed && child.stdin.writable) child.stdin.write(JSON.stringify(message) + '\n'); };
  const rpc = (method, params, ms = Math.min(timeoutMs, 30_000)) => new Promise((resolve, reject) => {
    if (stopReason || exited || closing) return reject(new Error(stopReason ?? 'app-server closed'));
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); const reason = `RPC timeout: ${method}`; reject(new Error(reason)); interrupt(reason); }, ms);
    pending.set(id, { resolve, reject, timer });
    notify({ id, method, params });
  });
  const close = async () => {
    if (closing) throw new Error('app-server session already closing');
    closing = true;
    clearTimeout(deadline);
    signal?.removeEventListener('abort', abort);
    rejectPending(new Error('session closed'));
    lines.close();
    const waitExit = ms => exited ? Promise.resolve(true) : Promise.race([
      new Promise(resolve => child.once('exit', () => resolve(true))), delay(ms).then(() => false),
    ]);
    let cleanupEvidence = { parentExited: exited, scope: process.platform === 'win32' ? 'Windows process tree' : 'single process' };
    let cleanupUnconfirmed = false;
    if (process.platform === 'win32') {
      if (exited || !child.pid) {
        // A parent exit alone does not establish that the Windows process tree is gone.
        cleanupUnconfirmed = true;
        cleanupEvidence = { ...cleanupEvidence, reason: exited ? 'exited before tree cleanup' : 'missing PID' };
      } else {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        const outcome = await Promise.race([
          new Promise(resolve => { killer.once('exit', (code, sig) => resolve({ code, sig })); killer.once('error', error => resolve({ error: error.message })); }),
          delay(2_000).then(() => ({ timeout: true })),
        ]);
        if (outcome.timeout) { killer.kill('SIGKILL'); killer.unref(); }
        await waitExit(2_000);
        cleanupEvidence = { command: 'taskkill /PID /T /F', pid: child.pid, outcome, parentExited: exited };
        cleanupUnconfirmed = outcome.code !== 0 || !exited;
      }
      if (!exited) { child.kill('SIGKILL'); await waitExit(500); }
      child.stdin.end();
    } else if (!child.pid) {
      // Failed spawn emits error/close, not exit. Do not wait through signal
      // escalation for a PID that was never assigned; retain the cleanup block.
      child.stdin.end();
      cleanupUnconfirmed = true;
      cleanupEvidence = { ...cleanupEvidence, reason: 'missing PID' };
    } else {
      child.stdin.end();
      await waitExit(500);
      if (!exited) child.kill('SIGTERM');
      if (!await waitExit(2_000)) { child.kill('SIGKILL'); await waitExit(2_000); }
      cleanupUnconfirmed = !exited;
      cleanupEvidence.parentExited = exited;
    }
    if (cleanupUnconfirmed) {
      // The owned child may survive a restricted sandbox; detach handles so this tool returns.
      child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); child.unref();
    }
    return { cleanupUnconfirmed, cleanupEvidence, stopReason, stdoutBytes, stderrBytes };
  };
  return { rpc, notify, interrupt, close, get stopReason() { return stopReason; } };
}
