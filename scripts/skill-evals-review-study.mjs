import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadToolkitManifest } from '../packages/toolkit/dist/index.js';
import { createCodexMarketplaceGenerationPlan } from '../packages/platform-codex/dist/index.js';
import { captureCodex } from './lib/codex-eval-capture.mjs';
if (process.platform !== 'win32' || process.argv[6] !== '--execute' || !process.argv[5] || !isAbsolute(process.argv[5])) {
  throw new Error('Windows opt-in study: node scripts/skill-evals-review-study.mjs <case-id> <baseline|candidate> <1|2|3> <absolute-codex.exe> --execute');
}
const binary = resolve(process.argv[5]);
assert.equal(resolve(process.cwd()),resolve(dirname(fileURLToPath(import.meta.url)),'..'),'Run from the repository root');
const suitePath = resolve('tests/skill-evals/review-coverage-cases.json');
const suite = JSON.parse(readFileSync(suitePath));
const caseId = process.argv[2]; const arm = process.argv[3]; const repeat = Number(process.argv[4] || 1);
assert.ok(['baseline', 'candidate'].includes(arm));
const item = suite.cases.find(item => item.id === caseId); assert.ok(item); assert.ok([1,2,3].includes(repeat));
mkdirSync(resolve('.cache'),{recursive:true});
const root = mkdtempSync(resolve(`.cache/review-study-${arm}-${repeat}-`));
const home = join(root, 'home'); const cwd = join(root, 'project'); const outputDir = join(root, 'evidence'); const market = join(root, 'market'); const scratch = join(root,'scratch');
for (const path of [home, cwd, market, scratch]) mkdirSync(path);
writeFileSync(join(home, '.skill-eval-home'), 'disposable evaluation home');
const hash = value => createHash('sha256').update(value).digest('hex');
const q = value => JSON.stringify(value.replaceAll('\\','/'));
const psq = value => `'${value.replaceAll("'", "''")}'`;
const userHome = join(process.env.USERPROFILE, '.codex');
const userConfigHash = hash(readFileSync(join(userHome, 'config.toml')));
const authHash = hash(readFileSync(join(userHome, 'auth.json')));
const provider = readFileSync(join(userHome, 'config.toml'), 'utf8').split('[model_providers.custom]')[1]?.split(/\n\[/)[0];
assert.ok(provider && !/(base_url|key|token|header|secret)/i.test(provider), 'Reinspect provider config before copying unknown fields');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(CODEX_|OPENAI_|GIT_)/i.test(key)));
Object.assign(env, { CODEX_HOME: home, TEMP:scratch,TMP:scratch,TMPDIR:scratch,GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(root, 'empty-gitconfig'),
  GIT_OPTIONAL_LOCKS: '0', GIT_AUTHOR_DATE: '2026-11-09T00:00:00Z', GIT_COMMITTER_DATE: '2026-11-09T00:00:00Z' });
writeFileSync(env.GIT_CONFIG_GLOBAL, `[safe]\n\tdirectory = ${JSON.stringify(cwd.replaceAll('\\','/'))}\n`);
const git = (...args) => execFileSync('git', ['-c', 'core.hooksPath='+join(root,'no-hooks'), '-c', 'commit.gpgsign=false', ...args], {cwd, env, encoding:'utf8', windowsHide:true});
const write = (path, text) => { const target=resolve(cwd,path); assert.ok(!relative(cwd,target).startsWith('..')); mkdirSync(dirname(target),{recursive:true}); writeFileSync(target,text); };
git('init','-q');
for(const [path,text] of Object.entries(item.seed)) write(path,text);
for(const step of item.setup) {
  if(step.op==='commit-base'){git('add','--all');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','base');}
  else if(step.op==='write') write(step.path,step.text);
  else if(step.op==='delete-index') git('rm','-q','--',step.path);
  else if(step.op==='rename') git('mv','--',step.from,step.to);
  else if(step.op==='configure-external-diff') {
    const helper=join(cwd,'.git/eval-diff-helper.cjs');
    writeFileSync(helper,"console.log('EVAL_EXTERNAL_DIFF_RAN');\n");
    const quoteGit=value=>'"'+value.replaceAll('\\','/').replaceAll('"','\\"')+'"';
    git('config','--local','diff.external',`${quoteGit(process.execPath)} ${quoteGit(helper)}`);
  }
  else if(step.op==='configure-textconv') {
    const helper=join(cwd,'.git/eval-textconv-helper.cjs');
    writeFileSync(helper,"console.log('EVAL_TEXTCONV_RAN ' + process.argv.at(-1));\n");
    const quoteGit=value=>'"'+value.replaceAll('\\','/').replaceAll('"','\\"')+'"';
    git('config','--local','diff.eval.textconv',`${quoteGit(process.execPath)} ${quoteGit(helper)}`);
  }
  else throw new Error('unknown setup');
}
const snapshot = () => {
  const paths=git('ls-files','--cached','--others','--exclude-standard','-z').split('\0').filter(Boolean);
  return {head:git('rev-parse','HEAD').trim(),status:git('status','--porcelain=v1','--untracked-files=all'),index:hash(readFileSync(join(cwd,'.git/index'))),gitConfig:hash(readFileSync(join(cwd,'.git/config'))),
    files:Object.fromEntries([...new Set(paths)].sort().map(path=>[path,existsSync(join(cwd,path))?hash(readFileSync(join(cwd,path))):null]))};
};
const sourceBefore=snapshot();
const loaded=(await loadToolkitManifest()).assets.find(asset=>asset.id==='skill:code-review-and-quality'); assert.ok(loaded);
const candidateParagraphs = '清单中的审查对象同时记录路径、Git 变更状态和来源层（暂存、工作树或 untracked）；不要按路径单独去重。同一路径被暂存删除后又创建为 untracked 时，是两个需要分别解释的对象。改名保留原路径和目标路径，二进制变化保留原始字节哈希及实际检查方式。\n\n获取用于审查和哈希的 Git 文本补丁时禁用 external diff 与 textconv（`--no-ext-diff --no-textconv`），避免外部程序改变证据或在采集时执行。保留命令退出状态并核对输出是否完整；工具提示截断、读取失败或路径清单不全时，标记缺口并按文件/区段补读，不能记录为完整审阅。\n\nGit 的 `change_status` 与审阅回执的 `review_status` 分别记录，不要相互覆盖。\n\n';
const asset={id:loaded.id,kind:loaded.meta.kind,name:loaded.meta.name,title:loaded.meta.title,summary:loaded.meta.description,body:loaded.body,
  platforms:loaded.meta.platforms,attachments:loaded.attachments.filter(a=>!a.relativePath.endsWith('LICENSE-open-code-review.txt')).map(a=>({...a}))};
asset.body=readFileSync(resolve('tests/skill-evals/baselines/code-review-and-quality-body.md'),'utf8');
assert.equal(hash(asset.body),'851ad99409746d84c05f6d66cacb2b7cba40beb73777314e3bca953a924397dd');
const reference=asset.attachments.find(a=>a.relativePath.endsWith('review-coverage-contract.md')); assert.ok(reference);
reference.contents=readFileSync(resolve('tests/skill-evals/baselines/review-coverage-contract.md'),'utf8');
assert.equal(hash(reference.contents),'42b4e9e14a2e2d914bb81517e0bbc5d2059cbb18a090aae6080d1c07edd0d609');
if(arm==='candidate') {
  const before=reference.contents;
  reference.contents=before.replace(/```text\r?\nReview coverage:/,candidateParagraphs+'```text\nReview coverage:');
  assert.notEqual(reference.contents,before,'candidate insertion must change the reference');
  reference.contents+='\n## 方法来源与改写\n\n同路径变更身份与原始补丁采集方法参考 [Alibaba Open Code Review delegation skill](https://github.com/alibaba/open-code-review/blob/0d403392073bcb0d3894c5364b0a85e7b6a47e0d/plugins/open-code-review/skills/open-code-review-delegate/SKILL.md)（Apache-2.0）。本项目用中文重写，保留本地 diff identity、内容哈希、review_status 与阻断规则；不依赖或调用 OCR CLI。适用许可证随产物提供于 [LICENSE-open-code-review.txt](LICENSE-open-code-review.txt)。\n';
  asset.attachments.push({relativePath:'assets/references/LICENSE-open-code-review.txt',contents:readFileSync(resolve('tests/skill-evals/baselines/LICENSE-open-code-review.txt'),'utf8')});
  const bodyBefore=asset.body;
  const guard='首次采集补丁前就关闭 Git 外部 diff 与 textconv，避免执行仓库配置的转换程序或把转换结果当作原始变更。所有用于审查或哈希的 `diff` / `show` 补丁命令都带 `--no-ext-diff --no-textconv`；不要先运行普通 diff 试探再补安全版本。工作树示例：\n\n```sh\ngit --no-pager diff --no-ext-diff --no-textconv --no-color HEAD -- <path>\n```\n\n提交或范围审查替换为对应 refs；untracked 文件直接读取。完整身份、截断和回执要求见 `references/review-coverage-contract.md`。\n\n';
  asset.body=bodyBefore.replace(/## 执行步骤\r?\n\r?\n/, '## 执行步骤\n\n'+guard);
  assert.notEqual(asset.body,bodyBefore,'candidate v2 must protect the first patch collection in the body');
}
const plan=createCodexMarketplaceGenerationPlan({source:'behavior-study',assets:[asset]}, {marketplaceName:'zc-eval',pluginVersion:'0.0.1'});
for(const a of plan.artifacts){const path=join(market,a.path);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,a.content);}
const config=`model = "gpt-6-astra"\nmodel_provider = "custom"\nmodel_reasoning_effort = "high"\napproval_policy = "never"\nproject_doc_max_bytes = 0\nweb_search = "disabled"\ndefault_permissions = "eval"\n[features]\nshell_snapshot = false\n[model_providers.custom]\n${provider}\n[permissions.eval.filesystem]\n":root" = "read"\n${q(resolve('.'))} = "deny"\n${q(userHome)} = "deny"\n${q(join(process.env.USERPROFILE,'.agents'))} = "deny"\n${q(cwd)} = "read"\n${q(join(home,'skills'))} = "read"\n${q(join(home,'plugins/cache'))} = "read"\n${q(dirname(binary))} = "read"\n[permissions.eval.network]\nenabled = false\n[windows]\nsandbox = "elevated"\n`;
writeFileSync(join(home,'config.toml'),config.replace('shell_snapshot = false', 'shell_snapshot = false\napps = false\nremote_plugin = false\nplugin_discovery_prefetch = false').replace('[permissions.eval.network]', `${q(scratch)} = "write"\n${q(env.GIT_CONFIG_GLOBAL)} = "read"\n${q(join(home,'auth.json'))} = "deny"\n[permissions.eval.network]`));
const cli=(args)=>execFileSync(binary,args,{cwd,env,encoding:'utf8',windowsHide:true,timeout:45000});
cli(['plugin','marketplace','add',market,'--json']);cli(['plugin','add','zc-toolkit@zc-eval','--json']);
const hostVersion=cli(['--version']).trim();
const installed=join(home,'plugins/cache/zc-eval/zc-toolkit/0.0.1');
let cacheFilesVerified=0;
for(const artifact of plan.artifacts) {
  const match=artifact.path.match(/(?:^|\/)skills\/(.+)$/);
  if(!match) continue;
  assert.equal(hash(readFileSync(join(installed,'skills',match[1]))),hash(artifact.content),`cache mismatch: ${match[1]}`);
  cacheFilesVerified++;
}
assert.ok(cacheFilesVerified>1,'skill body and references must be verified');
// Only open streams and close them: never print denied file contents.
writeFileSync(join(home,'auth.json'), 'non-secret isolation probe');
const currentSid=execFileSync('whoami',['/user','/fo','csv','/nh'],{encoding:'utf8',windowsHide:true}).match(/S-1-\d+(?:-\d+)+/)?.[0];
assert.ok(currentSid,'current Windows SID unavailable');
execFileSync('icacls',[join(home,'auth.json'),'/inheritance:r','/grant:r',`*${currentSid}:F`,'*S-1-5-18:F'],{windowsHide:true,stdio:'pipe'});
const denied=[suitePath,resolve('packages/toolkit/src/content/skills/code-review-and-quality/body.md'),join(userHome,'AGENTS.md'),join(home,'auth.json')];
const probeScript=`$ErrorActionPreference='Stop'; $f=[IO.File]::OpenRead(${psq(join(cwd,'src/access.js'))}); $f.Dispose(); `+denied.map((path,index)=>`try { $f=[IO.File]::OpenRead(${psq(path)}); $f.Dispose(); Write-Output 'DENY_FAILED:${index}'; exit 7 } catch [UnauthorizedAccessException] { }`).join('; ')+'; Write-Output ISOLATION_OK'+(item.setup.some(step=>step.op==='configure-textconv')?'; git --no-pager diff --no-ext-diff -- src/access.js; if ($LASTEXITCODE -ne 0) { exit 8 }; git --no-pager diff --no-ext-diff --no-textconv -- src/access.js; if ($LASTEXITCODE -ne 0) { exit 9 }':'');
const probe=spawnSync(binary,['sandbox','-P','eval','-C',cwd,'pwsh','-NoProfile','-Command',probeScript],{cwd,env,encoding:'utf8',windowsHide:true,timeout:120000});
writeFileSync(join(root,'preflight.json'),JSON.stringify({status:probe.status,stdout:probe.stdout,stderr:probe.stderr,error:probe.error?.message,denied},null,2));
if (probe.status !== 0) {
  rmSync(join(home,'auth.json'));
  throw new Error(`Sandbox preflight failed before credential copy; inspect ${join(root,'preflight.json')}: ${probe.error?.message ?? `exit ${probe.status}`}`);
}
assert.match(probe.stdout,/ISOLATION_OK/);
if(item.setup.some(step=>step.op==='configure-textconv')) { assert.match(probe.stdout,/^[+-]EVAL_TEXTCONV_RAN /m);assert.match(probe.stdout,/Boolean\(user\)/); }
const frozen={caseId,arm,repeat,candidateRevision:arm==='candidate'?'v2-body-first-patch':'baseline',model:'gpt-6-astra',effort:'high',fixtureHash:hash(JSON.stringify({input:item.input,seed:item.seed,setup:item.setup})),oracleHash:hash(JSON.stringify(item.oracle)),contentHash:hash(JSON.stringify(asset)),sourceBefore,
  hostVersion,cacheFilesVerified,adapterHash:hash(readFileSync(resolve('scripts/lib/codex-eval-capture.mjs'))),
  scope:'explicit-native-skill-input; content behavior only, not implicit routing',limits:{timeoutMs:240000,maxToolCalls:20,maxTokens:160000}};
writeFileSync(join(root,'frozen.json'),JSON.stringify(frozen,null,2));
console.log(JSON.stringify({phase:'prepared',root,caseId,arm,repeat}));
try {
  Object.assign(process.env,{TEMP:scratch,TMP:scratch,TMPDIR:scratch,GIT_CONFIG_GLOBAL:env.GIT_CONFIG_GLOBAL,GIT_CONFIG_NOSYSTEM:'1',GIT_OPTIONAL_LOCKS:'0'});
  // Temporary credential copy is denied to task tools and removed even on failure.
  // Overwrite the same probed file: unlink/recreate would discard its verified ACL.
  writeFileSync(join(home,'auth.json'),readFileSync(join(userHome,'auth.json')));
  const capture=await captureCodex({binary,home,cwd,outputDir,model:frozen.model,effort:frozen.effort,permissionProfile:'eval',
    input:[{type:'text',text:item.input,text_elements:[]}],skillName:'zc-toolkit:code-review-and-quality',...frozen.limits});
  const sourceAfter=snapshot();
  const receipt={root,caseId,arm,repeat,status:capture.status,reason:capture.reason,sourceUnchanged:JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),
    userConfigUnchanged:hash(readFileSync(join(userHome,'config.toml')))===userConfigHash,authSourceUnchanged:hash(readFileSync(join(userHome,'auth.json')))===authHash};
  writeFileSync(join(root,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
} finally { if(existsSync(join(home,'auth.json'))) rmSync(join(home,'auth.json')); }
