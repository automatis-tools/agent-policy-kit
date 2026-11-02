import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {validatePolicy,rolePreference} from '../src/policy.mjs';
import {ROLE_IDS,ROLE_DEFINITIONS} from '../src/roles.mjs';
import {nativeRoles,instructionBlock} from '../src/native.mjs';
import {explicitOptions,parseExplicitOptions,formatExplicitCommand} from '../src/explicit.mjs';

const clients=['chatgpt','claude','kimi','gemini','grok'];
const flag={chatgpt:'chatgpt',claude:'claude',kimi:'kimi',gemini:'gemini',grok:'grok'};
const balanced=JSON.parse(fs.readFileSync(new URL('../policies/balanced.json',import.meta.url)));
const one=()=>({roles:'reviewer','max-concurrent':'3',chatgpt:'reviewer=gpt-6.1-sol:high','avoid-chatgpt':'gpt-6-astra'});

test('explicit commands preserve effective role settings and guidance for every preset/subset',()=>{
 let count=0;
 for(const name of ['fast','balanced','quality']){
  const preset=JSON.parse(fs.readFileSync(new URL(`../policies/${name}.json`,import.meta.url)));
  for(let r=1;r<(1<<ROLE_IDS.length);r++)for(let c=1;c<(1<<clients.length);c++){
   const roles=ROLE_IDS.filter((_,i)=>r&(1<<i)),selected=clients.filter((_,i)=>c&(1<<i));
   const config={...preset,...(roles.length===ROLE_IDS.length?{}:{selectedRoles:roles}),clients:Object.fromEntries(selected.map(client=>[client,preset.clients[client]]))};
   const options=explicitOptions(config,ROLE_DEFINITIONS),decoded=validatePolicy(parseExplicitOptions(options,ROLE_IDS));
   assert.deepEqual(Object.keys(decoded.clients),selected);assert.equal(decoded.maxConcurrent,config.maxConcurrent);
   for(const client of selected){
    for(const role of roles)assert.deepEqual(rolePreference(decoded.clients[client],role),rolePreference(config.clients[client],role));
    assert.deepEqual(decoded.clients[client].avoidModels,config.clients[client].avoidModels);
    assert.deepEqual(nativeRoles(client,decoded.clients[client],roles),nativeRoles(client,config.clients[client],roles));
    assert.equal(instructionBlock(client,decoded.clients[client],3,roles),instructionBlock(client,config.clients[client],3,roles));
    const command=formatExplicitCommand(config,'0.1.0',ROLE_DEFINITIONS);assert.ok(command.includes(`--${flag[client]} '`));assert.doesNotMatch(command,/--config|--preset|--release/);
   }
   count++;
  }
 }
 assert.equal(count,3*((1<<ROLE_IDS.length)-1)*((1<<clients.length)-1));
});

test('native effort and provider IDs containing colons and @ round-trip literally',()=>{
 const model='provider:model@20261030[1m]',options={...one(),chatgpt:`reviewer=${model}:native`};
 const policy=validatePolicy(parseExplicitOptions(options,ROLE_IDS));assert.equal(policy.clients.chatgpt.roles.reviewer.model,model);assert.equal(policy.clients.chatgpt.roles.reviewer.effort,null);
 const command=formatExplicitCommand(policy,'0.1.0',ROLE_DEFINITIONS);assert.ok(command.includes(`reviewer=${model}:native`));assert.ok(command.includes('--max-concurrent 3'));
 assert.throws(()=>formatExplicitCommand(policy,'0.1.0;echo',ROLE_DEFINITIONS),/Invalid release/);
});

test('explicit input rejects missing, extra, repeated, malformed or opaque choices',()=>{
 const base=one();
 for(const options of [{...base,roles:''},{...base,roles:'reviewer,reviewer'},{...base,roles:'invented'},{...base,'max-concurrent':'0'},{...base,'max-concurrent':'33'},{...base,'max-concurrent':'03'},{...base,chatgpt:'reviewer=only-model'},{...base,chatgpt:'reviewer=model:ultra'},{...base,chatgpt:'reviewer=model:high,reviewer=model:high'},{...base,chatgpt:'worker=model:high'},{...base,chatgpt:'balanced'},{...base,chatgpt:'reviewer=$(id):high'},{...base,chatgpt:'reviewer=model;id:high'},{...base,'avoid-chatgpt':''},{...base,'avoid-kimi':'model'},{roles:'reviewer','max-concurrent':'3'},{...base,unknown:'value'},{...base,chatgpt:'x'.repeat(66000)}])assert.throws(()=>parseExplicitOptions(options,ROLE_IDS),{code:'INVALID_EXPLICIT_CONFIG'});
 const inherited=Object.assign(Object.create({roles:'reviewer','max-concurrent':'3'}),{chatgpt:base.chatgpt});assert.throws(()=>parseExplicitOptions(inherited,ROLE_IDS),{code:'INVALID_EXPLICIT_CONFIG'});
});

test('Grok Build accepts role=model, role=model:effort and role=model:native and rejects foreign flags',()=>{
 const valid={roles:'worker,reviewer','max-concurrent':'3',grok:'worker=grok-4.7,reviewer=grok-4.6','grok-max-concurrent':'2','avoid-grok':'grok-4.5'};
 const parsed=validatePolicy(parseExplicitOptions(valid,ROLE_IDS));
 assert.deepEqual(rolePreference(parsed.clients.grok,'reviewer'),{model:'grok-4.6',effort:null});assert.equal(parsed.clients.grok.maxConcurrent,2);assert.deepEqual(parsed.clients.grok.avoidModels,['grok-4.5']);
 const pinned=validatePolicy(parseExplicitOptions({...valid,grok:'worker=grok-4.7:xhigh,reviewer=grok-4.6:native'},ROLE_IDS));
 assert.deepEqual(rolePreference(pinned.clients.grok,'worker'),{model:'grok-4.7',effort:'xhigh'});assert.deepEqual(rolePreference(pinned.clients.grok,'reviewer'),{model:'grok-4.6',effort:null});
 // The codec accepts the generic level names; the catalog check refuses levels a known model does not list.
 for(const bad of ['worker=grok-4.7:max,reviewer=grok-4.6','worker=grok-4.7,reviewer=grok-4.6:high','worker=grok-4.7:none,reviewer=grok-4.6'])assert.throws(()=>validatePolicy(parseExplicitOptions({...valid,grok:bad},ROLE_IDS)),{code:'INVALID_POLICY'},bad);
 for(const bad of ['worker=grok-4.7','worker=:high,reviewer=grok-4.6'])assert.throws(()=>parseExplicitOptions({...valid,grok:bad},ROLE_IDS),{code:'INVALID_EXPLICIT_CONFIG'},bad);
 assert.throws(()=>parseExplicitOptions({roles:'worker','max-concurrent':'3','avoid-grok':'grok-4.5'},ROLE_IDS),{code:'INVALID_EXPLICIT_CONFIG'});
 const config={schemaVersion:1,maxConcurrent:3,selectedRoles:['worker'],clients:{grok:{code:{model:'grok-4.7',effort:null},light:{model:'grok-4.7',effort:null},avoidModels:[]}}};
 const command=formatExplicitCommand(config,'0.1.0',ROLE_DEFINITIONS);assert.match(command,/--grok 'worker=grok-4\.7'/);assert.doesNotMatch(command,/:native/);
 const high={...config,clients:{grok:{...config.clients.grok,code:{model:'grok-4.7',effort:'high'}}}};
 assert.match(formatExplicitCommand(high,'0.1.0',ROLE_DEFINITIONS),/--grok 'worker=grok-4\.7:high'/);
 assert.deepEqual(validatePolicy(parseExplicitOptions(explicitOptions(high,ROLE_DEFINITIONS),ROLE_IDS)).clients.grok.roles.worker,{model:'grok-4.7',effort:'high'});
});
test('native Kimi alias consistency and Antigravity tiers remain policy requirements',()=>{
 const valid={roles:'worker,reviewer','max-concurrent':'3',kimi:'worker=native/k3:high,reviewer=native/k3:native',gemini:'worker=pro,reviewer=flash'};
 assert.doesNotThrow(()=>validatePolicy(parseExplicitOptions(valid,ROLE_IDS)));
 assert.throws(()=>validatePolicy(parseExplicitOptions({...valid,kimi:'worker=native/k3:high,reviewer=native/k3:low'},ROLE_IDS)),{code:'INVALID_POLICY'});
 assert.throws(()=>parseExplicitOptions({...valid,gemini:'worker=pro:high,reviewer=flash'},ROLE_IDS),{code:'INVALID_EXPLICIT_CONFIG'});
});

test('the visible multiline command passes literal per-tool arguments through a real shell',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'apk-explicit-shell-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const output=path.join(root,'arguments.json'),fake=path.join(root,'npx');
 fs.writeFileSync(fake,`#!${process.execPath}\nrequire('node:fs').writeFileSync(process.env.APK_TEST_ARGUMENTS,JSON.stringify(process.argv.slice(2)));\n`,{mode:0o700});
 const policy={...balanced,selectedRoles:['reviewer'],clients:{chatgpt:{code:{model:'provider:model@2026[1m]',effort:null},light:{model:'provider:model@2026[1m]',effort:null},avoidModels:['gpt-6-astra']}}};
 fs.writeFileSync(path.join(root,'reviewer=provider:model@20261:native'),'glob trap');
 const command=formatExplicitCommand(policy,'0.1.0',ROLE_DEFINITIONS);
 const run=spawnSync('/bin/sh',['-c',command],{cwd:root,env:{...process.env,PATH:root+path.delimiter+process.env.PATH,APK_TEST_ARGUMENTS:output},encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const args=JSON.parse(fs.readFileSync(output));assert.equal(args[args.indexOf('--chatgpt')+1],'reviewer=provider:model@2026[1m]:native');assert.equal(args[args.indexOf('--roles')+1],'reviewer');assert.equal(args.at(-1),'--apply');assert.ok(command.includes(' \\\n'));
});

test('new role fallback kinds agree between explicit commands and native generation',()=>{
 const config={schemaVersion:1,maxConcurrent:3,clients:{chatgpt:{code:{model:'gpt-6.1-sol',effort:'medium'},light:{model:'gpt-6-luna',effort:'low'},avoidModels:[]}}};
 const decoded=validatePolicy(parseExplicitOptions(explicitOptions(config,ROLE_DEFINITIONS),ROLE_IDS));
 assert.deepEqual(rolePreference(decoded.clients.chatgpt,'tester'),config.clients.chatgpt.code);
 assert.deepEqual(rolePreference(decoded.clients.chatgpt,'writer'),config.clients.chatgpt.light);
 assert.deepEqual(nativeRoles('chatgpt',decoded.clients.chatgpt),nativeRoles('chatgpt',config.clients.chatgpt));
});

test('explicit per-tool concurrency overrides round-trip without changing the shared fallback',()=>{
 const options={...one(),'chatgpt-max-concurrent':'5',claude:'reviewer=sonnet:high','claude-max-concurrent':'2'};
 const policy=validatePolicy(parseExplicitOptions(options,ROLE_IDS));assert.equal(policy.maxConcurrent,3);assert.equal(policy.clients.chatgpt.maxConcurrent,5);assert.equal(policy.clients.claude.maxConcurrent,2);
 const encoded=explicitOptions(policy,ROLE_DEFINITIONS);assert.equal(encoded['chatgpt-max-concurrent'],'5');assert.equal(encoded['claude-max-concurrent'],'2');assert.deepEqual(validatePolicy(parseExplicitOptions(encoded,ROLE_IDS)),policy);
 for(const bad of [{...one(),'kimi-max-concurrent':'2'},{...one(),'chatgpt-max-concurrent':'0'},{...one(),'chatgpt-max-concurrent':'33'},{...one(),'chatgpt-max-concurrent':'1.5'},{...one(),'chatgpt-max-concurrent':'02'}])assert.throws(()=>parseExplicitOptions(bad,ROLE_IDS),{code:'INVALID_EXPLICIT_CONFIG'});
});

test('Grok custom model ids may contain colons and effort-like suffixes round-trip with an explicit :native',()=>{
 const config=(model,effort=null)=>({schemaVersion:1,maxConcurrent:3,selectedRoles:['worker'],clients:{grok:{code:{model,effort},light:{model,effort},avoidModels:[]}}});
 const command=formatExplicitCommand(config('org:grok-custom'),'0.1.0',ROLE_DEFINITIONS);assert.match(command,/--grok 'worker=org:grok-custom'/);
 const parsed=parseExplicitOptions({roles:'worker','max-concurrent':'3',grok:'worker=org:grok-custom'},ROLE_IDS);
 assert.deepEqual(rolePreference(parsed.clients.grok,'worker'),{model:'org:grok-custom',effort:null});
 for(const [model,effort,text] of [['grok-4.7:high',null,'worker=grok-4.7:high:native'],['grok-4.7:native',null,'worker=grok-4.7:native:native'],['org:model:xhigh',null,'worker=org:model:xhigh:native'],['org:model:xhigh','max','worker=org:model:xhigh:max']]){
  const options=explicitOptions(config(model,effort),ROLE_DEFINITIONS);assert.equal(options.grok,text,model);
  assert.deepEqual(rolePreference(parseExplicitOptions(options,ROLE_IDS).clients.grok,'worker'),{model,effort},model);
 }
});
