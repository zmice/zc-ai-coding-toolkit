import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFrameWorkspace, createStoryServer, reportUrl, reportMessage } from '../../packages/toolkit/src/content/skills/visual-refinement/assets/scripts/runtime.mjs';

const scripts = fileURLToPath(new URL('../../packages/toolkit/src/content/skills/visual-refinement/assets/scripts/', import.meta.url));
const scratch = () => mkdtempSync(join(tmpdir(), 'visual-refinement-test-'));

test('shareable report URLs and navigation errors omit credentials, query and fragment', () => {
  const url = 'https://alice:p%40ss@example.test/page?token=private#session';
  assert.equal(reportUrl(url), 'https://example.test/page');
  assert.equal(reportMessage(`Navigation failed for "${url}"`), 'Navigation failed for "https://example.test/page"');
});

function request(server, url, method = 'GET') {
  let status = 200;
  let body = '';
  server.emit('request', { url, method }, {
    writeHead(code) { status = code; },
    end(chunk) { if (chunk) body += String(chunk); },
  });
  return { status, body };
}

function run(script, args) {
  return spawnSync(process.execPath, [join(scripts, script), ...args], {
    encoding: 'utf8', timeout: 5000, windowsHide: true,
  });
}

function rejectsBeforeDependencyLoad(result, label) {
  assert.notEqual(result.status, 0, `${label}: unexpectedly succeeded`);
  assert.equal(result.error, undefined, `${label}: process timed out or could not start`);
  assert.doesNotMatch(result.stderr, /Playwright missing|ffmpeg missing|Cannot find package.*playwright/i, `${label}: dependency lookup preceded input validation`);
}

test('story server exposes the stage and files only under its exact story mount', () => {
  const root = scratch();
  const peer = `${root}-extra`;
  mkdirSync(peer);
  const secret = 'PEER_SECRET_MUST_NOT_LEAK';
  writeFileSync(join(root, 'story.html'), '<h1>safe story</h1>');
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'assets', 'asset.css'), 'body { color: red; }');
  writeFileSync(join(peer, 'secret.txt'), secret);
  const server = createStoryServer(root, '<h1>stage marker</h1>');
  try {
    assert.deepEqual(request(server, '/__stage.html'), { status: 200, body: '<h1>stage marker</h1>' });
    assert.deepEqual(request(server, '/__story/story.html'), { status: 200, body: '<h1>safe story</h1>' });
    assert.deepEqual(request(server, '/__story/assets/asset.css'), { status: 200, body: 'body { color: red; }' });
    for (const path of ['/', '/story.html', '/__story-other/story.html', '/__stage.html/extra', '/__story/']) {
      const result = request(server, path);
      assert.ok(result.status >= 400, `${path}: ${result.status}`);
      assert.doesNotMatch(result.body, /safe story|stage marker|PEER_SECRET/);
    }
    const malformed = request(server, '/__story/%E0%A4%A');
    assert.equal(malformed.status, 400);
    for (const path of [
      `/__story/%2e%2e%2f${basename(peer)}%2fsecret.txt`,
      `/__story/%2e%2e%5c${basename(peer)}%5csecret.txt`,
      `/__story/%252e%252e%252f${basename(peer)}%252fsecret.txt`,
    ]) {
      const result = request(server, path);
      assert.ok(result.status >= 400, `${path}: ${result.status}`);
      assert.doesNotMatch(result.body, /PEER_SECRET/);
    }
    const directory = request(server, '/__story/assets');
    assert.ok(directory.status >= 400);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(peer, { recursive: true, force: true });
  }
});

test('story server rejects an in-root symlink that resolves outside the root', (t) => {
  const root = scratch();
  const peer = `${root}-extra`;
  mkdirSync(peer);
  writeFileSync(join(peer, 'secret.txt'), 'SYMLINK_ESCAPE_SECRET');
  try {
    try { symlinkSync(peer, join(root, 'linked'), 'junction'); }
    catch (error) {
      if (!process.env.CI && ['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip(`symlink unavailable: ${error.code}`); return; }
      throw error;
    }
    const server = createStoryServer(root, 'stage');
    const response = request(server, '/__story/linked/secret.txt');
    assert.ok(response.status >= 400, `symlink escape: ${response.status}`);
    assert.doesNotMatch(response.body, /SYMLINK_ESCAPE_SECRET/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(peer, { recursive: true, force: true });
  }
});

test('frame workspaces are unique and cleanup cannot remove an existing user directory', () => {
  const root = scratch();
  const userDir = join(root, '.story-frames');
  const marker = join(userDir, 'keep.txt');
  mkdirSync(userDir);
  writeFileSync(marker, 'owned by user');
  const first = createFrameWorkspace(root);
  const second = createFrameWorkspace(root);
  try {
    assert.notEqual(resolve(first.path), resolve(second.path));
    assert.notEqual(resolve(first.path), resolve(userDir));
    assert.ok(existsSync(first.path));
    assert.ok(existsSync(second.path));
    writeFileSync(join(first.path, 'frame.png'), 'frame');
    first.cleanup();
    first.cleanup();
    assert.equal(existsSync(first.path), false);
    assert.equal(readFileSync(marker, 'utf8'), 'owned by user');
    assert.ok(existsSync(second.path), 'other active workspace remains');
  } finally {
    second.cleanup();
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI help works without optional browser or encoder dependencies', () => {
  for (const script of ['snapshot.mjs', 'story.mjs']) {
    const result = run(script, ['--help']);
    assert.equal(result.status, 0, `${script}: ${result.stderr}`);
    assert.match(result.stdout, /usage|snapshot|story/i);
  }
});

test('CLI rejects malformed arguments and existing output before optional dependencies', () => {
  const root = scratch();
  const source = join(root, 'source.html');
  const output = join(root, 'output');
  mkdirSync(output);
  writeFileSync(join(output, 'keep.txt'), 'original');
  writeFileSync(source, '<meta name="unslop-steps" content="Spacing"><h1>fixture</h1>');
  try {
    const invalid = [
      ['snapshot.mjs', [source, join(root, 'fresh-a'), '--width', '0']],
      ['snapshot.mjs', [source, join(root, 'fresh-b'), '--height', '1.5']],
      ['snapshot.mjs', [source, join(root, 'fresh-c'), '--timeout-ms', '-1']],
      ['snapshot.mjs', [source, join(root, 'fresh-d'), '--unknown']],
      ['snapshot.mjs', [source, join(root, 'fresh-e'), 'extra']],
      ['snapshot.mjs', [source, join(root, 'fresh-f'), '--dark', '--light']],
      ['story.mjs', [source, join(root, 'fresh-g'), '--fps', '0']],
      ['story.mjs', [source, join(root, 'fresh-h'), '--scale', '3']],
      ['story.mjs', [source, join(root, 'fresh-i'), '--timeout-ms', '1.5']],
      ['story.mjs', [source, join(root, 'fresh-j'), '--unknown']],
      ['story.mjs', [source, join(root, 'fresh-k'), 'extra']],
      ['snapshot.mjs', [source, output]],
      ['story.mjs', [source, output]],
    ];
    for (const [script, args] of invalid) rejectsBeforeDependencyLoad(run(script, args), `${script} ${args.join(' ')}`);
    assert.equal(readFileSync(join(output, 'keep.txt'), 'utf8'), 'original');
    assert.deepEqual(readdirSync(output), ['keep.txt']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
