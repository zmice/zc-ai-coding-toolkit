// Opt-in local fixture browser acceptance. Requires an existing Playwright installation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, realpathSync, statSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { tickets as seedTickets } from '../tests/visual-refinement/fixtures/redesign/data.js';

const args = process.argv.slice(2);
assert.ok(args.includes('--execute'), 'Usage: node scripts/visual-lifecycle-browser.mjs <case-root> <output-dir> --execute [--capture-only]');
assert.ok(args[0] && !args[0].startsWith('--') && args[1] && !args[1].startsWith('--'), 'case root and output directory required');
const caseName = args.includes('--case') ? args[args.indexOf('--case') + 1] : null;
assert.ok(args.includes('--capture-only') || ['new-page', 'redesign'].includes(caseName), 'Verification requires --case new-page|redesign');
const root = realpathSync(resolve(args[0]));
const out = resolve(args[1]);
assert.ok(out !== root && !out.startsWith(root + sep), 'Evidence must be outside served fixture');
assert.ok(!existsSync(out) || readdirSync(out).length === 0, 'Evidence directory must be new or empty; previous results are preserved');
mkdirSync(out, { recursive: true });
const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer((req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = realpathSync(resolve(root, '.' + (name.endsWith('/') ? name + 'index.html' : name)));
    if (!path.startsWith(root + sep) || !statSync(path).isFile()) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    res.end(req.method === 'HEAD' ? undefined : readFileSync(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const sourceHashes = Object.fromEntries(readdirSync(root).filter(name => /\.(html|css|js)$/.test(name)).sort().map(name => [name, createHash('sha256').update(readFileSync(join(root, name))).digest('hex')]));
const receipt = { scope: 'Isolated implementation fixture, not production acceptance', root, caseName, sourceHashes, screenshots: [], checks: [], errors: [], externalRequests: [], status: 'incomplete' };
async function screenshot(page, name) {
  const path = join(out, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  receipt.screenshots.push({ name, viewport: page.viewportSize(), path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
}
async function checkNew(page, name) {
  const title = page.getByRole('textbox', { name: /^(工单)?标题/ });
  const description = page.getByRole('textbox', { name: /^(问题)?描述/ });
  const success = page.locator('#success-view, #success-panel');
  const submit = page.getByRole('button', { name: '创建工单' });
  const box = await title.boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= page.viewportSize().height, `${name}: primary input must be visible before scrolling`);
  await submit.click();
  assert.equal(await title.getAttribute('aria-invalid'), 'true');
  assert.equal(await description.getAttribute('aria-invalid'), 'true');
  assert.equal(await title.evaluate(el => document.activeElement === el), true);
  assert.equal(await success.isVisible(), false);
  await title.fill('   '); await description.fill('有效描述'); await submit.click();
  assert.equal(await success.isVisible(), false);
  const longTitle = '中文长工单标题'.repeat(24);
  const longDescription = '<img src=x onerror=alert(1)>\n' + '完整保留问题说明与影响范围'.repeat(30);
  await title.fill(longTitle); await description.fill(longDescription);
  await page.getByRole('radio', { name: /紧急/ }).check();
  await submit.focus(); await page.keyboard.press('Enter');
  assert.equal(await success.isVisible(), true);
  assert.equal(await page.locator('#summary-title').innerText(), longTitle);
  assert.equal(await page.locator('#summary-description').textContent(), longDescription);
  assert.equal(await page.locator('#summary-priority').innerText(), '紧急');
  assert.equal(await page.locator('#summary-description img').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await screenshot(page, `${name}-success`);
  await page.getByRole('button', { name: '创建下一单' }).focus(); await page.keyboard.press('Enter');
  assert.equal(await title.inputValue(), ''); assert.equal(await description.inputValue(), '');
  assert.equal(await page.getByRole('radio', { name: /普通/ }).isChecked(), true);
  assert.equal(await title.evaluate(el => document.activeElement === el), true);
  receipt.checks.push(`${name}: required/whitespace validation, keyboard submit/reset, exact long-text summary, safe text output and focus`);
}
async function checkRedesign(page, name) {
  const open = id => page.getByRole('button', { name: `查看详情 ${id}`, exact: true });
  const search = page.getByRole('searchbox', { name: '搜索工单', exact: true });
  const status = page.getByRole('combobox', { name: '状态', exact: true });
  const card = id => page.locator('article').filter({ has: open(id) });
  for (const seed of seedTickets) {
    assert.equal(await open(seed.id).count(), 1);
    assert.equal(await card(seed.id).getByRole('heading', { name: seed.title, exact: true }).count(), 1);
    assert.ok((await card(seed.id).innerText()).includes(seed.description));
    assert.deepEqual(await card(seed.id).locator('dd').allTextContents(), [seed.status, seed.priority, seed.owner]);
    await open(seed.id).click();
    assert.equal(await page.locator('#detail-title').innerText(), `${seed.id} ${seed.title}`);
    assert.equal(await page.locator('#description').textContent(), seed.description);
    assert.deepEqual(await page.locator('#detail-meta dd').allTextContents(), [seed.status, seed.priority, seed.owner]);
    await page.keyboard.press('Escape');
    await page.waitForFunction(id => document.activeElement?.dataset.id === id, seed.id);
  }
  receipt.checks.push(`${name}: all seed IDs, titles, descriptions, status, priority and owners match in list and details`);
  await search.fill('报表'); await status.selectOption({ label: '处理中' });
  assert.equal(await open('T-101').count(), 0);
  await status.selectOption({ label: '待处理' }); assert.equal(await open('T-101').count(), 1);
  assert.equal(await open('T-103').count(), 0);
  await page.getByRole('button', { name: '清空筛选', exact: true }).click();
  assert.equal(await open('T-103').count(), 1);
  await open('T-102').click();
  const dialog = page.getByRole('dialog');
  assert.match(await dialog.innerText(), /仅查看权限的演示工单/);
  assert.equal(await dialog.getByRole('button', { name: '确认分派', exact: true }).isDisabled(), true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.dataset.id === 'T-102');
  assert.equal(await open('T-102').evaluate(el => document.activeElement === el), true);
  await open('T-101').focus(); await page.keyboard.press('Enter');
  assert.match(await dialog.innerText(), /月底汇总时导出失败/);
  await dialog.getByRole('combobox', { name: '处理人', exact: true }).selectOption('李青');
  await dialog.getByRole('checkbox', { name: '模拟失败', exact: true }).check();
  await dialog.getByRole('button', { name: '确认分派', exact: true }).click();
  assert.match(await dialog.innerText(), /模拟请求失败/);
  assert.equal(await dialog.getByRole('combobox', { name: '处理人', exact: true }).inputValue(), '李青');
  await screenshot(page, `${name}-retry`);
  await dialog.getByRole('checkbox', { name: '模拟失败', exact: true }).uncheck();
  await dialog.getByRole('button', { name: '确认分派', exact: true }).click();
  assert.match(await dialog.innerText(), /分派成功/);
  await dialog.getByRole('button', { name: '关闭详情', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.dataset.id === 'T-101');
  assert.equal(await open('T-101').evaluate(el => document.activeElement === el), true);
  assert.deepEqual(await card('T-101').locator('dd').allTextContents(), ['处理中', '紧急', '李青']);
  await status.selectOption({ label: '处理中' });
  assert.equal(await open('T-101').count(), 1); assert.equal(await open('T-102').count(), 1);
  assert.equal(await open('T-103').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  receipt.checks.push(`${name}: combined search/status, clear, details, permission denial, assignment failure/retry, updated state and keyboard focus`);
}
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const [name, width, height] of [['wide', 1440, 1000], ['narrow', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => receipt.errors.push(error.message));
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      receipt.externalRequests.push(new URL(route.request().url()).origin); return route.abort();
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await screenshot(page, name);
    if (!args.includes('--capture-only')) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: viewport overflow`);
      assert.match(await page.locator('body').innerText(), /本地演示/);
      receipt.checks.push(`${name}: no viewport overflow; demonstration label`);
      await (caseName === 'new-page' ? checkNew : checkRedesign)(page, name);
    }
    await page.close();
  }
  assert.deepEqual(receipt.errors, []);
  assert.deepEqual(receipt.externalRequests, []);
  receipt.status = args.includes('--capture-only') ? 'captured' : 'passed';
} catch (error) {
  receipt.status = 'failed'; receipt.failure = error.stack; process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
  writeFileSync(join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
}
