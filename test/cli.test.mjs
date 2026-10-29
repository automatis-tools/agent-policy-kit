import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const bin = new URL('../bin/agent-policy.mjs', import.meta.url);
function temp(t) { const p = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "policy cli's ")); t.after(() => fs.rmSync(p, { recursive: true, force: true })); return p; }
function run(args, input, env = {}) { return spawnSync(process.execPath, [fileURLToPath(bin), ...args], { input, encoding: 'utf8', env: { ...process.env, ...env } }); }

test('installed-style CLI evaluates a forbidden model without echoing the task', () => {
  const got = run(['evaluate', '--client', 'codex', '--model', 'gpt-6-astra', '--effort', 'high']);
  assert.equal(got.status, 2);
  assert.equal(JSON.parse(got.stdout).action, 'deny');
});
test('hook converts malformed stdin into a valid fixed deny response', t => {
  const got = run(['hook', '--client', 'codex', '--state-dir', temp(t)], 'PRIVATE_INVALID_JSON');
  assert.equal(got.status, 0);
  assert.equal(JSON.parse(got.stdout).hookSpecificOutput.permissionDecision, 'deny');
  assert.equal((got.stdout + got.stderr).includes('PRIVATE_INVALID_JSON'), false);
});
test('hook enforces the policy and writes only sanitized metadata', t => {
  const state = temp(t);
  const got = run(['hook', '--client', 'codex', '--state-dir', state], JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'spawn_agent', session_id: 'PRIVATE_SESSION', tool_input: { message: 'PRIVATE_TASK', model: 'gpt-6-astra' } }));
  assert.equal(got.status, 0);
  assert.equal(JSON.parse(got.stdout).hookSpecificOutput.permissionDecision, 'deny');
  const exported = run(['audit', '--state-dir', state, '--public']);
  assert.equal(exported.status, 0);
  assert.equal(JSON.parse(exported.stdout).records, 1);
  assert.equal(exported.stdout.includes('PRIVATE'), false);
});
test('init refuses to overwrite an existing policy', t => {
  const p = path.join(temp(t), 'policy.json');
  assert.equal(run(['init', '--policy', p]).status, 0);
  fs.writeFileSync(p, 'PRIVATE_CONTENT');
  assert.notEqual(run(['init', '--policy', p]).status, 0);
  assert.equal(fs.readFileSync(p, 'utf8'), 'PRIVATE_CONTENT');
});
test('doctor separates package, client trust and model-runtime outcomes', t => {
  const got = run(['doctor', '--client', 'agy', '--home', temp(t), '--state-dir', temp(t)]);
  const report = JSON.parse(got.stdout);
  assert.equal(report.package.status, 'pass');
  assert.equal(report.clients.agy.runtime.status, 'unsupported');
  assert.notEqual(report.clients.agy.clientTrust.status, 'pass');
});
test('observe mode does not block malformed hook JSON', t => {
  const p = path.join(temp(t), 'observe.json');
  const policy = JSON.parse(fs.readFileSync(new URL('../policies/balanced.json', import.meta.url)));
  policy.mode = 'observe'; fs.writeFileSync(p, JSON.stringify(policy));
  const got = run(['hook', '--client', 'codex', '--policy', p, '--state-dir', temp(t)], 'PRIVATE_INVALID_JSON');
  assert.equal(got.status, 0); assert.equal(got.stdout, ''); assert.equal(got.stderr.includes('PRIVATE'), false);
});
test('packaged LLM instructions are available without policy or client setup', () => {
  const got = run(['instructions']);
  assert.equal(got.status, 0); assert.match(got.stdout, /LLM-first/); assert.match(got.stdout, /uninstall/);
});
test('autodetect setup does not write for stale configuration folders without executables', t => {
  const p = temp(t); const state = path.join(p, 'state');
  fs.mkdirSync(path.join(p, '.claude'));
  const got = run(['setup', '--apply', '--dev', '--home', p, '--state-dir', state], undefined,
    { HOME: p, USERPROFILE: p, PATH: path.dirname(process.execPath) });
  assert.equal(got.status, 3); assert.equal(JSON.parse(got.stdout).status, 'no_clients');
  assert.equal(fs.existsSync(state), false);
});
test('explicit client install also refuses absent client executables', t => {
  const p = temp(t); const state = path.join(p, 'state');
  const got = run(['install', '--client', 'codex', '--apply', '--dev', '--home', p, '--state-dir', state], undefined,
    { HOME: p, USERPROFILE: p, PATH: path.dirname(process.execPath) });
  assert.equal(got.status, 3); assert.equal(JSON.parse(got.stdout).status, 'no_clients');
  assert.equal(fs.existsSync(state), false);
});

import { planInstall, applyInstall } from '../src/install.mjs';
const root = path.dirname(path.dirname(fileURLToPath(bin)));
function policyFile(p,mode='enforce') {
  const policy=JSON.parse(fs.readFileSync(path.join(root,'policies/balanced.json'),'utf8'));
  policy.mode=mode;const file=path.join(p,mode+'.json');fs.writeFileSync(file,JSON.stringify(policy));return file;
}
async function configure(p,client,source=policyFile(p)) {
  const stateDir=path.join(p,'state');
  await applyInstall(await planInstall({client,home:p,stateDir,policyPath:source,packageRoot:root,nodePath:process.execPath}));
  return stateDir;
}
function fakeClient(p,client) {
  const folder=path.join(p,'bin');fs.mkdirSync(folder,{recursive:true});
  const version={codex:'codex-cli 0.165.0',claude:'2.1.312 (Claude Code)',kimi:'kimi 2.4.0'}[client];
  fs.writeFileSync(path.join(folder,client),`#!${process.execPath}\nimport fs from 'node:fs';if(process.argv[2]==='--version'){console.log(${JSON.stringify(version)});}else{fs.writeFileSync(process.env.LAUNCH_SENTINEL,'launched');console.log(JSON.stringify({args:process.argv.slice(2),claudeCap:process.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS,claudeModel:process.env.CLAUDE_CODE_SUBAGENT_MODEL,kimiCap:process.env.KIMI_CODE_AGENT_SWARM_MAX_CONCURRENCY}));}\n`,{mode:0o700});
  return {HOME:p,USERPROFILE:p,PATH:folder,LAUNCH_SENTINEL:path.join(p,'launched')};
}

test('CLI receipt-based uninstall works with corrupt or absent shared policy and no native executable',async t=>{
  for(const broken of ['corrupt','absent']){
    const p=temp(t),state=await configure(p,'claude');
    if(broken==='corrupt')fs.writeFileSync(path.join(state,'policy.json'),'{ SECRET_BROKEN');else fs.unlinkSync(path.join(state,'policy.json'));
    const got=run(['uninstall','--client','claude','--home',p,'--state-dir',state,'--apply'],undefined,{HOME:p,PATH:path.dirname(process.execPath)});
    assert.equal(got.status,0);assert.equal(JSON.parse(got.stdout).status,'applied');
    assert.equal(fs.existsSync(path.join(p,'.claude/settings.json')),false);
    assert.equal((got.stdout+got.stderr).includes('SECRET_BROKEN'),false);
  }
});

test('automatic uninstall ignores policy validity but keeps per-client ownership drift protection',async t=>{
  const p=temp(t),source=policyFile(p),state=await configure(p,'codex',source);await configure(p,'claude',source);
  const target=path.join(p,'.claude/settings.json'),settings=JSON.parse(fs.readFileSync(target));settings.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS='9';fs.writeFileSync(target,JSON.stringify(settings));
  fs.writeFileSync(path.join(state,'policy.json'),'{broken');
  const got=run(['uninstall','--home',p,'--state-dir',state,'--apply'],undefined,{HOME:p,PATH:path.dirname(process.execPath)});
  assert.equal(got.status,3);const result=JSON.parse(got.stdout);assert.equal(result.status,'partial');
  assert.equal(result.results.find(r=>r.client==='codex').status,'applied');
  assert.equal(result.results.find(r=>r.client==='claude').error,'OWNED_DRIFT');
  assert.equal(JSON.parse(fs.readFileSync(target)).env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS,'9');
  settings.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS='3';fs.writeFileSync(target,JSON.stringify(settings));
  const retry=run(['uninstall','--home',p,'--state-dir',state,'--apply'],undefined,{HOME:p,PATH:path.dirname(process.execPath)});
  assert.equal(retry.status,0);assert.equal(JSON.parse(retry.stdout).status,'completed');
  assert.equal(fs.existsSync(path.join(state,'installations/claude.json')),false);
});

test('observe run preserves inherited subagent defaults and caps for every supported client',async t=>{
  for(const client of ['codex','claude','kimi']){
    const p=temp(t),source=policyFile(p,'observe'),env=fakeClient(p,client);
    Object.assign(env,{CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS:'11',CLAUDE_CODE_SUBAGENT_MODEL:'user-choice',KIMI_CODE_AGENT_SWARM_MAX_CONCURRENCY:'12'});
    const state=await configure(p,client,source);
    const got=run(['run','--client',client,'--home',p,'--state-dir',state,'--policy',source,'--','--fixture'],undefined,env);
    assert.equal(got.status,0);const observed=JSON.parse(got.stdout);
    assert.equal(observed.claudeCap,'11');assert.equal(observed.claudeModel,'user-choice');assert.equal(observed.kimiCap,'12');
    assert.equal(observed.args.some(a=>a.includes('agents.max_concurrent_threads_per_session=')),false);
  }
});

test('run rejects divergent installed policy before native launch while the actual classic hook uses shared policy',async t=>{
  for(const client of ['codex','claude','kimi']){
    const p=temp(t),state=await configure(p,client),alternate=policyFile(p,'observe'),env=fakeClient(p,client);
    if(client==='claude'){
      const settings=JSON.parse(fs.readFileSync(path.join(p,'.claude/settings.json')));
      const classic=spawnSync('/bin/sh',['-c',settings.hooks.PreToolUse[0].hooks[0].command],{encoding:'utf8',env:{...process.env,...env,AGENT_POLICY_PATH:alternate},input:JSON.stringify({hook_event_name:'PreToolUse',tool_name:'Agent',tool_input:{model:'opus',subagent_type:'worker'}})});
      assert.equal(classic.status,0);assert.equal(JSON.parse(classic.stdout).hookSpecificOutput.permissionDecision,'deny');
    }
    const got=run(['run','--client',client,'--home',p,'--state-dir',state,'--policy',alternate,'--','--fixture'],undefined,env);
    assert.equal(got.status,1);assert.equal(JSON.parse(got.stdout).error,'RUN_POLICY_CONFLICT');
    assert.equal(fs.existsSync(env.LAUNCH_SENTINEL),false);
  }
});

test('run rejects installed enforce-to-observe mode changes even at the shared policy path',async t=>{
  const p=temp(t),state=await configure(p,'claude'),env=fakeClient(p,'claude');
  const shared=path.join(state,'policy.json'),policy=JSON.parse(fs.readFileSync(shared));policy.mode='observe';fs.writeFileSync(shared,JSON.stringify(policy));
  const got=run(['run','--client','claude','--home',p,'--state-dir',state,'--','--fixture'],undefined,env);
  assert.equal(got.status,1);assert.equal(JSON.parse(got.stdout).error,'RUN_POLICY_CONFLICT');assert.equal(fs.existsSync(env.LAUNCH_SENTINEL),false);
});

test('matching explicit installed policy and alternate policy without integration remain supported',async t=>{
  for(const installed of [false,true]){
    const p=temp(t),source=policyFile(p,installed?'enforce':'observe'),env=fakeClient(p,'claude');
    const state=installed?await configure(p,'claude',source):path.join(p,'state');
    if(installed){const receipt=path.join(state,'installations/claude.json'),owned=JSON.parse(fs.readFileSync(receipt));delete owned.mode;fs.writeFileSync(receipt,JSON.stringify(owned));}
    const got=run(['run','--client','claude','--home',p,'--state-dir',state,'--policy',source,'--','--fixture'],undefined,env);
    assert.equal(got.status,0);assert.equal(fs.existsSync(env.LAUNCH_SENTINEL),true);
  }
});
