// Opt-in integration check. Run from a directory with Playwright installed:
// node <repo>/tests/visual-refinement/browser-smoke.mjs --execute
// Requires Chrome/Chromium, ffmpeg and ffprobe; never installs dependencies.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

assert.equal(process.argv[2], '--execute', 'Explicit --execute required; optional dependencies must already be installed');
const require = createRequire(join(process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const repo = fileURLToPath(new URL('../../', import.meta.url));
const scripts = join(repo, 'packages/toolkit/src/content/skills/visual-refinement/assets/scripts');
mkdirSync(join(repo, '.cache'), { recursive: true });
const root = mkdtempSync(join(repo, '.cache/visual-browser-'));
const temp = join(root, 'temp'); mkdirSync(temp);
const env = { ...process.env, TMP: temp, TEMP: temp, TMPDIR: temp };
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="#40b98d"/></svg>';
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{padding:24px;font:18px system-ui;background:#182027;color:#f0f5f7}.row{display:flex;gap:16px}canvas{background:white}.spacer{height:1400px}
</style></head><body><h1>Reference capture fixture</h1><div class="row"><picture><source media="(min-width:700px)" srcset="/wide.svg"><img id="responsive" src="/small.svg"></picture><canvas id="drawing" width="80" height="40"></canvas><div id="shadow"></div></div><p><input id="edited" value="initial"></p><button id="handler" onclick="document.body.dataset.clicked='yes'">Local handler</button><img src="/large.svg" width="80" height="40"><div class="spacer"></div><img id="lazy" loading="lazy" src="/lazy.svg"><script>
document.querySelector('#edited').value='runtime-edited';const c=document.querySelector('#drawing').getContext('2d');c.fillStyle='#ff7043';c.fillRect(0,0,80,40);document.querySelector('#shadow').attachShadow({mode:'open'}).innerHTML='<strong>Shadow content</strong>';
</script></body></html>`;
const server = createServer((req, res) => {
  if (req.url === '/page') { res.setHeader('content-type', 'text/html'); res.end(html); }
  else if (req.url?.endsWith('.svg')) { res.setHeader('content-type', 'image/svg+xml'); res.end(svg + (req.url === '/large.svg' ? ' '.repeat(3000100) : '')); }
  else { res.statusCode = 404; res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

async function run(script, args, extraEnv = {}) {
  const child = spawn(process.execPath, [join(scripts, script), ...args], { env: { ...env, ...extraEnv }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', timeout = false;
  child.stdout.on('data', chunk => stdout += chunk);
  child.stderr.on('data', chunk => stderr += chunk);
  const timer = setTimeout(() => {
    timeout = true;
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }, 150000);
  try {
    const code = await new Promise((done, fail) => { child.once('error', fail); child.once('close', done); });
    assert.equal(timeout, false, `${script} exceeded integration deadline`);
    return { code, stdout, stderr };
  } finally { clearTimeout(timer); }
}
let browser;
try {
  const snap = join(root, 'snapshot');
  const captured = await run('snapshot.mjs', [origin + '/page', snap, '--width', '800', '--height', '600', '--dark', '--timeout-ms', '60000']);
  assert.equal(captured.code, 0, captured.stderr);
  for (const name of ['reference.html', 'source.png', 'report.json']) assert.ok(existsSync(join(snap, name)), name);
  const snapshotReport = JSON.parse(readFileSync(join(snap, 'report.json')));
  assert.ok(Array.isArray(snapshotReport.warnings) && snapshotReport.warnings.length > 0, 'Capture limitations must be reported');
  browser = await chromium.launch({ headless: true, ...(env.CHROME_PATH ? { executablePath: env.CHROME_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, colorScheme: 'dark' });
  await page.goto(pathToFileURL(join(snap, 'reference.html')).href);
  const copy = await page.evaluate(() => ({
    input: document.querySelector('#edited').value,
    responsiveInlined: document.querySelector('#responsive').currentSrc.startsWith('data:'),
    lazyInlined: document.querySelector('#lazy').src.startsWith('data:'),
    shadow: document.querySelector('#shadow').shadowRoot?.textContent ?? null,
    canvasPixel: [...document.querySelector('#drawing').getContext('2d').getImageData(0, 0, 1, 1).data],
    activeHandler: document.querySelector('#handler').hasAttribute('onclick')
  }));
  assert.ok(copy.responsiveInlined && copy.lazyInlined, 'Responsive and lazy resources are captured');
  await page.screenshot({ path: join(root, 'reference-render.png') });
  await browser.close(); browser = undefined;

  const inputDir = join(root, 'input'); mkdirSync(inputDir);
  const legacyFrames = join(inputDir, '.story-frames'); mkdirSync(legacyFrames);
  const marker = join(legacyFrames, 'keep.txt'); writeFileSync(marker, 'user-owned synthetic marker');
  const story = join(inputDir, 'story.html');
  writeFileSync(story, `<!doctype html><html><head><meta charset="utf-8"><meta name="unslop-steps" content="Spacing, Color, Details"><meta name="unslop-frame" content="0 0 960"><style>
body{margin:0;padding:32px;background:#20143d;color:white;font:20px system-ui}.panel{width:800px;padding:13px;background:#40246a;border-radius:30px}.card{padding:9px;background:#59317f;border-radius:30px;margin-bottom:13px}h1{font-size:36px}.s1 .panel{padding:24px}.s1 .card{padding:20px;margin-bottom:20px}.s2 body{background:#151719}.s2 .panel{background:#202326}.s2 .card{background:#292d30}.s3 .panel{border-radius:16px}.s3 .card{border-radius:10px}
</style></head><body><div class="panel" data-radius><h1 data-gap>Operations overview</h1><div class="card" data-gap data-radius>Service health — 99.9%</div><div class="card" data-gap>Open incidents — 2</div><div class="card" data-gap>Deployments today — 12</div></div></body></html>`);
  const videoDir = join(root, 'story');
  const encoded = await run('story.mjs', [story, videoDir, '--fps', '10', '--scale', '1', '--timeout-ms', '120000']);
  assert.equal(encoded.code, 0, encoded.stderr);
  const video = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height,r_frame_rate', '-of', 'json', join(videoDir, 'story.mp4')], { encoding: 'utf8', windowsHide: true }));
  assert.equal(video.streams[0].codec_name, 'h264');
  assert.equal(video.streams[0].r_frame_rate, '10/1');
  assert.ok(Number(video.format.duration) > 0);
  assert.equal(readFileSync(marker, 'utf8'), 'user-owned synthetic marker');
  assert.deepEqual(readdirSync(temp).filter(name => name.startsWith('visual-story-frames-')), [], 'Owned frame workspace must be cleaned');
  execFileSync('ffmpeg', ['-v', 'error', '-i', join(videoDir, 'story.mp4'), '-ss', '3', '-frames:v', '1', join(root, 'story-middle.png')], { windowsHide: true });
  // A browser-launch failure must not remove unrelated files or leave owned frames.
  const invalidBrowser = join(root, 'invalid-browser.exe');
  writeFileSync(invalidBrowser, 'Synthetic non-executable browser fixture');
  const failed = await run('story.mjs', [story, join(root, 'failed-story'), '--timeout-ms', '1000'], { CHROME_PATH: invalidBrowser });
  assert.notEqual(failed.code, 0);
  assert.ok(existsSync(marker));
  assert.deepEqual(readdirSync(temp).filter(name => name.startsWith('visual-story-frames-')), []);
  const timedOut = await run('story.mjs', [story, join(root, 'timed-out-story'), '--fps', '10', '--timeout-ms', '1000']);
  assert.notEqual(timedOut.code, 0);
  assert.equal(JSON.parse(readFileSync(join(root, 'timed-out-story/report.json'))).timedOut, true);
  assert.ok(existsSync(marker));
  assert.deepEqual(readdirSync(temp).filter(name => name.startsWith('visual-story-frames-')), []);
  const sourceHashes = Object.fromEntries(['runtime.mjs', 'snapshot.mjs', 'story.mjs'].map(name => [name, createHash('sha256').update(readFileSync(join(scripts, name))).digest('hex')]));
  const receipt = { root, sourceHashes, snapshot: { copy, report: snapshotReport }, story: { video, report: JSON.parse(readFileSync(join(videoDir, 'report.json'))), existingFramesPreserved: true, ownedFramesCleaned: true }, launchFailure: { code: failed.code, stderr: failed.stderr }, timeoutCleanup: { code: timedOut.code, ownedFramesCleaned: true }, scope: 'Synthetic real-browser tool integration, not product visual acceptance' };
  writeFileSync(join(root, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ root, snapshot: 'passed', story: 'passed', launchFailureCleanup: 'passed', video }));
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
