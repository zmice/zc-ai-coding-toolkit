import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { resolve, join, dirname, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadToolkitManifest } from '../packages/toolkit/dist/index.js';
import { createCodexMarketplaceGenerationPlan } from '../packages/platform-codex/dist/index.js';
import { captureCodex } from './lib/codex-eval-capture.mjs';

// Explicit first-turn content study. This does not measure implicit skill routing or UI quality.
assert.equal(process.platform, 'win32');
assert.equal(process.argv[5], '--execute', 'Usage: node scripts/skill-evals-visual-study.mjs <case-id> <baseline|candidate> <absolute-codex.exe> --execute');
assert.ok(isAbsolute(process.argv[4] ?? ''));
assert.equal(resolve(process.cwd()), resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const binary = resolve(process.argv[4]);
const caseId = process.argv[2];
const arm = process.argv[3];
assert.ok(['baseline', 'candidate'].includes(arm));
const maxTokens = Number(process.env.ZC_VISUAL_STUDY_MAX_TOKENS ?? 160000);
assert.ok(maxTokens === 160000 || maxTokens === 320000 && arm === 'candidate' && caseId === 'visual-major-redesign', 'Only one authorized major candidate budget-repair run may use 320000');
const suitePath = resolve('tests/visual-refinement/behavior-cases.json');
const suiteBytes = readFileSync(suitePath);
const suite = JSON.parse(suiteBytes);
assert.ok(suite.scope, 'Freeze a first-turn read-only oracle before execution');
const item = suite.cases.find(entry => entry.id === caseId);
assert.ok(item);
const hash = value => createHash('sha256').update(value).digest('hex');
const q = value => JSON.stringify(value.replaceAll('\\', '/'));
const psq = value => `'${value.replaceAll("'", "''")}'`;
mkdirSync(resolve('.cache'), { recursive: true });
const root = mkdtempSync(resolve(`.cache/visual-study-${caseId}-${arm}-`));
const home = join(root, 'home');
const cwd = join(root, 'project');
const market = join(root, 'market');
const scratch = join(root, 'scratch');
const outputDir = join(root, 'evidence');
for (const path of [home, cwd, market, scratch]) mkdirSync(path);
writeFileSync(join(home, '.skill-eval-home'), 'disposable evaluation home');
const fixtures = {
  'README.md': '# User overview fixture\nStatic HTML uses shared UserTable and design tokens. Serve with any static server. Filter currently updates state but fails to rerender rows. This study allows read-only first-turn inspection and plans only, no implementation or browser access is provided.\n',
  'index.html': '<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="tokens.css"><main><h1>用户概览</h1><p>管理项目成员与访问状态</p><label>状态<select id="status"><option value="all">全部</option><option value="active">启用</option></select></label><button id="filter">筛选</button><section id="users" aria-live="polite"></section></main><script type="module" src="app.js"></script></html>\n',
  'tokens.css': ':root{--brand:#2563eb;--text:#1f2937;--surface:#fff;--space:8px;--radius:4px}body{font:14px/1.5 system-ui;color:var(--text);background:#f3f4f6;margin:16px}main{background:var(--surface);padding:16px}h1{font-size:20px}button,select{margin:8px;padding:8px}table{width:100%;border-collapse:collapse}td,th{padding:8px;text-align:left;border-bottom:1px solid #ddd}\n',
  'UserTable.js': 'export function UserTable(users){return `<table><thead><tr><th>姓名</th><th>状态</th></tr></thead><tbody>${users.map(user=>`<tr><td>${user.name}</td><td>${user.status}</td></tr>`).join("")}</tbody></table>`}\n',
  'app.js': 'import {UserTable} from "./UserTable.js";\nconst users=[{name:"陈明",status:"active"},{name:"李青",status:"disabled"}];\nlet selected="all";\nconst rows=()=>users.filter(user=>selected==="all"||user.status===selected);\nconst render=()=>document.querySelector("#users").innerHTML=UserTable(rows());\ndocument.querySelector("#filter").addEventListener("click",()=>{selected=document.querySelector("#status").value});\nrender();\n',
};
for (const [path, contents] of Object.entries(fixtures)) writeFileSync(join(cwd, path), contents);
const snapshot = () => Object.fromEntries(Object.keys(fixtures).map(path => [path, hash(readFileSync(join(cwd, path)))]));
const sourceBefore = snapshot();
const userHome = join(process.env.USERPROFILE, '.codex');
const configPath = join(userHome, 'config.toml');
const authPath = join(userHome, 'auth.json');
const userConfigHash = hash(readFileSync(configPath));
const authHash = hash(readFileSync(authPath));
const provider = readFileSync(configPath, 'utf8').split('[model_providers.custom]')[1]?.split(/\n\[/)[0];
assert.ok(provider && !/(base_url|key|token|header|secret)/i.test(provider), 'Reinspect unknown provider fields');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(CODEX_|OPENAI_|GIT_)/i.test(key)));
Object.assign(env, { CODEX_HOME: home, TEMP: scratch, TMP: scratch, TMPDIR: scratch,
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(root, 'empty-gitconfig'), GIT_OPTIONAL_LOCKS: '0' });
writeFileSync(env.GIT_CONFIG_GLOBAL, '');
// Keep both arms on the original common-skill baseline after this study is released.
const head = execFileSync('git', ['rev-parse', '46defebca23c94fb8ef98fffcd06d3499243e9e8^{commit}'], { encoding: 'utf8', windowsHide: true }).trim();
const fromHead = path => execFileSync('git', ['show', `${head}:${path}`], { encoding: 'utf8', windowsHide: true });
const manifest = await loadToolkitManifest();
const names = ['frontend-ui-engineering', 'ui-ux-review', ...(arm === 'candidate' ? ['visual-refinement'] : [])];
const assets = names.map(name => {
  const loaded = manifest.assets.find(asset => asset.id === `skill:${name}`);
  assert.ok(loaded);
  const prefix = `packages/toolkit/src/content/skills/${name}/`;
  const common = name !== 'visual-refinement';
  const attachmentPaths = common ? execFileSync('git', ['ls-tree', '-r', '--name-only', head, `${prefix}assets/`], { encoding: 'utf8', windowsHide: true }).trim().split('\n').filter(Boolean) : [];
  return { id: loaded.id, kind: loaded.meta.kind, name, title: loaded.meta.title, summary: loaded.meta.description,
    platforms: loaded.meta.platforms, body: common ? fromHead(`${prefix}body.md`) : loaded.body,
    attachments: common ? attachmentPaths.map(path => ({ relativePath: path.slice(prefix.length), contents: fromHead(path) })) : loaded.attachments };
});
const plan = createCodexMarketplaceGenerationPlan({ source: 'visual-behavior-study', assets }, { marketplaceName: 'zc-eval', pluginVersion: '0.0.1' });
for (const artifact of plan.artifacts) { const path = join(market, artifact.path); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, artifact.content); }
const config = `model = "gpt-6-astra"\nmodel_provider = "custom"\nmodel_reasoning_effort = "high"\napproval_policy = "never"\nproject_doc_max_bytes = 0\nweb_search = "disabled"\ndefault_permissions = "eval"\n[features]\nshell_snapshot = false\napps = false\nremote_plugin = false\nplugin_discovery_prefetch = false\n[model_providers.custom]\n${provider}\n[permissions.eval.filesystem]\n":root" = "read"\n${q(resolve('.'))} = "deny"\n${q(userHome)} = "deny"\n${q(join(process.env.USERPROFILE, '.agents'))} = "deny"\n${q(cwd)} = "read"\n${q(join(home, 'skills'))} = "read"\n${q(join(home, 'plugins/cache'))} = "read"\n${q(dirname(binary))} = "read"\n${q(scratch)} = "write"\n${q(env.GIT_CONFIG_GLOBAL)} = "read"\n${q(join(home, 'auth.json'))} = "deny"\n[permissions.eval.network]\nenabled = false\n[windows]\nsandbox = "elevated"\n`;
writeFileSync(join(home, 'config.toml'), config);
const cli = args => execFileSync(binary, args, { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 45000 });
cli(['plugin', 'marketplace', 'add', market, '--json']);
cli(['plugin', 'add', 'zc-toolkit@zc-eval', '--json']);
const hostVersion = cli(['--version']).trim();
const installed = join(home, 'plugins/cache/zc-eval/zc-toolkit/0.0.1');
const cacheHashes = {};
for (const artifact of plan.artifacts) {
  const match = artifact.path.match(/(?:^|\/)skills\/(.+)$/);
  if (!match) continue;
  const installedHash = hash(readFileSync(join(installed, 'skills', match[1])));
  assert.equal(installedHash, hash(artifact.content));
  cacheHashes[match[1]] = installedHash;
}
assert.ok(Object.keys(cacheHashes).length > names.length);
const temporaryAuth = join(home, 'auth.json');
try {
  writeFileSync(temporaryAuth, 'non-secret isolation probe');
  const sid = execFileSync('whoami', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true }).match(/S-1-\d+(?:-\d+)+/)?.[0];
  assert.ok(sid);
  execFileSync('icacls', [temporaryAuth, '/inheritance:r', '/grant:r', `*${sid}:F`, '*S-1-5-18:F'], { windowsHide: true, stdio: 'pipe' });
  const denied = [suitePath, resolve('packages/toolkit/src/content/skills/visual-refinement/body.md'), join(userHome, 'AGENTS.md'), temporaryAuth];
  const probeScript = `$ErrorActionPreference='Stop'; $f=[IO.File]::OpenRead(${psq(join(cwd, 'index.html'))}); $f.Dispose(); ` + denied.map((path, index) => `try { $f=[IO.File]::OpenRead(${psq(path)}); $f.Dispose(); Write-Output 'DENY_FAILED:${index}'; exit 7 } catch [UnauthorizedAccessException] { }`).join('; ') + '; Write-Output ISOLATION_OK';
  const probe = spawnSync(binary, ['sandbox', '-P', 'eval', '-C', cwd, 'pwsh', '-NoProfile', '-Command', probeScript], { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  writeFileSync(join(root, 'preflight.json'), JSON.stringify({ status: probe.status, stdout: probe.stdout, stderr: probe.stderr, error: probe.error?.message, denied }, null, 2));
  assert.equal(probe.status, 0, `Isolation preflight failed: ${root}`);
  assert.match(probe.stdout, /ISOLATION_OK/);
  const frozen = { caseId, arm, repeat: 1, model: 'gpt-6-astra', effort: 'high', head, hostVersion,
    scope: suite.scope, nativeExplicitSkills: names, suiteHash: hash(suiteBytes), oracleHash: hash(JSON.stringify(item.oracle)),
    inputHash: hash(item.input), fixtureHash: hash(JSON.stringify(fixtures)), contentHash: hash(JSON.stringify(assets)), cacheHashes,
    sourceBefore, userConfigHash, authSourceHash: authHash, adapterHash: hash(readFileSync(resolve('scripts/lib/codex-eval-capture.mjs'))),
    recipeHash: hash(readFileSync(fileURLToPath(import.meta.url))),
    limits: { timeoutMs: 240000, maxToolCalls: 20, maxTokens } };
  writeFileSync(join(root, 'frozen.json'), JSON.stringify(frozen, null, 2));
  console.log(JSON.stringify({ phase: 'prepared', root, caseId, arm }));
  Object.assign(process.env, { TEMP: scratch, TMP: scratch, TMPDIR: scratch, GIT_CONFIG_GLOBAL: env.GIT_CONFIG_GLOBAL, GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' });
  // Overwrite the ACL-protected, preflight-tested inode; never replace it before use.
  writeFileSync(temporaryAuth, readFileSync(authPath));
  const input = [{ type: 'text', text: item.input, text_elements: [] }, ...names.map(name => ({ type: 'skill', name: `zc-toolkit:${name}`, path: join(installed, 'skills', name, 'SKILL.md') }))];
  const capture = await captureCodex({ binary, home, cwd, outputDir, model: frozen.model, effort: frozen.effort, permissionProfile: 'eval', input, ...frozen.limits });
  // Keep only turn tool invocations and final text for human review; raw host events can include account metadata.
  const events = readFileSync(join(outputDir, 'host-events.jsonl'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  const completed = events.filter(event => event.method === 'item/completed' && event.params?.threadId === capture.threadId).map(event => event.params.item);
  const safe = completed.filter(entry => ['commandExecution', 'fileChange', 'agentMessage', 'mcpToolCall', 'dynamicToolCall', 'webSearch', 'functionCall'].includes(entry?.type));
  writeFileSync(join(outputDir, 'turn-evidence.json'), JSON.stringify(safe, null, 2));
  writeFileSync(join(outputDir, 'final.md'), safe.filter(entry => entry.type === 'agentMessage' && entry.phase === 'final_answer').map(entry => entry.text).join('\n\n') || 'No final answer captured.');
  rmSync(join(outputDir, 'host-events.jsonl'));
  const receipt = { root, caseId, arm, status: capture.status, reason: capture.reason, toolCalls: capture.toolCalls,
    sourceUnchanged: JSON.stringify(sourceBefore) === JSON.stringify(snapshot()), oracleUnchanged: hash(readFileSync(suitePath)) === frozen.suiteHash,
    userConfigUnchanged: hash(readFileSync(configPath)) === userConfigHash, authSourceUnchanged: hash(readFileSync(authPath)) === authHash };
  writeFileSync(join(root, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} finally { if (existsSync(temporaryAuth)) rmSync(temporaryAuth); }
