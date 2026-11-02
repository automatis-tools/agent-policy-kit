import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {planInstall,applyInstall,uninstall,summarizePlan,inspectConfiguration} from '../src/install.mjs';
import {readConfiguration} from '../src/inspect.mjs';
import {setupDetected} from '../src/setup.mjs';
import {formatResult} from '../src/output.mjs';
import {parseToml} from '../src/toml.mjs';
import {nativeHomeConflict} from '../src/native.mjs';
import {ROLE_IDS} from '../src/roles.mjs';

// Temporary profiles only: nothing here reads a real Grok profile or calls a model.
async function fixture(t,policy={}) {
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'policy-grok-')));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const home=path.join(root,"home with ' quote"),policyPath=path.join(root,'policy.json'),bin=path.join(root,'bin');
 await fs.mkdir(home);await fs.mkdir(bin);
 const base=JSON.parse(await fs.readFile(new URL('../policies/balanced.json',import.meta.url),'utf8'));
 const config={...base,...policy,clients:{grok:{code:{model:'grok-4.7',effort:null},light:{model:'grok-4.6',effort:null},roles:{reviewer:{model:'grok-4.5',effort:null}},avoidModels:[],...(policy.grok??{})}}};
 delete config.grok;
 await fs.writeFile(policyPath,JSON.stringify(config));
 return {root,home,bin,client:'grok',policyPath,stateDir:path.join(home,'.agent-policy-kit'),env:{PATH:bin,AGENT_POLICY_APPLICATIONS_DIR:path.join(root,'Applications')}};
}
const put=async(file,text)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,text);};
const configPath=f=>path.join(f.home,'.grok/config.toml');
const rolePath=(f,role)=>path.join(f.home,'.grok/agents',`apk-${role}.md`);
const original='# user grok settings\nmodel = "main-grok"\n[subagents]\nenabled = true\n';

test('apply writes native role files, per-role models, the general-purpose fallback and a native cap',async t=>{
 const f=await fixture(t);await put(configPath(f),original);
 const plan=await planInstall(f);assert.equal(plan.status,'planned');
 assert.deepEqual(plan.warnings,['grok-effort-model-dependent','grok-native-precedence-limits']);
 assert.ok(!JSON.stringify(summarizePlan(plan)).includes(f.root));
 assert.equal(await fs.readFile(configPath(f),'utf8'),original);await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
 await applyInstall(plan);
 const native=parseToml(await fs.readFile(configPath(f),'utf8'));
 assert.equal(native.model,'main-grok');assert.equal(native.subagents.enabled,true);assert.equal(native.subagents.max_concurrent,3);
 assert.equal(native.subagents.models['apk-worker'],'grok-4.7');assert.equal(native.subagents.models['apk-reviewer'],'grok-4.5');assert.equal(native.subagents.models['apk-explorer'],'grok-4.6');
 assert.equal(native.subagents.models['general-purpose'],'grok-4.7');
 for(const role of ROLE_IDS){
  const body=await fs.readFile(rolePath(f,role),'utf8');
  assert.match(body,new RegExp(`^---\\nname: apk-${role}\\ndescription: ".+"\\n`));
  assert.equal(/^permission_mode: plan$/m.test(body),['reviewer','explorer'].includes(role),role);
  assert.doesNotMatch(body,/^(model|effort|tools):/m);
 }
 const instructions=await fs.readFile(path.join(f.home,'.grok/AGENTS.md'),'utf8');
 assert.match(instructions,/run at most 3 subagents concurrently/);assert.match(instructions,/model and effort selection/);assert.doesNotMatch(instructions,/Per-role effort is not supported|main session effort\./);assert.match(instructions,/apk-worker for scoped implementation/);
 assert.equal((await inspectConfiguration(f)).status,'verified');
});

test('a second apply is unchanged and a different policy conflicts without writes',async t=>{
 const f=await fixture(t);await applyInstall(await planInstall(f));
 assert.equal((await planInstall(f)).status,'unchanged');
 const other=JSON.parse(await fs.readFile(f.policyPath,'utf8'));other.maxConcurrent=5;await fs.writeFile(f.policyPath,JSON.stringify(other));
 await assert.rejects(planInstall(f),{code:'INSTALLATION_CONFLICT'});
 assert.equal((await planInstall({...f,replace:true})).status,'planned');
});

test('uninstall restores original settings and keeps user agent files',async t=>{
 const f=await fixture(t);await put(configPath(f),original);await put(path.join(f.home,'.grok/agents/mine.md'),'---\nname: mine\ndescription: mine\n---\nPrompt.\n');
 await put(path.join(f.home,'.grok/AGENTS.md'),'User rules.\n');
 await applyInstall(await planInstall(f));
 const preview=await uninstall(f);assert.equal(preview.status,'planned');assert.ok(parseToml(await fs.readFile(configPath(f),'utf8')).subagents.models);
 await uninstall({...f,apply:true});
 assert.deepEqual(parseToml(await fs.readFile(configPath(f),'utf8')),parseToml(original));
 assert.equal(await fs.readFile(path.join(f.home,'.grok/AGENTS.md'),'utf8'),'User rules.\n');
 for(const role of ROLE_IDS)await assert.rejects(fs.stat(rolePath(f,role)),{code:'ENOENT'});
 assert.ok(await fs.stat(path.join(f.home,'.grok/agents/mine.md')));
});

test('a fresh profile is removed completely, including tables APK created',async t=>{
 const f=await fixture(t);await applyInstall(await planInstall(f));await uninstall({...f,apply:true});
 await assert.rejects(fs.stat(configPath(f)),{code:'ENOENT'});await assert.rejects(fs.stat(path.join(f.home,'.grok/AGENTS.md')),{code:'ENOENT'});
});

test('pre-existing owned-key values are restored on removal',async t=>{
 const f=await fixture(t);const text='[subagents]\nmax_concurrent = 9\n[subagents.models]\n"apk-worker" = "mine"\ngeneral-purpose = "grok-4.5"\nother = "keep"\n';
 await put(configPath(f),text);await applyInstall(await planInstall(f));
 assert.equal(parseToml(await fs.readFile(configPath(f),'utf8')).subagents.max_concurrent,3);
 await uninstall({...f,apply:true});assert.deepEqual(parseToml(await fs.readFile(configPath(f),'utf8')),parseToml(text));
});

test('drift in an owned setting, role file or instruction block refuses destructive removal',async t=>{
 for(const drift of ['config','role','instructions']){
  const f=await fixture(t);await put(configPath(f),original);await applyInstall(await planInstall(f));
  const target=drift==='config'?configPath(f):drift==='role'?rolePath(f,'worker'):path.join(f.home,'.grok/AGENTS.md');
  const text=await fs.readFile(target,'utf8'),edited=drift==='config'?text.replace('max_concurrent = 3','max_concurrent = 8'):drift==='role'?text+'\nlocal edit\n':text.replace('run at most 3','run at most 9');
  assert.notEqual(edited,text);await fs.writeFile(target,edited);
  await assert.rejects(uninstall({...f,apply:true}),{code:'OWNED_DRIFT'});assert.equal(await fs.readFile(target,'utf8'),edited);
  await assert.rejects(planInstall({...f,replace:true}),{code:'OWNED_DRIFT'});
 }
});

test('unsupported native structures and existing role files fail before writes',async t=>{
 for(const [text,code] of [['subagents = "x"\n','UNSUPPORTED_CONFIG'],['[subagents]\nmodels = "x"\n','UNSUPPORTED_CONFIG'],['[subagents]\nmax_concurrent = 0\n','UNSUPPORTED_CONFIG'],['[subagents]\nmax_concurrent = "3"\n','UNSUPPORTED_CONFIG'],['[subagents]\nmodels = {a = "b"}\n','UNSUPPORTED_TOML_STRUCTURE'],['model = [\n','INVALID_TOML']]){
  const f=await fixture(t);await put(configPath(f),text);
  await assert.rejects(planInstall(f),{code});assert.equal(await fs.readFile(configPath(f),'utf8'),text);await assert.rejects(fs.stat(f.stateDir),{code:'ENOENT'});
 }
 const f=await fixture(t);await put(rolePath(f,'worker'),'mine');await assert.rejects(planInstall(f),{code:'OWNERSHIP_CONFLICT'});
});

test('a selected role subset writes only those roles and models and can be replaced',async t=>{
 const f=await fixture(t,{selectedRoles:['reviewer','tester']});await applyInstall(await planInstall(f));
 const native=parseToml(await fs.readFile(configPath(f),'utf8'));
 assert.deepEqual(Object.keys(native.subagents.models).sort(),['apk-reviewer','apk-tester','general-purpose']);
 assert.equal(native.subagents.models['general-purpose'],'grok-4.5');
 for(const role of ROLE_IDS){if(['reviewer','tester'].includes(role))assert.ok(await fs.stat(rolePath(f,role)));else await assert.rejects(fs.stat(rolePath(f,role)),{code:'ENOENT'});}
 const wider=JSON.parse(await fs.readFile(f.policyPath,'utf8'));delete wider.selectedRoles;await fs.writeFile(f.policyPath,JSON.stringify(wider));
 await applyInstall(await planInstall({...f,replace:true}));
 assert.equal(Object.keys(parseToml(await fs.readFile(configPath(f),'utf8')).subagents.models).length,ROLE_IDS.length+1);
 await uninstall({...f,apply:true});await assert.rejects(fs.stat(configPath(f)),{code:'ENOENT'});
});

test('a policy that avoids a selected model or pins a level the catalog does not list is refused',async t=>{
 const f=await fixture(t,{grok:{avoidModels:['grok-4.7']}});await assert.rejects(planInstall(f),{code:'INVALID_POLICY'});
 for(const code of [{model:'grok-4.7',effort:'max'},{model:'grok-4.6',effort:'high'},{model:'grok-build-0.1',effort:'low'},{model:'grok-custom',effort:'none'}]){
  const g=await fixture(t,{grok:{code}});await assert.rejects(planInstall(g),{code:'INVALID_POLICY'},JSON.stringify(code));await assert.rejects(fs.stat(g.stateDir),{code:'ENOENT'});
 }
});

test('a pinned effort is written to the agent frontmatter only for that role and removed with it',async t=>{
 const f=await fixture(t,{grok:{roles:{reviewer:{model:'grok-4.7',effort:'xhigh'},tester:{model:'grok-custom',effort:'max'}}}});
 await put(configPath(f),original);
 const plain=await fixture(t);await put(configPath(plain),original);
 await applyInstall(await planInstall(f));await applyInstall(await planInstall(plain));
 const effort=async(home,role)=>(await fs.readFile(rolePath(home,role),'utf8')).match(/^effort: (.+)$/m)?.[1]??null;
 assert.equal(await effort(f,'reviewer'),'xhigh');assert.equal(await effort(f,'tester'),'max');
 for(const role of ['worker','explorer','writer','routine']){
  assert.equal(await effort(f,role),null,role);
  assert.equal(await fs.readFile(rolePath(f,role),'utf8'),await fs.readFile(rolePath(plain,role),'utf8'),role);
 }
 const reviewer=await fs.readFile(rolePath(f,'reviewer'),'utf8');
 assert.match(reviewer,/^---\nname: apk-reviewer\ndescription: ".+"\neffort: xhigh\npermission_mode: plan\n---\n/);assert.doesNotMatch(reviewer,/^(model|reasoning_effort|reasoningEffort):/m);
 const native=parseToml(await fs.readFile(configPath(f),'utf8'));
 assert.equal(native.subagents.models['apk-reviewer'],'grok-4.7');assert.equal(native.subagents.models['apk-tester'],'grok-custom');
 assert.ok(Object.values(native.subagents.models).every(value=>typeof value==='string'));assert.equal(native.subagents.roles,undefined);
 assert.equal((await inspectConfiguration(f)).status,'verified');
 const c=(await readConfiguration({home:f.home,client:'grok',env:{},stateDir:f.stateDir})).clients.grok;
 assert.equal(c.status,'configured');assert.deepEqual(c.warnings,[]);
 assert.deepEqual(c.roles.find(r=>r.name==='apk-reviewer'),{name:'apk-reviewer',model:'grok-4.7',effort:'xhigh'});
 assert.deepEqual(c.roles.find(r=>r.name==='apk-worker'),{name:'apk-worker',model:'grok-4.7',effort:null});
 assert.match(formatResult('show',{schemaVersion:1,scope:'user',modelExecution:'not_checked',clients:{grok:c}}),/apk-reviewer\s+grok-4\.7 · xhigh/);
 await uninstall({...f,apply:true});
 assert.deepEqual(parseToml(await fs.readFile(configPath(f),'utf8')),parseToml(original));
 for(const role of ROLE_IDS)await assert.rejects(fs.stat(rolePath(f,role)),{code:'ENOENT'});
});

test('an install made by 0.4.0 still inspects, updates in place with an effort and uninstalls',async t=>{
 const f=await fixture(t);await put(configPath(f),original);await put(path.join(f.home,'.grok/AGENTS.md'),'User rules.\n');
 await applyInstall(await planInstall({...f,releaseVersion:'0.4.0'}));
 // Rewrite the owned instruction block and receipt exactly as 0.4.0 wrote them.
 const legacy='Use the named role definitions for model selection. Per-role effort is not supported by the documented native agent settings; subagents use the main session effort. Explicit spawn settings and higher-priority instructions can supersede user defaults.';
 const current=(await fs.readFile(path.join(f.home,'.grok/AGENTS.md'),'utf8')).match(/^Use the named role definitions.*$/m)[0];
 const receiptPath=path.join(f.stateDir,'installations/grok.json'),receipt=JSON.parse(await fs.readFile(receiptPath,'utf8'));
 receipt.warnings=['grok-per-role-effort-unsupported','grok-native-precedence-limits'];
 for(const file of receipt.files)if(file.type==='instructions')file.block=file.block.replace(current,legacy);
 await fs.writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');
 await fs.writeFile(path.join(f.home,'.grok/AGENTS.md'),(await fs.readFile(path.join(f.home,'.grok/AGENTS.md'),'utf8')).replace(current,legacy));
 const inspected=await inspectConfiguration(f);assert.equal(inspected.status,'verified');assert.equal(inspected.releaseVersion,'0.4.0');
 assert.equal((await readConfiguration({home:f.home,client:'grok',env:{},stateDir:f.stateDir})).clients.grok.apk.status,'verified');
 const unchanged=await planInstall({...f,releaseVersion:'0.4.0'});assert.equal(unchanged.status,'unchanged');
 assert.doesNotMatch(formatResult('setup',{schemaVersion:1,status:'configured',detected:[],results:[{client:'grok',status:'unchanged',changedFiles:0,warnings:unchanged.warnings}],requiredActions:[],exitCode:0},{apply:true}),/do not support per-role effort|main session/);
 const pinned=JSON.parse(await fs.readFile(f.policyPath,'utf8'));pinned.clients.grok.roles.reviewer={model:'grok-4.7',effort:'medium'};await fs.writeFile(f.policyPath,JSON.stringify(pinned));
 await applyInstall(await planInstall({...f,replace:true}));
 assert.match(await fs.readFile(rolePath(f,'reviewer'),'utf8'),/^effort: medium$/m);
 assert.doesNotMatch(await fs.readFile(path.join(f.home,'.grok/AGENTS.md'),'utf8'),/main session effort/);
 await uninstall({...f,apply:true});
 assert.deepEqual(parseToml(await fs.readFile(configPath(f),'utf8')),parseToml(original));
 assert.equal(await fs.readFile(path.join(f.home,'.grok/AGENTS.md'),'utf8'),'User rules.\n');
 for(const role of ROLE_IDS)await assert.rejects(fs.stat(rolePath(f,role)),{code:'ENOENT'});
});

test('show reports roles, the fallback model and the native cap from an isolated GROK_HOME',async t=>{
 const f=await fixture(t);await applyInstall(await planInstall(f));
 const grokHome=path.join(f.root,'isolated-grok-home');
 await fs.cp(path.join(f.home,'.grok'),grokHome,{recursive:true});
 await put(path.join(f.home,'.grok/agents/mine.md'),'---\nname: mine\ndescription: mine\neffort: high\n---\n');
 const report=await readConfiguration({home:f.home,client:'grok',env:{GROK_HOME:grokHome},stateDir:f.stateDir}),c=report.clients.grok;
 assert.equal(c.status,'configured');assert.equal(c.defaults.model,'grok-4.7');assert.equal(c.defaults.effort,null);
 assert.equal(c.concurrency.value,3);assert.equal(c.concurrency.kind,'native_setting');
 assert.equal(c.roles.length,ROLE_IDS.length);assert.deepEqual(c.roles.find(r=>r.name==='apk-reviewer'),{name:'apk-reviewer',model:'grok-4.5',effort:null});
 assert.equal(c.apk.status,'not_checked');
 const own=await readConfiguration({home:f.home,client:'grok',env:{},stateDir:f.stateDir});
 assert.equal(own.clients.grok.apk.status,'verified');assert.deepEqual(own.clients.grok.warnings,[]);assert.equal(own.clients.grok.status,'configured');assert.equal(own.clients.grok.roles.find(r=>r.name==='mine').effort,'high');
 // Grok Build drops an agent whose frontmatter effort is not a level it accepts.
 await put(path.join(f.home,'.grok/agents/odd.md'),'---\nname: odd\ndescription: odd\neffort: ultra\n---\n');
 const odd=(await readConfiguration({home:f.home,client:'grok',env:{},stateDir:f.stateDir})).clients.grok;
 assert.deepEqual(odd.warnings,['UNSUPPORTED_ROLE_EFFORT']);assert.equal(odd.status,'attention');await fs.rm(path.join(f.home,'.grok/agents/odd.md'));
 const text=formatResult('show',own);assert.match(text,/\bGrok\b/);assert.match(text,/Max concurrent: 3 \(native setting\)/);assert.match(text,/apk-reviewer\s+grok-4\.5 · native default/);
});

test('show refuses unsafe native values without echoing them',async t=>{
 const f=await fixture(t);
 await put(configPath(f),'[subagents]\nmax_concurrent = 0\n[subagents.models]\ngeneral-purpose = "sk-PRIVATE"\n');
 const c=(await readConfiguration({home:f.home,client:'grok',env:{},stateDir:f.stateDir})).clients.grok;
 assert.equal(c.status,'attention');assert.ok(c.warnings.includes('UNSUPPORTED_NATIVE_SETTING'));assert.doesNotMatch(JSON.stringify(c),/PRIVATE/);
});

test('a nonstandard GROK_HOME is a prerequisite for automatic setup and not a conflict when explicit',async t=>{
 const f=await fixture(t),elsewhere=path.join(f.root,'elsewhere');
 await fs.writeFile(path.join(f.bin,'grok'),`#!${process.execPath}\nconsole.log("grok 1.0.70 (abc 2026-10-30) [stable]");\n`,{mode:0o700});
 assert.equal(nativeHomeConflict('grok',f.home,{GROK_HOME:elsewhere}),true);assert.equal(nativeHomeConflict('grok',f.home,{GROK_HOME:path.join(f.home,'.grok')}),false);
 const blocked=await setupDetected({...f,env:{...f.env,GROK_HOME:elsewhere},apply:true});
 assert.equal(blocked.results.find(r=>r.client==='grok').status,'prerequisite');await assert.rejects(fs.stat(path.join(f.home,'.grok')),{code:'ENOENT'});
 const done=await setupDetected({...f,apply:true,client:'grok'});
 assert.equal(done.status,'configured');assert.ok(done.requiredActions.some(a=>a.code==='grok-effort-model-dependent'));assert.ok(!done.requiredActions.some(a=>a.code==='grok-per-role-effort-unsupported'));
 assert.equal((await setupDetected({...f,apply:true,client:'grok'})).results[0].status,'unchanged');
 assert.match(formatResult('setup',done,{apply:true}),/Grok\s+Configuration applied/);
 const summary=formatResult('setup',done,{apply:true});assert.match(summary,/Grok: a role effort applies only when its model supports effort/);assert.doesNotMatch(summary,/do not support per-role effort|main session/);
});
