import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { planInstall, applyInstall, uninstall, summarizePlan, inspectConfiguration } from '../src/install.mjs';

async function fixture(t, client = 'codex') {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'policy-install-')));
  t.after(() => fs.rm(root, {recursive:true, force:true}));
  const home = path.join(root, "home with ' quote");
  await fs.mkdir(home);
  const policyPath = path.join(root, 'input.json');
  await fs.copyFile(new URL('../policies/balanced.json', import.meta.url), policyPath);
  return {root, client, home, stateDir:path.join(home, '.local/state/agent-policy'), policyPath, packageRoot:path.resolve('.'), nodePath:process.execPath};
}
async function put(p, s) { await fs.mkdir(path.dirname(p), {recursive:true}); await fs.writeFile(p, s); }

import { parseToml } from '../src/toml.mjs';
const directories = {codex:'.codex',claude:'.claude',kimi:'.kimi-code',agy:'.gemini'};
const modelConfig = `default_model = "main"
[providers.fixture]
type = "kimi"
api_key = "private-fixture"
[models."kimi-code/k3"]
provider = "fixture"
model = "k3"
max_context_size = 1048576
support_efforts = ["low", "high"]
[models."kimi-code/kimi-for-coding"]
provider = "fixture"
model = "kimi-for-coding"
max_context_size = 262144
support_efforts = ["low", "high"]
`;
async function provision(f) { await put(path.join(f.home,'.kimi-code/config.toml'),modelConfig); }
function rolePath(f, role) { return path.join(f.home,directories[f.client],f.client==='agy'?'config/agents':'agents',`apk-${role}.${f.client==='codex'?'toml':'md'}`); }
function instructionPath(f) { return path.join(f.home,directories[f.client],f.client==='claude'?'CLAUDE.md':'AGENTS.md'); }

test('all four clients generate standalone native roles and no runtime files',async t=>{
 for(const client of ['codex','claude','kimi','agy']) {
  const f=await fixture(t,client); if(client==='kimi')await provision(f);
  const policy=JSON.parse(await fs.readFile(f.policyPath));
  const plan=await planInstall(f); assert.equal(plan.status,'planned');
  await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
  assert.ok(!JSON.stringify(summarizePlan(plan)).includes(f.root));
  await applyInstall(plan);
  for(const role of ['worker','reviewer','explorer','routine']) {
   const content=await fs.readFile(rolePath(f,role),'utf8');
   const selected=policy.clients[client][['worker','reviewer'].includes(role)?'code':'light'];
   assert.match(content,new RegExp('apk-'+role));
   if(client==='codex') { const native=parseToml(content); assert.equal(native.name,'apk-'+role); assert.equal(native.model,selected.model); assert.equal(native.model_reasoning_effort,selected.effort); assert.ok(native.description&&native.developer_instructions); }
   else if(client==='kimi') { assert.ok(!/^model:/m.test(content)); assert.ok(content.includes(selected.model)); }
   else { assert.equal(JSON.parse(content.match(/^model: (.+)$/m)[1]),selected.model); if(client==='claude')assert.ok(content.includes('effort: '+selected.effort));else assert.ok(!/^effort:/m.test(content)); }
   for(const forbidden of [f.packageRoot,f.nodePath,f.stateDir,'agent-policy.mjs','hook','launcher','plugin']) assert.ok(!content.includes(forbidden),forbidden);
  }
  assert.match(await fs.readFile(instructionPath(f),'utf8'),/at most 3/);
  assert.equal((await planInstall(f)).status,'unchanged');
  await assert.rejects(fs.stat(path.join(f.home,'.codex/hooks.json')),{code:'ENOENT'});
  await assert.rejects(fs.stat(path.join(f.stateDir,'bin')),{code:'ENOENT'});
 }
});

test('Codex native defaults preserve main settings and unrelated hooks byte for byte',async t=>{
 const f=await fixture(t), config=path.join(f.home,'.codex/config.toml');
 const original='# private comment\nmodel = "main"\nmodel_reasoning_effort = "ultra"\n[agents]\nmax_concurrent_threads_per_session = 9 # cap\n';
 const hooks=path.join(f.home,'.codex/hooks.json'); await put(hooks,'{"user":"opaque"}\n');await put(config,original);
 await applyInstall(await planInstall(f));const native=parseToml(await fs.readFile(config,'utf8'));
 assert.equal(native.model,'main');assert.equal(native.model_reasoning_effort,'ultra');assert.equal(native.agents.default_subagent_model,'gpt-6.1-sol');assert.equal(native.agents.default_subagent_reasoning_effort,'high');assert.equal(native.agents.max_concurrent_threads_per_session,3);
 assert.equal(await fs.readFile(hooks,'utf8'),'{"user":"opaque"}\n');
 await uninstall({...f,apply:true});assert.equal((await fs.readFile(config,'utf8')).trim(),original.trim());
});

test('instructions merge once, preserve unrelated later edits, and reject owned block drift',async t=>{
 const f=await fixture(t), target=instructionPath(f),original='# Existing\nKeep this.';await put(target,original);
 await applyInstall(await planInstall(f));const content=await fs.readFile(target,'utf8');assert.ok(content.startsWith(original));
 assert.equal((await planInstall(f)).status,'unchanged');assert.equal((content.match(/BEGIN agent-policy-kit/g)||[]).length,1);
 await fs.writeFile(target,content.replace('apk-worker','user-worker'));await assert.rejects(uninstall({...f,apply:true}),{code:'OWNED_DRIFT'});
 await fs.writeFile(target,'User prefix\n'+content+'\nUser suffix\n');await uninstall({...f,apply:true});assert.equal(await fs.readFile(target,'utf8'),'User prefix\n'+original+'\nUser suffix\n');
});

test('same-name roles or instruction markers conflict without writes',async t=>{
 const f=await fixture(t);await put(rolePath(f,'worker'),'user-owned');await assert.rejects(planInstall(f),{code:'OWNERSHIP_CONFLICT'});await fs.rm(rolePath(f,'worker'));
 await put(instructionPath(f),'<!-- BEGIN agent-policy-kit -->\nuser block\n');await assert.rejects(planInstall(f),{code:'OWNERSHIP_CONFLICT'});await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
});

test('Claude preserves main, unrelated env, hooks and plugins; uninstall restores owned defaults',async t=>{
 const f=await fixture(t,'claude'),target=path.join(f.home,'.claude/settings.json');
 const original={model:'main',effortLevel:'max',env:{EXISTING:'private',CLAUDE_CODE_SUBAGENT_MODEL:'old'},hooks:{PreToolUse:[{matcher:'Bash',hooks:[{type:'command',command:'echo user'}]}]},enabledPlugins:{user:true}};await put(target,JSON.stringify(original));
 await applyInstall(await planInstall(f));const settings=JSON.parse(await fs.readFile(target));assert.equal(settings.env.CLAUDE_CODE_SUBAGENT_MODEL,'sonnet');assert.equal(settings.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS,'3');assert.deepEqual(settings.hooks,original.hooks);assert.deepEqual(settings.enabledPlugins,original.enabledPlugins);assert.equal(settings.model,'main');settings.later=true;await fs.writeFile(target,JSON.stringify(settings));
 settings.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS='5';await fs.writeFile(target,JSON.stringify(settings));await assert.rejects(uninstall({...f,apply:true}),{code:'OWNED_DRIFT'});settings.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS='3';await fs.writeFile(target,JSON.stringify(settings));
 await uninstall({...f,apply:true});assert.deepEqual(JSON.parse(await fs.readFile(target)),{...original,later:true});
});

test('Claude forced single model is an explicit prerequisite with zero writes',async t=>{
 const f=await fixture(t,'claude');await put(path.join(f.home,'.claude/settings.json'),JSON.stringify({env:{CLAUDE_CODE_SUBAGENT_MODEL_FORCE:'1'}}));const plan=await planInstall(f);assert.equal(plan.status,'prerequisite');assert.ok(plan.warnings.includes('claude-force-model-conflict'));assert.equal(plan.changes.length,0);await applyInstall(plan);await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
});

test('Kimi provisioned aliases receive per-alias effort and pool routing without altering identity or credentials',async t=>{
 const f=await fixture(t,'kimi');const target=path.join(f.home,'.kimi-code/config.toml');await put(target,modelConfig+'[secondary_model]\ndefault_effort = "high" # former global\ndefault_model = "kimi-code/k3"\n[secondary_model.models]\n"kimi-code/k3" = "old hint"\n');
 const original=parseToml(await fs.readFile(target,'utf8'));await applyInstall(await planInstall(f));const native=parseToml(await fs.readFile(target,'utf8'));
 assert.equal(native.default_model,'main');assert.deepEqual(native.providers,original.providers);assert.equal(native.secondary_model.default_effort,undefined);
 const preferences=JSON.parse(await fs.readFile(f.policyPath)).clients.kimi;
 for(const kind of ['code','light']){const selected=preferences[kind];assert.equal(native.models[selected.model].overrides.default_effort,selected.effort);assert.equal(native.models[selected.model].model,original.models[selected.model].model);assert.ok(native.secondary_model.models[selected.model]);}
 await uninstall({...f,apply:true});assert.deepEqual(parseToml(await fs.readFile(target,'utf8')),original);
});

test('Kimi missing aliases or unsupported effort are explicit prerequisites with zero writes',async t=>{
 const f=await fixture(t,'kimi');let plan=await planInstall(f);assert.equal(plan.status,'prerequisite');assert.ok(plan.warnings.includes('kimi-provisioned-models-required'));assert.equal(plan.changes.length,0);await applyInstall(plan);await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
 await put(path.join(f.home,'.kimi-code/config.toml'),modelConfig.replaceAll('["low", "high"]','["high"]'));plan=await planInstall(f);assert.equal(plan.status,'prerequisite');assert.ok(plan.warnings.includes('kimi-supported-effort-required'));
});

test('malformed configs, duplicate keys, native scalar mismatches and cap aliases refuse planning',async t=>{
 const f=await fixture(t,'claude'),target=path.join(f.home,'.claude/settings.json');await put(target,'{"env":{},"env":{}}');await assert.rejects(planInstall(f),{code:'INVALID_JSON'});await put(target,'{"env":[]}');await assert.rejects(planInstall(f),{code:'UNSUPPORTED_CONFIG'});
 const codex=await fixture(t),native=path.join(codex.home,'.codex/config.toml');await put(native,'[broken');await assert.rejects(planInstall(codex),{code:'INVALID_TOML'});await put(native,'[agents]\nmax_threads = 9\n');await assert.rejects(planInstall(codex),{code:'CODEX_CAP_ALIAS_CONFLICT'});
});

test('legacy runtime receipts and forged restoration values are rejected explicitly',async t=>{
 const f=await fixture(t);const receipt=path.join(f.stateDir,'installations/codex.json');await put(receipt,JSON.stringify({schemaVersion:1,client:'codex',packageRoot:'/old/runtime'}));await assert.rejects(planInstall(f),{code:'LEGACY_RUNTIME_RECEIPT'});await assert.rejects(uninstall(f),{code:'LEGACY_RUNTIME_RECEIPT'});await fs.rm(receipt);
 await applyInstall(await planInstall(f));const record=JSON.parse(await fs.readFile(receipt));record.files.find(v=>v.type==='toml').ops[0].before='9\nmodel = "FORGED"';await fs.writeFile(receipt,JSON.stringify(record));await assert.rejects(uninstall({...f,apply:true}),{code:'INVALID_RECEIPT'});
});

test('native configuration survives removing package source, input preferences and state',async t=>{
 const f=await fixture(t);f.packageRoot=path.join(f.root,'npm-package');await fs.mkdir(f.packageRoot);await applyInstall(await planInstall(f));await fs.rm(f.packageRoot,{recursive:true});await fs.rm(f.policyPath);await fs.rm(f.stateDir,{recursive:true});const config=parseToml(await fs.readFile(path.join(f.home,'.codex/config.toml'),'utf8'));assert.equal(config.agents.default_subagent_model,'gpt-6.1-sol');assert.equal(parseToml(await fs.readFile(rolePath(f,'explorer'),'utf8')).model,'gpt-6-luna');assert.match(await fs.readFile(instructionPath(f),'utf8'),/apk-reviewer/);
});

test('symlink parent swaps between planning and applying refuse all config changes', async t => {
  const f = await fixture(t);
  const plan = await planInstall(f);
  const other = path.join(f.root,'external'); await fs.mkdir(other);
  await fs.symlink(other,path.join(f.home,'.codex'));
  await assert.rejects(applyInstall(plan), {code:'UNSAFE_PATH'});
  assert.deepEqual(await fs.readdir(other),[]);
});

test('private backups and receipts stay private even when input config permissions are broad', async t => {
  const f = await fixture(t);
  await put(path.join(f.home,'.codex/config.toml'),'model = "private"\n');
  await applyInstall(await planInstall(f));
  assert.equal((await fs.stat(path.join(f.stateDir,'installations/codex.json'))).mode & 0o777,0o600);
  const transactions = await fs.readdir(path.join(f.stateDir,'backups'));
  assert.equal(transactions.length,1);
  const backupDir = path.join(f.stateDir,'backups',transactions[0]);
  assert.equal((await fs.stat(backupDir)).mode & 0o777,0o700);
  for (const file of await fs.readdir(backupDir)) assert.equal((await fs.stat(path.join(backupDir,file))).mode & 0o777,0o600);
});

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
async function failingChild(f, drift = false) {
  const preloader = path.join(f.root,'preloader.mjs');
  const entry = path.join(f.root,'transaction.mjs');
  const receipt = path.join(f.stateDir,`installations/${f.client}.json`);
  const firstTarget = path.join(f.home,'.codex/agents/apk-worker.toml');
  await fs.writeFile(preloader, `import fs from 'node:fs/promises';\nimport {syncBuiltinESMExports} from 'node:module';\nconst rename = fs.rename; let failed = false;\nfs.rename = async (from,to) => { if (to === ${JSON.stringify(receipt)} && !failed) { failed = true; ${drift ? `await fs.writeFile(${JSON.stringify(firstTarget)}, '{}\\n');` : ''} throw Object.assign(new Error('injected disk error'), {code:'EIO'}); } return rename(from,to); };\nsyncBuiltinESMExports();\n`);
  await fs.writeFile(entry, `import {planInstall,applyInstall} from ${JSON.stringify(new URL('../src/install.mjs',import.meta.url).href)};\ntry { await applyInstall(await planInstall(${JSON.stringify(f)})); process.exitCode=2; } catch(e) { console.log(e.code); }\n`);
  return run(process.execPath,['--import',preloader,entry]);
}

test('a late disk failure rolls all committed files back to their exact preimages', async t => {
  const f = await fixture(t);
  const target = path.join(f.home,'.codex/config.toml'), original = '# exact bytes\nmodel = "main"\n';
  await put(target,original);
  const result = await failingChild(f);
  assert.equal(result.stdout.trim(),'INSTALL_FAILED');
  assert.equal(await fs.readFile(target,'utf8'),original);
  await assert.rejects(fs.stat(path.join(f.home,'.codex/agents/apk-worker.toml')),{code:'ENOENT'});
  await assert.rejects(fs.stat(path.join(f.stateDir,'policy.json')),{code:'ENOENT'});
  await assert.rejects(fs.stat(path.join(f.stateDir,'pending.json')),{code:'ENOENT'});
  assert.ok(!(await fs.readdir(path.dirname(target))).some(p=>p.endsWith('.tmp')));
});

test('rollback preserves concurrent postimage drift and retains a recovery journal', async t => {
  const f = await fixture(t);
  const result = await failingChild(f,true);
  assert.equal(result.stdout.trim(),'ROLLBACK_CONFLICT');
  assert.equal(await fs.readFile(path.join(f.home,'.codex/agents/apk-worker.toml'),'utf8'),'{}\n');
  assert.ok(await fs.stat(path.join(f.stateDir,'pending.json')));
  await assert.rejects(planInstall(f),{code:'RECOVERY_REQUIRED'});
});

test('symlink ancestors of supplied home and external state roots are refused', async t => {
  const f = await fixture(t);
  const alias = path.join(f.root,'alias');
  await fs.symlink(f.home,alias);
  await fs.mkdir(path.join(f.home,'nested'));
  await assert.rejects(planInstall({...f,home:path.join(alias,'nested')}),{code:'UNSAFE_PATH'});
  await assert.rejects(planInstall({...f,stateDir:path.join(alias,'nested','state')}),{code:'UNSAFE_PATH'});
});

test('missing policy clients and native scalar type mismatches fail during read-only planning', async t => {
  const f = await fixture(t);
  const policy = JSON.parse(await fs.readFile(f.policyPath));
  delete policy.clients.codex;
  await fs.writeFile(f.policyPath,JSON.stringify(policy));
  await assert.rejects(planInstall(f),{code:'INVALID_POLICY'});
  await fs.copyFile(new URL('../policies/balanced.json',import.meta.url),f.policyPath);
  await put(path.join(f.home,'.codex/config.toml'),'[agents]\nmax_concurrent_threads_per_session = "eight"\n');
  await assert.rejects(planInstall(f),{code:'UNSUPPORTED_CONFIG'});
});

test('an interrupted child process leaves a private journal and forces explicit recovery', async t => {
  const f = await fixture(t);
  const preloader = path.join(f.root,'crash-preloader.mjs');
  const entry = path.join(f.root,'crash-transaction.mjs');
  const firstTarget = path.join(f.home,'.codex/agents/apk-worker.toml');
  await fs.writeFile(preloader,`import fs from 'node:fs/promises'; import {syncBuiltinESMExports} from 'node:module'; const rename = fs.rename; fs.rename = async (from,to) => { const result = await rename(from,to); if (to === ${JSON.stringify(firstTarget)}) process.kill(process.pid,'SIGKILL'); return result; }; syncBuiltinESMExports();\n`);
  await fs.writeFile(entry,`import {planInstall,applyInstall} from ${JSON.stringify(new URL('../src/install.mjs',import.meta.url).href)}; await applyInstall(await planInstall(${JSON.stringify(f)}));\n`);
  await assert.rejects(run(process.execPath,['--import',preloader,entry]),{signal:'SIGKILL'});
  const pendingPath = path.join(f.stateDir,'pending.json');
  const pending = JSON.parse(await fs.readFile(pendingPath));
  assert.equal((await fs.stat(pendingPath)).mode & 0o777,0o600);
  assert.ok(await fs.stat(path.join(pending.backupDir,'index.json')));
  assert.ok(await fs.stat(firstTarget));
  await assert.rejects(planInstall(f),{code:'RECOVERY_REQUIRED'});
  await assert.rejects(uninstall({...f,apply:true}),{code:'RECOVERY_REQUIRED'});
});

test('atomic replacements preserve the exact existing config permission bits', async t => {
  const f = await fixture(t,'claude');
  const target = path.join(f.home,'.claude/settings.json');
  await put(target,'{"model":"main"}\n');
  await fs.chmod(target,0o660);
  await applyInstall(await planInstall(f));
  assert.equal((await fs.stat(target)).mode & 0o777,0o660);
  await uninstall({...f,apply:true});
  assert.equal((await fs.stat(target)).mode & 0o777,0o660);
});

test('apply rejects stale unchanged native config and shared policy dependencies', async t => {
  for (const dependency of ['native','shared-policy','source-policy']) {
    const f = await fixture(t);
    const native = path.join(f.home,'.codex/config.toml');
    const matching = '[agents]\nmax_concurrent_threads_per_session = 3\ndefault_subagent_model = "gpt-6.1-sol"\ndefault_subagent_reasoning_effort = "high"\n';
    await put(native,matching);
    const policy = JSON.parse(await fs.readFile(f.policyPath,'utf8'));
    await put(path.join(f.stateDir,'policy.json'),JSON.stringify(policy,null,2)+'\n');
    const plan = await planInstall(f);
    assert.ok(!plan.changes.some(c=>c.path === native));
    assert.ok(!plan.changes.some(c=>c.path === path.join(f.stateDir,'policy.json')));
    if (dependency === 'native') await fs.writeFile(native,matching.replace('= 3','= 999').replace('= true','= false'));
    else await fs.writeFile(dependency === 'shared-policy' ? path.join(f.stateDir,'policy.json') : f.policyPath,'{}\n');
    await assert.rejects(applyInstall(plan),{code:'STALE_PLAN'});
    await assert.rejects(fs.stat(path.join(f.home,'.codex/agents/apk-worker.toml')),{code:'ENOENT'});
    await assert.rejects(fs.stat(path.join(f.stateDir,'installations/codex.json')),{code:'ENOENT'});
  }
});

test('apply rejects stale no-op installs and stale missing-receipt uninstall plans', async t => {
  const f = await fixture(t);
  await applyInstall(await planInstall(f));
  const unchanged = await planInstall(f);
  assert.equal(unchanged.status,'unchanged');
  await fs.writeFile(path.join(f.stateDir,'policy.json'),'{}\n');
  await assert.rejects(applyInstall(unchanged),{code:'STALE_PLAN'});
  const absent = await fixture(t,'claude');
  const noUninstall = await uninstall({...absent,apply:false});
  await put(path.join(absent.stateDir,'installations/claude.json'),'{}\n');
  await assert.rejects(applyInstall(noUninstall),{code:'STALE_PLAN'});
});

test('unchanged dependencies are rechecked after staging and after the last commit', async t => {
  for (const during of ['staging','last-commit']) {
    const f = await fixture(t);
    const native = path.join(f.home,'.codex/config.toml');
    const original = '[agents]\nmax_concurrent_threads_per_session = 3\ndefault_subagent_model = "gpt-6.1-sol"\ndefault_subagent_reasoning_effort = "high"\n';
    await put(native,original);
    const preloader = path.join(f.root,'dependency-preloader.mjs');
    const entry = path.join(f.root,'dependency-transaction.mjs');
    const trigger = during === 'staging' ? path.join(f.stateDir,'pending.json') : path.join(f.stateDir,'installations/codex.json');
    await fs.writeFile(preloader,`import fs from 'node:fs/promises'; import {syncBuiltinESMExports} from 'node:module'; const method = ${JSON.stringify(during === 'staging' ? 'open' : 'rename')}; const original = fs[method]; let changed = false; fs[method] = async (...args) => { const result = await original(...args); if (!changed && args[${during === 'staging' ? '0' : '1'}] === ${JSON.stringify(trigger)}) { changed = true; await fs.writeFile(${JSON.stringify(native)},${JSON.stringify(original.replace('= 3','= 999'))}); } return result; }; syncBuiltinESMExports();\n`);
    await fs.writeFile(entry,`import {planInstall,applyInstall} from ${JSON.stringify(new URL('../src/install.mjs',import.meta.url).href)}; try { await applyInstall(await planInstall(${JSON.stringify(f)})); console.log('WRONGLY_APPLIED'); } catch(e) { console.log(e.code); }\n`);
    const result = await run(process.execPath,['--import',preloader,entry]);
    assert.equal(result.stdout.trim(),'STALE_PLAN');
    assert.match(await fs.readFile(native,'utf8'),/= 999/);
    await assert.rejects(fs.stat(path.join(f.home,'.codex/agents/apk-worker.toml')),{code:'ENOENT'});
    await assert.rejects(fs.stat(path.join(f.stateDir,'installations/codex.json')),{code:'ENOENT'});
  }
});

test('late finalization sync failure preserves a recovery journal when rollback meets a competing edit', async t => {
  const f = await fixture(t);
  const hooks = path.join(f.home,'.codex/agents/apk-worker.toml');
  const pending = path.join(f.stateDir,'pending.json');
  const preloader = path.join(f.root,'finalization-preloader.mjs');
  const entry = path.join(f.root,'finalization-transaction.mjs');
  await fs.writeFile(preloader,`import fs from 'node:fs/promises'; import {syncBuiltinESMExports} from 'node:module'; const open = fs.open, unlink = fs.unlink; let removed = false, failed = false; fs.unlink = async file => { const result = await unlink(file); if (file === ${JSON.stringify(pending)}) removed = true; return result; }; fs.open = async (file,...args) => { const handle = await open(file,...args); if (file === ${JSON.stringify(f.stateDir)}) { const sync = handle.sync.bind(handle); handle.sync = async () => { if (removed && !failed) { failed = true; await fs.writeFile(${JSON.stringify(hooks)},'{"competing_edit":true}\\n'); throw Object.assign(new Error('injected finalization EIO'),{code:'EIO'}); } return sync(); }; } return handle; }; syncBuiltinESMExports();\n`);
  await fs.writeFile(entry,`import {planInstall,applyInstall} from ${JSON.stringify(new URL('../src/install.mjs',import.meta.url).href)}; try { await applyInstall(await planInstall(${JSON.stringify(f)})); console.log('WRONGLY_APPLIED'); } catch(e) { console.log(e.code); }\n`);
  const result = await run(process.execPath,['--import',preloader,entry]);
  assert.equal(result.stdout.trim(),'ROLLBACK_CONFLICT');
  assert.equal(await fs.readFile(hooks,'utf8'),'{"competing_edit":true}\n');
  const journal = JSON.parse(await fs.readFile(pending,'utf8'));
  assert.equal((await fs.stat(pending)).mode & 0o777,0o600);
  assert.ok(await fs.stat(path.join(journal.backupDir,'index.json')));
  await assert.rejects(planInstall(f),{code:'RECOVERY_REQUIRED'});
});

test('shared policies with identical semantics preserve formatting and stay idempotent across source key order', async t => {
  const f = await fixture(t);
  const source = await fs.readFile(f.policyPath,'utf8');
  await put(path.join(f.stateDir,'policy.json'),source);
  await applyInstall(await planInstall(f));
  assert.equal(await fs.readFile(path.join(f.stateDir,'policy.json'),'utf8'),source);
  const policy = JSON.parse(source);
  await fs.writeFile(f.policyPath,JSON.stringify({clients:policy.clients,maxConcurrent:policy.maxConcurrent,schemaVersion:policy.schemaVersion}));
  assert.equal((await planInstall(f)).status,'unchanged');
  await uninstall({...f,apply:true});
});

test('finalization rechecks unchanged dependencies before reporting success', async t => {
  const f = await fixture(t);
  const native = path.join(f.home,'.codex/config.toml');
  const original = '[agents]\nmax_concurrent_threads_per_session = 3\ndefault_subagent_model = "gpt-6.1-sol"\ndefault_subagent_reasoning_effort = "high"\n';
  await put(native,original);
  const preloader = path.join(f.root,'final-dependency-preloader.mjs');
  const entry = path.join(f.root,'final-dependency-transaction.mjs');
  await fs.writeFile(preloader,`import fs from 'node:fs/promises'; import {syncBuiltinESMExports} from 'node:module'; const unlink = fs.unlink; let changed = false; fs.unlink = async file => { const result = await unlink(file); if (!changed && file === ${JSON.stringify(path.join(f.stateDir,'pending.json'))}) { changed = true; await fs.writeFile(${JSON.stringify(native)},${JSON.stringify(original.replace('= 3','= 999'))}); } return result; }; syncBuiltinESMExports();\n`);
  await fs.writeFile(entry,`import {planInstall,applyInstall} from ${JSON.stringify(new URL('../src/install.mjs',import.meta.url).href)}; try { await applyInstall(await planInstall(${JSON.stringify(f)})); console.log('WRONGLY_APPLIED'); } catch(e) { console.log(e.code); }\n`);
  const result = await run(process.execPath,['--import',preloader,entry]);
  assert.equal(result.stdout.trim(),'STALE_PLAN');
  assert.match(await fs.readFile(native,'utf8'),/= 999/);
  await assert.rejects(fs.stat(path.join(f.home,'.codex/agents/apk-worker.toml')),{code:'ENOENT'});
});

test('failed recovery-journal recreation retains a private lock pointing to the backup index', async t => {
  const f = await fixture(t);
  const hooks = path.join(f.home,'.codex/agents/apk-worker.toml');
  const pending = path.join(f.stateDir,'pending.json');
  const preloader = path.join(f.root,'recovery-fallback-preloader.mjs');
  const entry = path.join(f.root,'recovery-fallback-transaction.mjs');
  await fs.writeFile(preloader,`import fs from 'node:fs/promises'; import {syncBuiltinESMExports} from 'node:module'; const open = fs.open, unlink = fs.unlink; let removed = false, failed = false; fs.unlink = async file => { const result = await unlink(file); if (file === ${JSON.stringify(pending)}) removed = true; return result; }; fs.open = async (file,...args) => { if (file === ${JSON.stringify(pending)} && removed) throw Object.assign(new Error('cannot recreate marker'),{code:'EIO'}); const handle = await open(file,...args); if (file === ${JSON.stringify(f.stateDir)}) { const sync = handle.sync.bind(handle); handle.sync = async () => { if (removed && !failed) { failed = true; await fs.writeFile(${JSON.stringify(hooks)},'{"competing_edit":true}\\n'); throw Object.assign(new Error('finalization EIO'),{code:'EIO'}); } return sync(); }; } return handle; }; syncBuiltinESMExports();\n`);
  await fs.writeFile(entry,`import {planInstall,applyInstall} from ${JSON.stringify(new URL('../src/install.mjs',import.meta.url).href)}; try { await applyInstall(await planInstall(${JSON.stringify(f)})); console.log('WRONGLY_APPLIED'); } catch(e) { console.log(e.code); }\n`);
  const result = await run(process.execPath,['--import',preloader,entry]);
  assert.equal(result.stdout.trim(),'RECOVERY_REQUIRED');
  assert.equal(await fs.readFile(hooks,'utf8'),'{"competing_edit":true}\n');
  await assert.rejects(fs.stat(pending),{code:'ENOENT'});
  const lock = path.join(f.stateDir,'.install.lock');
  const id = await fs.readFile(lock,'utf8');
  assert.equal((await fs.stat(lock)).mode & 0o777,0o600);
  assert.ok(await fs.stat(path.join(f.stateDir,'backups',id,'index.json')));
  await assert.rejects(planInstall(f),{code:'RECOVERY_REQUIRED'});
  await assert.rejects(uninstall({...f,apply:true}),{code:'RECOVERY_REQUIRED'});
});


test('malformed receipt collections and scalar restoration input refuse without leaking implementation errors',async t=>{
 for(const mutation of [r=>{r.files={};},r=>{r.files[0].ops=[null];},r=>{r.files[0].ops[0].before='9\n[agents.extra]\nx = 1';}]) {
  const f=await fixture(t);await applyInstall(await planInstall(f));const target=path.join(f.stateDir,'installations/codex.json'),record=JSON.parse(await fs.readFile(target));mutation(record);await fs.writeFile(target,JSON.stringify(record));await assert.rejects(uninstall({...f,apply:true}),{code:'INVALID_RECEIPT'});
 }
});

test('Kimi section effort type mismatch refuses planning before it can create an invalid receipt',async t=>{
 const f=await fixture(t,'kimi');await put(path.join(f.home,'.kimi-code/config.toml'),modelConfig+'[secondary_model]\ndefault_effort = 3\n');await assert.rejects(planInstall(f),{code:'UNSUPPORTED_CONFIG'});await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
});

test('native same-name role drift and newly added section-wide effort block removal safely',async t=>{
 const codex=await fixture(t);await applyInstall(await planInstall(codex));await fs.appendFile(rolePath(codex,'worker'),'# user edit\n');await assert.rejects(planInstall(codex),{code:'OWNED_DRIFT'});await assert.rejects(uninstall({...codex,apply:true}),{code:'OWNED_DRIFT'});
 const kimi=await fixture(t,'kimi');await provision(kimi);await applyInstall(await planInstall(kimi));const config=path.join(kimi.home,'.kimi-code/config.toml');let text=await fs.readFile(config,'utf8');text=text.replace('[secondary_model]\n','[secondary_model]\ndefault_effort = "low"\n');await fs.writeFile(config,text);await assert.rejects(uninstall({...kimi,apply:true}),{code:'OWNED_DRIFT'});
});

test('target symlinks, stale planned roles, explicit locks and pending journals refuse safely',async t=>{
 const f=await fixture(t),target=rolePath(f,'worker');await fs.mkdir(path.dirname(target),{recursive:true});await fs.symlink(f.policyPath,target);await assert.rejects(planInstall(f),{code:'UNSAFE_PATH'});await fs.rm(target);
 const plan=await planInstall(f);await put(target,'competing role');await assert.rejects(applyInstall(plan),{code:'STALE_PLAN'});await fs.rm(target);await fs.mkdir(f.stateDir,{recursive:true});await put(path.join(f.stateDir,'.install.lock'),'busy');await assert.rejects(applyInstall(await planInstall(f)),{code:'INSTALL_LOCKED'});await fs.rm(path.join(f.stateDir,'.install.lock'));await put(path.join(f.stateDir,'pending.json'),'{}');await assert.rejects(planInstall(f),{code:'RECOVERY_REQUIRED'});
});

test('same-value native scalars are adopted for drift checks and retained on uninstall',async t=>{
 const f=await fixture(t),target=path.join(f.home,'.codex/config.toml'),original='model = "main"\n[agents]\nmax_concurrent_threads_per_session = 3\ndefault_subagent_model = "gpt-6.1-sol"\ndefault_subagent_reasoning_effort = "high"\n';await put(target,original);const plan=await planInstall(f);assert.ok(!plan.changes.some(c=>c.path===target));await applyInstall(plan);await uninstall({...f,apply:true});assert.equal(await fs.readFile(target,'utf8'),original);
 const claude=await fixture(t,'claude'),jsonTarget=path.join(claude.home,'.claude/settings.json'),settings={model:'main',env:{CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS:'3',CLAUDE_CODE_SUBAGENT_MODEL:'sonnet'}};await put(jsonTarget,JSON.stringify(settings));await applyInstall(await planInstall(claude));await uninstall({...claude,apply:true});assert.deepEqual(JSON.parse(await fs.readFile(jsonTarget)),settings);
});

test('different shared preferences refuse planning and owned policy drift refuses repeat install',async t=>{
 const f=await fixture(t);await put(path.join(f.stateDir,'policy.json'),'{}\n');await assert.rejects(planInstall(f),{code:'POLICY_CONFLICT'});await fs.rm(path.join(f.stateDir,'policy.json'));await applyInstall(await planInstall(f));await fs.writeFile(path.join(f.stateDir,'policy.json'),'{}\n');await assert.rejects(planInstall(f),{code:'OWNED_DRIFT'});
});

test('Kimi keeps unrelated native pool entries, provider settings, hooks and later edits',async t=>{
 const f=await fixture(t,'kimi'),target=path.join(f.home,'.kimi-code/config.toml');const original=modelConfig+'[secondary_model]\ndefault_model = "kimi-code/k3"\n[secondary_model.models]\n"kimi-code/k3" = "user code hint"\n"other" = "preserve other model"\n[models.other]\nprovider = "fixture"\nmodel = "other"\nmax_context_size = 100\n[[hooks]]\nevent = "Stop"\ncommand = "user command"\n';await put(target,original);await applyInstall(await planInstall(f));let native=parseToml(await fs.readFile(target,'utf8'));assert.equal(native.secondary_model.models.other,'preserve other model');assert.deepEqual(native.hooks,parseToml(original).hooks);await fs.appendFile(target,'\n[user_settings]\nlater = true\n');await uninstall({...f,apply:true});native=parseToml(await fs.readFile(target,'utf8'));assert.deepEqual(native,{...parseToml(original),user_settings:{later:true}});
});

for(const kind of ['code','light']) test(`Kimi ${kind} reserved primary alias refuses installation despite complete provisioning`,async t=>{
 const f=await fixture(t,'kimi'),target=path.join(f.home,'.kimi-code/config.toml');
 const original=modelConfig+'[models.primary]\nprovider = "fixture"\nmodel = "fully-provisioned-primary"\nmax_context_size = 262144\nsupport_efforts = ["low", "high"]\n';
 await put(target,original);
 const preferences=JSON.parse(await fs.readFile(f.policyPath));preferences.clients.kimi.avoidModels=[];preferences.clients.kimi[kind].model='primary';await fs.writeFile(f.policyPath,JSON.stringify(preferences));
 await assert.rejects(planInstall(f),{code:'INVALID_POLICY'});
 assert.equal(await fs.readFile(target,'utf8'),original);
 await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
 await assert.rejects(fs.stat(rolePath(f,'worker')),{code:'ENOENT'});
 await assert.rejects(fs.stat(instructionPath(f)),{code:'ENOENT'});
});

function mainEffortConfig(alias,entryEffort='max',globalEffort) {
 let text=modelConfig.replace('default_model = "main"',`default_model = "${alias}"`).replaceAll('support_efforts = ["low", "high"]','support_efforts = ["low", "high", "max"]');
 text=text.replace(`[models."${alias}"]\n`,`[models."${alias}"]\ndefault_effort = "${entryEffort}"\n`);
 if(globalEffort!==undefined)text+='\n[thinking]\neffort = '+JSON.stringify(globalEffort)+'\n';
 return text;
}
for(const [kind,alias]of [['code','kimi-code/k3'],['light','kimi-code/kimi-for-coding']])test(`Kimi ${kind} alias cannot change the current main default effort without an explicit valid main pin`,async t=>{
 const f=await fixture(t,'kimi'),target=path.join(f.home,'.kimi-code/config.toml'),original=mainEffortConfig(alias);await put(target,original);
 const preferences=JSON.parse(await fs.readFile(f.policyPath));preferences.clients.kimi.avoidModels=[];await fs.writeFile(f.policyPath,JSON.stringify(preferences));
 const plan=await planInstall(f);assert.equal(plan.status,'prerequisite');assert.deepEqual(plan.warnings,['kimi-main-effort-conflict']);assert.equal(plan.changes.length,0);assert.equal((await applyInstall(plan)).status,'prerequisite');assert.equal(await fs.readFile(target,'utf8'),original);await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});await assert.rejects(fs.stat(rolePath(f,'worker')),{code:'ENOENT'});
});
for(const effort of ['medium','unsupported',3])test(`Kimi global effort ${JSON.stringify(effort)} does not falsely protect a main alias effort change`,async t=>{
 const f=await fixture(t,'kimi'),target=path.join(f.home,'.kimi-code/config.toml'),original=mainEffortConfig('kimi-code/k3','max',effort);await put(target,original);const plan=await planInstall(f);assert.equal(plan.status,'prerequisite');assert.deepEqual(plan.warnings,['kimi-main-effort-conflict']);assert.equal(plan.changes.length,0);assert.equal(await fs.readFile(target,'utf8'),original);await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
});
test('Kimi main effort uses an existing model override when deciding whether native setup is safe',async t=>{
 const f=await fixture(t,'kimi'),target=path.join(f.home,'.kimi-code/config.toml'),original=mainEffortConfig('kimi-code/k3','high')+'\n[models."kimi-code/k3".overrides]\ndefault_effort = "max"\n';await put(target,original);const plan=await planInstall(f);assert.equal(plan.status,'prerequisite');assert.deepEqual(plan.warnings,['kimi-main-effort-conflict']);assert.equal(plan.changes.length,0);assert.equal(await fs.readFile(target,'utf8'),original);
});
test('Kimi already matching main model default effort is preserved without requiring a global main pin',async t=>{
 const f=await fixture(t,'kimi'),target=path.join(f.home,'.kimi-code/config.toml'),original=mainEffortConfig('kimi-code/k3','high');await put(target,original);const plan=await planInstall(f);assert.equal(plan.status,'planned');await applyInstall(plan);const native=parseToml(await fs.readFile(target,'utf8'));assert.equal(native.default_model,'kimi-code/k3');assert.equal(native.models['kimi-code/k3'].default_effort,'high');assert.equal(native.thinking,undefined);assert.equal((await planInstall(f)).status,'unchanged');await uninstall({...f,apply:true});assert.deepEqual(parseToml(await fs.readFile(target,'utf8')),parseToml(original));
});
test('Kimi supported explicit global main effort permits per-alias subagent overrides and stays unchanged',async t=>{
 const f=await fixture(t,'kimi'),target=path.join(f.home,'.kimi-code/config.toml'),original=mainEffortConfig('kimi-code/k3','max','max');await put(target,original);const plan=await planInstall(f);assert.equal(plan.status,'planned');await applyInstall(plan);const native=parseToml(await fs.readFile(target,'utf8'));assert.equal(native.default_model,'kimi-code/k3');assert.deepEqual(native.thinking,{effort:'max'});assert.equal(native.models['kimi-code/k3'].default_effort,'max');assert.equal(native.models['kimi-code/k3'].overrides.default_effort,'high');assert.equal((await planInstall(f)).status,'unchanged');await uninstall({...f,apply:true});assert.deepEqual(parseToml(await fs.readFile(target,'utf8')),parseToml(original));
});
test('Kimi effort changes to a subagent alias leave an unselected current main alias unchanged',async t=>{
 const f=await fixture(t,'kimi'),target=path.join(f.home,'.kimi-code/config.toml'),original=mainEffortConfig('kimi-code/k3').replace('default_model = "kimi-code/k3"','default_model = "separate-main"')+'\n[models.separate-main]\nprovider = "fixture"\nmodel = "main-id"\nmax_context_size = 262144\nsupport_efforts = ["high", "max"]\ndefault_effort = "max"\n';await put(target,original);const plan=await planInstall(f);assert.equal(plan.status,'planned');await applyInstall(plan);const native=parseToml(await fs.readFile(target,'utf8'));assert.equal(native.default_model,'separate-main');assert.deepEqual(native.models['separate-main'],parseToml(original).models['separate-main']);assert.equal(native.models['kimi-code/k3'].overrides.default_effort,'high');
});

for(const value of ['custom:','null','true'])test(`Claude native role model ${JSON.stringify(value)} is a quoted string scalar`,async t=>{
 const f=await fixture(t,'claude'),preferences=JSON.parse(await fs.readFile(f.policyPath));preferences.clients.claude.code.model=value;preferences.clients.claude.avoidModels=[];await fs.writeFile(f.policyPath,JSON.stringify(preferences));await applyInstall(await planInstall(f));for(const role of ['worker','reviewer']){const body=await fs.readFile(rolePath(f,role),'utf8'),scalar=body.match(/^model: (.+)$/m)?.[1];assert.equal(scalar,JSON.stringify(value));assert.equal(JSON.parse(scalar),value);assert.equal(typeof JSON.parse(scalar),'string');}
});

test('native routing preferences keep delegation optional and preserve disabled Codex agents',async t=>{
 for(const client of ['codex','claude','kimi','agy']) {
  const f=await fixture(t,client);if(client==='kimi')await provision(f);
  const config=path.join(f.home,'.codex/config.toml'),original='model = "main"\n[agents]\nenabled = false\n';if(client==='codex')await put(config,original);
  await applyInstall(await planInstall(f));const instructions=await fs.readFile(instructionPath(f),'utf8');assert.match(instructions,/preferences apply only if you choose to delegate to subagents/);assert.match(instructions,/do not require delegation or change how you handle work directly/);assert.match(instructions,/When delegating, use apk-worker/);
  if(client==='codex'){const native=parseToml(await fs.readFile(config,'utf8'));assert.equal(native.agents.enabled,false);assert.equal(native.model,'main');assert.equal(native.features,undefined);await uninstall({...f,apply:true});assert.equal((await fs.readFile(config,'utf8')).trim(),original.trim());}
 }
});

async function useRoles(f,roles) {const p=JSON.parse(await fs.readFile(f.policyPath));p.clients[f.client].roles=roles;await fs.writeFile(f.policyPath,JSON.stringify(p));return p.clients[f.client];}
for(const client of ['codex','claude','agy'])test(`${client} native role overrides independently select worker reviewer search and routine`,async t=>{
 const f=await fixture(t,client),roles=client==='agy'?{worker:{model:'flash',effort:null},reviewer:{model:'pro',effort:null},explorer:{model:'flash',effort:null},routine:{model:'pro',effort:null}}:{worker:{model:'worker-selected',effort:'medium'},reviewer:{model:'reviewer-selected',effort:'high'},explorer:{model:'search-selected',effort:'low'},routine:{model:'routine-selected',effort:'medium'}};await useRoles(f,roles);await applyInstall(await planInstall(f));for(const [role,selected]of Object.entries(roles)){const text=await fs.readFile(rolePath(f,role),'utf8');if(client==='codex'){const native=parseToml(text);assert.equal(native.model,selected.model);assert.equal(native.model_reasoning_effort,selected.effort);}else{assert.equal(JSON.parse(text.match(/^model: (.+)$/m)[1]),selected.model);if(client==='claude')assert.match(text,new RegExp('^effort: '+selected.effort+'$','m'));}}
 if(client==='codex'){const native=parseToml(await fs.readFile(path.join(f.home,'.codex/config.toml'),'utf8'));assert.equal(native.agents.default_subagent_model,roles.worker.model);assert.equal(native.agents.default_subagent_reasoning_effort,roles.worker.effort);}if(client==='claude')assert.equal(JSON.parse(await fs.readFile(path.join(f.home,'.claude/settings.json'))).env.CLAUDE_CODE_SUBAGENT_MODEL,roles.worker.model);
});
function extraKimi(alias){return `\n[models."${alias}"]\nprovider = "fixture"\nmodel = "${alias}"\nmax_context_size = 262144\nsupport_efforts = ["low", "high", "max"]\n`;}
for(const count of [3,4])test(`Kimi ${count} effective role aliases compile paired bounded pool ownership and explicit routing`,async t=>{
 const f=await fixture(t,'kimi'),target=path.join(f.home,'.kimi-code/config.toml'),roles={worker:{model:'kimi-code/k3',effort:'high'},reviewer:{model:'review-alias',effort:'high'},explorer:{model:'kimi-code/kimi-for-coding',effort:'low'},routine:{model:count===4?'routine-alias':'kimi-code/kimi-for-coding',effort:'low'}};await put(target,modelConfig+extraKimi('review-alias')+(count===4?extraKimi('routine-alias'):''));await useRoles(f,roles);await applyInstall(await planInstall(f));const native=parseToml(await fs.readFile(target,'utf8'));assert.equal(Object.keys(native.secondary_model.models).length,count);assert.equal(native.secondary_model.default_model,roles.worker.model);const instructions=await fs.readFile(instructionPath(f),'utf8');for(const[role,selected]of Object.entries(roles)){assert.equal(native.models[selected.model].overrides.default_effort,selected.effort);assert.ok(instructions.includes(`For apk-${role}, select pool alias ${selected.model} (effort ${selected.effort}).`));const text=await fs.readFile(rolePath(f,role),'utf8');assert.ok(!/^model:/m.test(text));assert.ok(text.includes(selected.model));}assert.equal((await inspectConfiguration(f)).status,'verified');await uninstall({...f,apply:true});assert.deepEqual(parseToml(await fs.readFile(target,'utf8')),parseToml(modelConfig+extraKimi('review-alias')+(count===4?extraKimi('routine-alias'):'')));
});
test('Kimi uses only effective roles and ignores unused fallback aliases and efforts',async t=>{
 const f=await fixture(t,'kimi'),target=path.join(f.home,'.kimi-code/config.toml');await put(target,modelConfig.slice(0,modelConfig.indexOf('[models."kimi-code/kimi-for-coding"]')));await useRoles(f,Object.fromEntries(['worker','reviewer','explorer','routine'].map(role=>[role,{model:'kimi-code/k3',effort:'low'}])));const plan=await planInstall(f);assert.equal(plan.status,'planned');await applyInstall(plan);const native=parseToml(await fs.readFile(target,'utf8'));assert.deepEqual(Object.keys(native.secondary_model.models),['kimi-code/k3']);assert.equal(native.models['kimi-code/k3'].overrides.default_effort,'low');assert.equal((await inspectConfiguration(f)).status,'verified');
});
test('Kimi effective reviewer main alias preserves main effort and conflicting effective aliases refuse before writes',async t=>{
 const f=await fixture(t,'kimi'),target=path.join(f.home,'.kimi-code/config.toml');await put(target,modelConfig.replace('default_model = "main"','default_model = "review-main"')+extraKimi('review-main')+'default_effort = "max"\n');await useRoles(f,{reviewer:{model:'review-main',effort:'high'}});const plan=await planInstall(f);assert.equal(plan.status,'prerequisite');assert.deepEqual(plan.warnings,['kimi-main-effort-conflict']);assert.equal(plan.changes.length,0);await useRoles(f,{reviewer:{model:'kimi-code/k3',effort:'low'}});await assert.rejects(planInstall(f),{code:'INVALID_POLICY'});await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
});
