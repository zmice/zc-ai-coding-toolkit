// Adapted from heydamir/unslop (97daa3e), CC BY 4.0. Changes: bounded
// dependency lookup, isolated frame storage, and confined HTTP file serving.
// Attribution and license: ../references/LICENSE-unslop.txt
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, realpathSync, rmSync, statSync, readFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.mjs':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.avif':'image/avif', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.woff':'font/woff', '.mp4':'video/mp4' };

export function createStoryServer(root, stageHtml) {
  const base = realpathSync(root);
  return createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname); }
    catch { response.writeHead(400); response.end(); return; }
    if (pathname === '/__stage.html') {
      response.writeHead(200, { 'content-type':'text/html; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : stageHtml);
      return;
    }
    if (!pathname.startsWith('/__story/')) { response.writeHead(404); response.end(); return; }
    const subpath = pathname.slice('/__story/'.length);
    if (!subpath || subpath.includes('\\') || subpath.includes('\0') || subpath.split('/').some(part => part === '.' || part === '..' || !part)) {
      response.writeHead(400); response.end(); return;
    }
    const target = resolve(base, subpath);
    const inside = relative(base, target);
    if (!inside || inside === '..' || inside.startsWith('..' + sep) || isAbsolute(inside)) { response.writeHead(403); response.end(); return; }
    let actual, stats;
    try { actual = realpathSync(target); stats = statSync(actual); }
    catch { response.writeHead(404); response.end(); return; }
    const actualInside = relative(base, actual);
    if (!actualInside || actualInside === '..' || actualInside.startsWith('..' + sep) || isAbsolute(actualInside) || !stats.isFile()) {
      response.writeHead(403); response.end(); return;
    }
    let content;
    try { content = request.method === 'HEAD' ? undefined : readFileSync(actual); }
    catch { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'content-type': types[extname(actual).toLowerCase()] ?? 'application/octet-stream', 'x-content-type-options': 'nosniff' });
    response.end(content);
  });
}

export function createFrameWorkspace(baseDir = tmpdir()) {
  const path = mkdtempSync(join(baseDir, 'visual-story-frames-'));
  let cleaned = false;
  return { path, cleanup() { if (!cleaned) { cleaned = true; rmSync(path, { recursive:true, force:true }); } } };
}

export async function browserKit() {
  const roots = [process.cwd(), dirname(fileURLToPath(import.meta.url))];
  for (const root of roots) {
    const require = createRequire(join(root, 'package.json'));
    for (const name of ['playwright', 'playwright-core']) {
      try { return require(name); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
    }
  }
  throw new Error('Playwright missing. Install playwright or playwright-core in the working directory or beside this script; install Chromium separately.');
}

export function chromePath() {
  if (process.env.CHROME_PATH) {
    if (!existsSync(process.env.CHROME_PATH)) throw new Error('CHROME_PATH does not exist');
    return process.env.CHROME_PATH;
  }
  return [
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium',
  ].find((path) => path && existsSync(path));
}

export function intOption(name, raw, min, max) {
  if (!/^[0-9]+$/.test(String(raw))) throw new Error(`${name} must be an integer from ${min} to ${max}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return value;
}

// Reports are often shared; credentials and query/fragment values are not evidence.
export function reportUrl(value) {
  try {
    const url = new URL(value);
    url.username = ''; url.password = ''; url.search = ''; url.hash = '';
    return url.href;
  } catch { return '[invalid URL]'; }
}

export function reportMessage(value) {
  return String(value).replace(/https?:\/\/[^\s"'<>]+/gi, reportUrl);
}
