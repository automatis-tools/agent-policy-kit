import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { planInstall, applyInstall, uninstall, summarizePlan } from '../src/install.mjs';

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

test('Codex plan is private and read-only; apply preserves settings and repeat is a no-op', async t => {
  const f = await fixture(t);
  const config = path.join(f.home, '.codex/config.toml');
  const original = '# token is private\nmodel = "main"\nmodel_reasoning_effort = "ultra"\n[agents]\nmax_concurrent_threads_per_session = 9 # keep\n';
  await put(config, original);
  const plan = await planInstall(f);
  assert.equal(await fs.readFile(config, 'utf8'), original);
  await assert.rejects(fs.stat(f.stateDir), {code:'ENOENT'});
  const summary = JSON.stringify(summarizePlan(plan));
  assert.ok(!summary.includes(f.home));
  assert.ok(!summary.includes('token is private'));
  assert.equal((await applyInstall(plan)).status, 'applied');
  assert.match(await fs.readFile(config, 'utf8'), /max_concurrent_threads_per_session = 3 # keep/);
  assert.match(await fs.readFile(config, 'utf8'), /model = "main"/);
  const hooks = JSON.parse(await fs.readFile(path.join(f.home, '.codex/hooks.json')));
  assert.match(hooks.hooks.PreToolUse[0].hooks[0].command, /'"'"'/);
  assert.ok(hooks.hooks.PreToolUse[0].hooks[0].command.includes('--policy'));
  assert.equal((await fs.stat(path.join(f.stateDir, 'policy.json'))).mode & 0o777, 0o600);
  assert.equal((await planInstall(f)).status, 'unchanged');
  assert.equal((await applyInstall(await planInstall(f))).changedFiles, 0);
});

test('uninstall preserves later unrelated settings and rejects owned drift', async t => {
  const f = await fixture(t, 'claude');
  const target = path.join(f.home, '.claude/settings.json');
  await put(target, JSON.stringify({model:'main',effortLevel:'max',env:{EXISTING:'secret'},hooks:{PreToolUse:[{matcher:'Bash',hooks:[{type:'command',command:'echo user'}]}]}}));
  await applyInstall(await planInstall(f));
  const settings = JSON.parse(await fs.readFile(target));
  assert.equal(settings.model, 'main');
  assert.equal(settings.effortLevel, 'max');
  assert.equal(settings.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS, '3');
  settings.newSetting = true;
  await fs.writeFile(target, JSON.stringify(settings));
  const preview = await uninstall({...f, apply:false});
  assert.equal(preview.kind, 'uninstall');
  assert.equal((JSON.parse(await fs.readFile(target))).env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS, '3');
  settings.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS = '5';
  await fs.writeFile(target, JSON.stringify(settings));
  await assert.rejects(uninstall({...f,apply:true}), {code:'OWNED_DRIFT'});
  settings.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS = '3';
  await fs.writeFile(target, JSON.stringify(settings));
  await uninstall({...f,apply:true});
  const result = JSON.parse(await fs.readFile(target));
  assert.equal(result.newSetting, true);
  assert.equal(result.env.EXISTING, 'secret');
  assert.equal(result.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS, undefined);
  assert.equal(result.hooks.PreToolUse.length, 1);
});

test('malformed config, symlinks, stale plans, lock and pending journal stop safely', async t => {
  const f = await fixture(t);
  const target = path.join(f.home, '.codex/hooks.json');
  await put(target, '{"hooks":');
  await assert.rejects(planInstall(f), {code:'INVALID_JSON'});
  await fs.rm(target);
  await fs.symlink(f.policyPath, target);
  await assert.rejects(planInstall(f), {code:'UNSAFE_PATH'});
  await fs.rm(target);
  const stale = await planInstall(f);
  await put(target, '{}');
  await assert.rejects(applyInstall(stale), {code:'STALE_PLAN'});
  await fs.mkdir(f.stateDir, {recursive:true});
  await fs.writeFile(path.join(f.stateDir, '.install.lock'), 'busy');
  await assert.rejects(applyInstall(await planInstall(f)), {code:'INSTALL_LOCKED'});
  await fs.rm(path.join(f.stateDir, '.install.lock'));
  await fs.writeFile(path.join(f.stateDir, 'pending.json'), '{}');
  await assert.rejects(planInstall(f), {code:'RECOVERY_REQUIRED'});
});

test('Kimi preserves model pool and main settings, uses an owned launcher and warns about missing aliases', async t => {
  const f = await fixture(t, 'kimi');
  const target = path.join(f.home, '.kimi-code/config.toml');
  const original = 'default_model = "main"\n[thinking]\neffort = "high"\n';
  await put(target, original);
  const plan = await planInstall(f);
  assert.ok(plan.warnings.includes('kimi-native-pool-unverified'));
  await applyInstall(plan);
  assert.ok((await fs.readFile(target, 'utf8')).startsWith(original));
  assert.match(await fs.readFile(path.join(f.stateDir, 'bin/kimi-policy'), 'utf8'), /KIMI_CODE_AGENT_SWARM_MAX_CONCURRENCY=3/);
  await uninstall({...f,apply:true});
  assert.equal((await fs.readFile(target, 'utf8')).trim(), original.trim());
});

test('agy is explicitly unsupported and causes no files', async t => {
  const f = await fixture(t, 'agy');
  const p = await planInstall(f);
  assert.equal(p.status, 'unsupported');
  assert.equal(p.changes.length, 0);
  assert.equal((await applyInstall(p)).status, 'unsupported');
  await assert.rejects(fs.stat(f.stateDir), {code:'ENOENT'});
});

test('duplicate JSON keys, unknown hook shapes, and cap aliases are explicit conflicts', async t => {
  const f = await fixture(t);
  const hooks = path.join(f.home,'.codex/hooks.json');
  await put(hooks, '{"hooks":{},"hooks":{}}');
  await assert.rejects(planInstall(f),{code:'INVALID_JSON'});
  await put(hooks,'{"hooks":{"PreToolUse":{}}}');
  await assert.rejects(planInstall(f),{code:'UNSUPPORTED_CONFIG'});
  await put(hooks,'{}');
  await put(path.join(f.home,'.codex/config.toml'),'[agents]\nmax_threads = 6\n');
  await assert.rejects(planInstall(f),{code:'CODEX_CAP_ALIAS_CONFLICT'});
});

test('existing policy conflicts and forged receipt edits cannot overwrite other settings', async t => {
  const f = await fixture(t);
  await applyInstall(await planInstall(f));
  const receiptPath = path.join(f.stateDir,'installations/codex.json');
  const record = JSON.parse(await fs.readFile(receiptPath));
  const file = record.files.find(f=>f.type === 'toml');
  file.ops[0].before = '9\nmodel = "FORGED"';
  await fs.writeFile(receiptPath,JSON.stringify(record));
  await assert.rejects(uninstall({...f,apply:true}), {code:'INVALID_RECEIPT'});
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
  const firstTarget = path.join(f.home,'.codex/hooks.json');
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
  await assert.rejects(fs.stat(path.join(f.home,'.codex/hooks.json')),{code:'ENOENT'});
  await assert.rejects(fs.stat(path.join(f.stateDir,'policy.json')),{code:'ENOENT'});
  await assert.rejects(fs.stat(path.join(f.stateDir,'pending.json')),{code:'ENOENT'});
  assert.ok(!(await fs.readdir(path.dirname(target))).some(p=>p.endsWith('.tmp')));
});

test('rollback preserves concurrent postimage drift and retains a recovery journal', async t => {
  const f = await fixture(t);
  const result = await failingChild(f,true);
  assert.equal(result.stdout.trim(),'ROLLBACK_CONFLICT');
  assert.equal(await fs.readFile(path.join(f.home,'.codex/hooks.json'),'utf8'),'{}\n');
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

test('policy copies and receipt drift conflict without rewriting configuration', async t => {
  const f = await fixture(t,'claude');
  await fs.mkdir(f.stateDir,{recursive:true});
  await fs.writeFile(path.join(f.stateDir,'policy.json'),'{}\n');
  await assert.rejects(planInstall(f),{code:'POLICY_CONFLICT'});
  await fs.rm(path.join(f.stateDir,'policy.json'));
  await applyInstall(await planInstall(f));
  const target = path.join(f.home,'.claude/settings.json');
  const before = await fs.readFile(target,'utf8');
  await fs.writeFile(path.join(f.stateDir,'policy.json'),'{}\n');
  await assert.rejects(planInstall(f),{code:'OWNED_DRIFT'});
  assert.equal(await fs.readFile(target,'utf8'),before);
});

test('installed hook command executes with apostrophes and spaces in package and state paths', async t => {
  const f = await fixture(t,'claude');
  f.packageRoot = path.join(f.root,"installed package's folder");
  await put(path.join(f.packageRoot,'bin/agent-policy.mjs'),'console.log(JSON.stringify(process.argv.slice(2)));\n');
  await applyInstall(await planInstall(f));
  const settings = JSON.parse(await fs.readFile(path.join(f.home,'.claude/settings.json')));
  const output = await run('/bin/sh',['-c',settings.hooks.PreToolUse[0].hooks[0].command]);
  assert.deepEqual(JSON.parse(output.stdout),['hook','--client','claude','--policy',path.join(f.stateDir,'policy.json'),'--state-dir',f.stateDir,'--home',f.home]);
});

test('Kimi alias names without effective model bindings remain explicitly unverified', async t => {
  const f = await fixture(t,'kimi');
  await put(path.join(f.home,'.kimi-code/config.toml'),'[secondary_model]\ndefault_model = "subagent-code"\n[secondary_model.models]\nsubagent-code = "code"\nsubagent-light = "light"\n');
  assert.ok((await planInstall(f)).warnings.includes('kimi-native-pool-unverified'));
});

test('validated concurrency changes drive all native caps and uninstall restores previous values', async t => {
  for (const client of ['codex','claude','kimi']) {
    const f = await fixture(t,client);
    const policy = JSON.parse(await fs.readFile(f.policyPath));
    policy.clients[client].maxConcurrent = 2;
    await fs.writeFile(f.policyPath,JSON.stringify(policy));
    await applyInstall(await planInstall(f));
    if (client === 'codex') assert.match(await fs.readFile(path.join(f.home,'.codex/config.toml'),'utf8'),/max_concurrent_threads_per_session = 2/);
    else if (client === 'claude') assert.equal(JSON.parse(await fs.readFile(path.join(f.home,'.claude/settings.json'))).env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS,'2');
    else assert.match(await fs.readFile(path.join(f.stateDir,'bin/kimi-policy'),'utf8'),/MAX_CONCURRENCY=2/);
    assert.equal((await planInstall(f)).status,'unchanged');
    await uninstall({...f,apply:true});
  }
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

test('Kimi install is idempotent with a complete native pool and leaves every native binding intact', async t => {
  const f = await fixture(t,'kimi');
  const original = `default_model = "main"\n[secondary_model]\ndefault_model = "subagent-code"\n[secondary_model.models]\nsubagent-code = "code"\nsubagent-light = "light"\n[models.subagent-code]\nprovider = "provider"\nmodel = "k3-256k"\nmax_context_size = 262144\nsupport_efforts = ["low","high"]\n[models.subagent-code.overrides]\ndefault_effort = "high"\n[models.subagent-light]\nprovider = "provider"\nmodel = "kimi-for-coding"\nmax_context_size = 262144\nsupport_efforts = ["low","high"]\n[models.subagent-light.overrides]\ndefault_effort = "low"\n`;
  const target = path.join(f.home,'.kimi-code/config.toml');
  await put(target,original);
  const plan = await planInstall(f);
  assert.ok(!plan.warnings.includes('kimi-native-pool-unverified'));
  await applyInstall(plan);
  assert.equal((await planInstall(f)).status,'unchanged');
  assert.ok((await fs.readFile(target,'utf8')).startsWith(original));
  await uninstall({...f,apply:true});
  assert.equal((await fs.readFile(target,'utf8')).trim(),original.trim());
});

test('an interrupted child process leaves a private journal and forces explicit recovery', async t => {
  const f = await fixture(t);
  const preloader = path.join(f.root,'crash-preloader.mjs');
  const entry = path.join(f.root,'crash-transaction.mjs');
  const firstTarget = path.join(f.home,'.codex/hooks.json');
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
    const matching = '[agents]\nmax_concurrent_threads_per_session = 3\n[features]\nhooks = true\n';
    await put(native,matching);
    const policy = JSON.parse(await fs.readFile(f.policyPath,'utf8'));
    await put(path.join(f.stateDir,'policy.json'),JSON.stringify(policy,null,2)+'\n');
    const plan = await planInstall(f);
    assert.ok(!plan.changes.some(c=>c.path === native));
    assert.ok(!plan.changes.some(c=>c.path === path.join(f.stateDir,'policy.json')));
    if (dependency === 'native') await fs.writeFile(native,matching.replace('= 3','= 999').replace('= true','= false'));
    else await fs.writeFile(dependency === 'shared-policy' ? path.join(f.stateDir,'policy.json') : f.policyPath,'{}\n');
    await assert.rejects(applyInstall(plan),{code:'STALE_PLAN'});
    await assert.rejects(fs.stat(path.join(f.home,'.codex/hooks.json')),{code:'ENOENT'});
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
    const original = '[agents]\nmax_concurrent_threads_per_session = 3\n[features]\nhooks = true\n';
    await put(native,original);
    const preloader = path.join(f.root,'dependency-preloader.mjs');
    const entry = path.join(f.root,'dependency-transaction.mjs');
    const trigger = during === 'staging' ? path.join(f.stateDir,'pending.json') : path.join(f.stateDir,'installations/codex.json');
    await fs.writeFile(preloader,`import fs from 'node:fs/promises'; import {syncBuiltinESMExports} from 'node:module'; const method = ${JSON.stringify(during === 'staging' ? 'open' : 'rename')}; const original = fs[method]; let changed = false; fs[method] = async (...args) => { const result = await original(...args); if (!changed && args[${during === 'staging' ? '0' : '1'}] === ${JSON.stringify(trigger)}) { changed = true; await fs.writeFile(${JSON.stringify(native)},${JSON.stringify(original.replace('= 3','= 999'))}); } return result; }; syncBuiltinESMExports();\n`);
    await fs.writeFile(entry,`import {planInstall,applyInstall} from ${JSON.stringify(new URL('../src/install.mjs',import.meta.url).href)}; try { await applyInstall(await planInstall(${JSON.stringify(f)})); console.log('WRONGLY_APPLIED'); } catch(e) { console.log(e.code); }\n`);
    const result = await run(process.execPath,['--import',preloader,entry]);
    assert.equal(result.stdout.trim(),'STALE_PLAN');
    assert.match(await fs.readFile(native,'utf8'),/= 999/);
    await assert.rejects(fs.stat(path.join(f.home,'.codex/hooks.json')),{code:'ENOENT'});
    await assert.rejects(fs.stat(path.join(f.stateDir,'installations/codex.json')),{code:'ENOENT'});
  }
});

test('Kimi uninstall refuses a nested table added beneath the owned hook without reparenting it', async t => {
  const f = await fixture(t,'kimi');
  const target = path.join(f.home,'.kimi-code/config.toml');
  await put(target,'[[hooks]]\nevent = "Stop"\ncommand = "user"\n');
  await applyInstall(await planInstall(f));
  await fs.appendFile(target,'\n[hooks.extra]\nuser_value = 123\n');
  const before = await fs.readFile(target,'utf8');
  await assert.rejects(uninstall({...f,apply:true}),{code:'OWNED_DRIFT'});
  assert.equal(await fs.readFile(target,'utf8'),before);
});

test('late finalization sync failure preserves a recovery journal when rollback meets a competing edit', async t => {
  const f = await fixture(t);
  const hooks = path.join(f.home,'.codex/hooks.json');
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
  await fs.writeFile(f.policyPath,JSON.stringify({clients:policy.clients,mode:policy.mode,schemaVersion:policy.schemaVersion}));
  assert.equal((await planInstall(f)).status,'unchanged');
  await uninstall({...f,apply:true});
});

test('finalization rechecks unchanged dependencies before reporting success', async t => {
  const f = await fixture(t);
  const native = path.join(f.home,'.codex/config.toml');
  const original = '[agents]\nmax_concurrent_threads_per_session = 3\n[features]\nhooks = true\n';
  await put(native,original);
  const preloader = path.join(f.root,'final-dependency-preloader.mjs');
  const entry = path.join(f.root,'final-dependency-transaction.mjs');
  await fs.writeFile(preloader,`import fs from 'node:fs/promises'; import {syncBuiltinESMExports} from 'node:module'; const unlink = fs.unlink; let changed = false; fs.unlink = async file => { const result = await unlink(file); if (!changed && file === ${JSON.stringify(path.join(f.stateDir,'pending.json'))}) { changed = true; await fs.writeFile(${JSON.stringify(native)},${JSON.stringify(original.replace('= 3','= 999'))}); } return result; }; syncBuiltinESMExports();\n`);
  await fs.writeFile(entry,`import {planInstall,applyInstall} from ${JSON.stringify(new URL('../src/install.mjs',import.meta.url).href)}; try { await applyInstall(await planInstall(${JSON.stringify(f)})); console.log('WRONGLY_APPLIED'); } catch(e) { console.log(e.code); }\n`);
  const result = await run(process.execPath,['--import',preloader,entry]);
  assert.equal(result.stdout.trim(),'STALE_PLAN');
  assert.match(await fs.readFile(native,'utf8'),/= 999/);
  await assert.rejects(fs.stat(path.join(f.home,'.codex/hooks.json')),{code:'ENOENT'});
});

test('failed recovery-journal recreation retains a private lock pointing to the backup index', async t => {
  const f = await fixture(t);
  const hooks = path.join(f.home,'.codex/hooks.json');
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
