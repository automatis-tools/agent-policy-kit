import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { setupDetected } from '../src/setup.mjs';

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'policy-setup-')));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const home = path.join(root,"target's home"), hostHome=path.join(root,'host'), bin=path.join(root,'bin');
  await fs.mkdir(home); await fs.mkdir(hostHome); await fs.mkdir(bin);
  const policyPath=path.join(root,'policy.json');
  await fs.copyFile(new URL('../policies/balanced.json',import.meta.url),policyPath);
  return {root,home,hostHome,bin,env:{PATH:bin},stateDir:path.join(home,'.policy'),policyPath,packageRoot:path.resolve('.'),nodePath:process.execPath};
}
async function binary(f,client,version) { await fs.writeFile(path.join(f.bin,client),`#!${process.execPath}\nconsole.log(${JSON.stringify(version)});\n`,{mode:0o700}); }

test('config-only targets and binaries in the arbitrary target home never trigger setup',async t=>{
  const f = await fixture(t);
  for (const dir of ['.codex','.claude','.kimi-code/bin']) await fs.mkdir(path.join(f.home,dir),{recursive:true});
  await fs.writeFile(path.join(f.home,'.kimi-code/bin/kimi'),`#!${process.execPath}\nconsole.log("kimi 2.4.0");\n`,{mode:0o700});
  const result = await setupDetected({...f,apply:true});
  assert.equal(result.status,'no_clients'); assert.equal(result.exitCode,3);
  await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
  await assert.rejects(fs.stat(path.join(f.home,'.codex/hooks.json')),{code:'ENOENT'});
});

test('plan-only detects a genuine subset and creates no configuration or state',async t=>{
  const f = await fixture(t);
  await binary(f,'codex','codex-cli 0.165.0');
  const result = await setupDetected(f);
  assert.equal(result.status,'planned'); assert.equal(result.exitCode,0);
  assert.equal(result.results.filter(r=>r.status === 'planned').length,1);
  assert.ok(result.requiredActions.some(a=>a.client === 'codex' && a.code === 'codex-native-precedence-limits' && a.automatable === false));
  assert.ok(!JSON.stringify(result).includes('hook'));
  assert.ok(!JSON.stringify(result).includes(f.root));
  await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
});

test('apply replans each detected client against shared state and remains idempotent',async t=>{
  const f = await fixture(t);
  await binary(f,'codex','codex-cli 0.165.0'); await binary(f,'claude','2.1.312 (Claude Code)');
  const result = await setupDetected({...f,apply:true});
  assert.equal(result.status,'configured'); assert.equal(result.exitCode,0);
  assert.ok(result.results.filter(r=>r.status === 'configured').length === 2);
  for (const client of ['codex','claude']) assert.ok(await fs.stat(path.join(f.stateDir,'installations',client+'.json')));
  assert.equal((await setupDetected({...f,apply:true})).status,'configured');
});

test('an independent client failure preserves successful configuration and reports partial safely',async t=>{
  const f = await fixture(t);
  await binary(f,'codex','codex-cli 0.165.0'); await binary(f,'claude','2.1.312 (Claude Code)');
  await fs.mkdir(path.join(f.home,'.claude'));
  await fs.writeFile(path.join(f.home,'.claude/settings.json'),'{ SECRET');
  const result = await setupDetected({...f,apply:true});
  assert.equal(result.status,'partial'); assert.equal(result.exitCode,3);
  assert.ok(await fs.stat(path.join(f.stateDir,'installations/codex.json')));
  assert.equal(result.results.find(r=>r.client === 'claude').error,'INVALID_JSON');
  assert.ok(!JSON.stringify(result).includes('SECRET'));
});

test('detected agy receives native roles with explicit tier and cap limitations',async t=>{
  const f = await fixture(t); await binary(f,'agy','Antigravity 1.4.10');
  const result = await setupDetected({...f,client:'agy',apply:true});
  assert.equal(result.status,'configured'); assert.equal(result.exitCode,0);
  assert.equal(result.results[0].status,'configured');
  assert.ok(result.requiredActions.some(a=>a.code === 'agy-concurrency-guidance-only'));
  assert.match(await fs.readFile(path.join(f.home,'.gemini/config/agents/apk-worker.md'),'utf8'),/model: "pro"/);
});

test('requested missing clients do not touch present-but-unrequested clients',async t=>{
  const f = await fixture(t); await binary(f,'codex','codex-cli 0.165.0');
  const result = await setupDetected({...f,client:'claude',apply:true});
  assert.equal(result.status,'no_clients'); assert.equal(result.exitCode,3);
  assert.deepEqual(result.detected.map(r=>r.client),['claude']);
  await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
});

test('Kimi prerequisites are actionable through the agent without claiming native readiness',async t=>{
  const f = await fixture(t); await binary(f,'kimi','kimi 2.4.0');
  const result = await setupDetected({...f,client:'kimi',apply:true});
  assert.equal(result.status,'partial'); assert.equal(result.results[0].status,'prerequisite');
  assert.ok(result.requiredActions.some(a=>a.code === 'kimi-provisioned-models-required' && a.automatable === false));
  await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
});

test('an unverifiable executable makes a detected subset partial while preserving its success',async t=>{
  const f = await fixture(t);
  await binary(f,'codex','codex-cli 0.165.0'); await binary(f,'claude','other-app 9.9.9');
  const result = await setupDetected({...f,apply:true});
  assert.equal(result.status,'partial'); assert.equal(result.exitCode,3);
  assert.ok(await fs.stat(path.join(f.stateDir,'installations/codex.json')));
  assert.equal(result.results.find(r=>r.client === 'claude').status,'invalid');
  assert.ok(result.requiredActions.some(a=>a.client === 'claude' && a.code === 'native_client_identity_unverified' && a.automatable === true));
  await assert.rejects(fs.stat(path.join(f.home,'.claude')),{code:'ENOENT'});
});

test('conventional-only Kimi gets native configuration without a launcher',async t=>{
 const f=await fixture(t),kimi=path.join(f.hostHome,'.kimi-code/bin/kimi');await fs.mkdir(path.dirname(kimi),{recursive:true});await fs.writeFile(kimi,`#!${process.execPath}\nconsole.log('kimi 2.4.0');\n`,{mode:0o700});
 const config=path.join(f.home,'.kimi-code/config.toml');await fs.mkdir(path.dirname(config),{recursive:true});await fs.writeFile(config,'[providers.fixture]\ntype = "kimi"\n[models."kimi-code/k3-256k"]\nprovider = "fixture"\nmodel = "k3-256k"\nmax_context_size = 1048576\nsupport_efforts = ["high"]\n[models."kimi-code/kimi-for-coding"]\nprovider = "fixture"\nmodel = "kimi-for-coding"\nmax_context_size = 262144\nsupport_efforts = ["low", "high"]\n');
 for(const attempt of [1,2]){
  const result=await setupDetected({...f,client:'kimi',apply:true});assert.equal(result.status,'configured');assert.equal(result.results[0].status,attempt===1?'configured':'unchanged');assert.ok(result.results[0].warnings.includes('kimi-concurrency-guidance-only'));assert.ok(result.requiredActions.some(a=>a.code==='kimi-model-pool-routing-guidance'));await assert.rejects(fs.stat(path.join(f.stateDir,'bin')),{code:'ENOENT'});
 }
});

test('a per-client prerequisite preserves successful configuration of another client',async t=>{
 const f=await fixture(t);await binary(f,'codex','codex-cli 0.165.0');await binary(f,'kimi','kimi 2.4.0');const result=await setupDetected({...f,apply:true});assert.equal(result.status,'partial');assert.equal(result.results.find(r=>r.client==='codex').status,'configured');assert.equal(result.results.find(r=>r.client==='kimi').status,'prerequisite');await assert.rejects(fs.stat(path.join(f.stateDir,'installations/kimi.json')),{code:'ENOENT'});
});

test('an unsupported active native home preserves independently supported clients',async t=>{
 const f=await fixture(t);await binary(f,'codex','codex-cli 0.165.0');await binary(f,'claude','2.1.312 (Claude Code)');const active=path.join(f.root,'active-claude');await fs.mkdir(active);const sentinel=path.join(active,'settings.json');await fs.writeFile(sentinel,'PRIVATE_ACTIVE');const result=await setupDetected({...f,env:{...f.env,CLAUDE_CONFIG_DIR:active},apply:true});assert.equal(result.status,'partial');assert.equal(result.results.find(r=>r.client==='claude').status,'prerequisite');assert.equal(result.results.find(r=>r.client==='codex').status,'configured');await assert.rejects(fs.stat(path.join(f.home,'.claude')),{code:'ENOENT'});assert.equal(await fs.readFile(sentinel,'utf8'),'PRIVATE_ACTIVE');assert.ok(!JSON.stringify(result).includes(active));
});

test('unselected installed tools are untouched while eligible selected tools configure',async t=>{
 const f=await fixture(t);await binary(f,'codex','codex-cli 0.165.0');await binary(f,'claude','2.1.312 (Claude Code)');await fs.mkdir(path.join(f.home,'.claude'));const target=path.join(f.home,'.claude/settings.json');await fs.writeFile(target,'PRIVATE_UNSELECTED_SENTINEL');const result=await setupDetected({...f,enabledClients:['codex'],apply:true});assert.equal(result.status,'configured');assert.equal(result.results.find(r=>r.client==='codex').status,'configured');assert.equal(result.results.find(r=>r.client==='claude').status,'not_selected');assert.equal(await fs.readFile(target,'utf8'),'PRIVATE_UNSELECTED_SENTINEL');await assert.rejects(fs.stat(path.join(f.home,'.claude/agents')),{code:'ENOENT'});await assert.rejects(fs.stat(path.join(f.stateDir,'installations/claude.json')),{code:'ENOENT'});
});
test('only eligible selected detections count toward no_clients',async t=>{
 const f=await fixture(t);await binary(f,'codex','codex-cli 0.165.0');const result=await setupDetected({...f,enabledClients:['claude'],apply:true});assert.equal(result.status,'no_clients');assert.equal(result.exitCode,3);assert.equal(result.results.find(r=>r.client==='codex').status,'not_selected');await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
});
test('explicit client excluded from desired preferences returns a zero-write selection prerequisite',async t=>{
 const f=await fixture(t);await binary(f,'codex','codex-cli 0.165.0');await binary(f,'claude','2.1.312 (Claude Code)');const result=await setupDetected({...f,client:'codex',enabledClients:['claude'],apply:true});assert.equal(result.status,'partial');assert.equal(result.exitCode,3);assert.equal(result.results.length,1);assert.equal(result.results[0].status,'prerequisite');assert.ok(result.requiredActions.some(a=>a.code==='client-not-selected'));await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});await assert.rejects(fs.stat(path.join(f.home,'.codex')),{code:'ENOENT'});await assert.rejects(fs.stat(path.join(f.home,'.claude')),{code:'ENOENT'});
});

test('setup forwards preset labels and reports actual provenance across explicit replacement',async t=>{
 const f=await fixture(t);await binary(f,'codex','codex-cli 0.165.0');const initial=await setupDetected({...f,client:'codex',preset:'fast',apply:true});assert.equal(initial.results[0].appliedPreset,'fast');const changed=await setupDetected({...f,client:'codex',preset:'quality',replace:true,apply:true});assert.equal(changed.results[0].targetPreset,'quality');assert.equal(changed.results[0].previousPreset,'fast');assert.equal(changed.results[0].appliedPreset,'quality');
});
