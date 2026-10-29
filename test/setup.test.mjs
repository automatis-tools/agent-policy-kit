import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { setupDetected } from '../src/setup.mjs';

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'policy-setup-')));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const home = path.join(root,'target'), hostHome=path.join(root,'host'), bin=path.join(root,'bin');
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
  assert.ok(result.requiredActions.some(a=>a.client === 'codex' && a.code === 'native_hook_trust_required' && a.automatable === false));
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

test('detected agy reports unsupported and never creates a fake integration',async t=>{
  const f = await fixture(t); await binary(f,'agy','Antigravity 1.4.10');
  const result = await setupDetected({...f,client:'agy',apply:true});
  assert.equal(result.status,'partial'); assert.equal(result.exitCode,3);
  assert.equal(result.results[0].status,'unsupported');
  assert.ok(result.requiredActions.some(a=>a.code === 'exact_model_enforcement_unsupported'));
  await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
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
  assert.equal(result.status,'configured');
  assert.ok(result.requiredActions.some(a=>a.code === 'kimi_native_pool_required' && a.automatable === true));
  assert.ok(result.requiredActions.some(a=>a.code === 'native_hook_load_check_required' && a.automatable === true));
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
