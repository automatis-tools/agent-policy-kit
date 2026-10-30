import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {validatePolicy,rolePreference} from '../src/policy.mjs';
import {ROLE_IDS} from '../src/roles.mjs';
import {nativeRoles,instructionBlock} from '../src/native.mjs';
import {explicitOptions,parseExplicitOptions,formatExplicitCommand} from '../src/explicit.mjs';

const clients=['codex','claude','kimi','agy'];
const flag={codex:'codex',claude:'claude',kimi:'kimi',agy:'antigravity'};
const balanced=JSON.parse(fs.readFileSync(new URL('../policies/balanced.json',import.meta.url)));
const one=()=>({roles:'reviewer','max-concurrent':'3',codex:'reviewer=gpt-6.1-sol:high','avoid-codex':'gpt-6-astra'});

test('explicit commands preserve effective role settings and guidance for every preset/subset',()=>{
 let count=0;
 for(const name of ['fast','balanced','quality']){
  const preset=JSON.parse(fs.readFileSync(new URL(`../policies/${name}.json`,import.meta.url)));
  for(let r=1;r<16;r++)for(let c=1;c<16;c++){
   const roles=ROLE_IDS.filter((_,i)=>r&(1<<i)),selected=clients.filter((_,i)=>c&(1<<i));
   const config={...preset,...(roles.length===4?{}:{selectedRoles:roles}),clients:Object.fromEntries(selected.map(client=>[client,preset.clients[client]]))};
   const options=explicitOptions(config,ROLE_IDS),decoded=validatePolicy(parseExplicitOptions(options,ROLE_IDS));
   assert.deepEqual(Object.keys(decoded.clients),selected);assert.equal(decoded.maxConcurrent,config.maxConcurrent);
   for(const client of selected){
    for(const role of roles)assert.deepEqual(rolePreference(decoded.clients[client],role),rolePreference(config.clients[client],role));
    assert.deepEqual(decoded.clients[client].avoidModels,config.clients[client].avoidModels);
    assert.deepEqual(nativeRoles(client,decoded.clients[client],roles),nativeRoles(client,config.clients[client],roles));
    assert.equal(instructionBlock(client,decoded.clients[client],3,roles),instructionBlock(client,config.clients[client],3,roles));
    const command=formatExplicitCommand(config,'0.1.0',ROLE_IDS);assert.ok(command.includes(`--${flag[client]} '`));assert.doesNotMatch(command,/--config|--preset|--release/);
   }
   count++;
  }
 }
 assert.equal(count,675);
});

test('native effort and provider IDs containing colons and @ round-trip literally',()=>{
 const model='provider:model@20261030[1m]',options={...one(),codex:`reviewer=${model}:native`};
 const policy=validatePolicy(parseExplicitOptions(options,ROLE_IDS));assert.equal(policy.clients.codex.roles.reviewer.model,model);assert.equal(policy.clients.codex.roles.reviewer.effort,null);
 const command=formatExplicitCommand(policy,'0.1.0',ROLE_IDS);assert.ok(command.includes(`reviewer=${model}:native`));assert.ok(command.includes('--max-concurrent 3'));
 assert.throws(()=>formatExplicitCommand(policy,'0.1.0;echo',ROLE_IDS),/Invalid release/);
});

test('explicit input rejects missing, extra, repeated, malformed or opaque choices',()=>{
 const base=one();
 for(const options of [{...base,roles:''},{...base,roles:'reviewer,reviewer'},{...base,roles:'invented'},{...base,'max-concurrent':'0'},{...base,'max-concurrent':'33'},{...base,'max-concurrent':'03'},{...base,codex:'reviewer=only-model'},{...base,codex:'reviewer=model:ultra'},{...base,codex:'reviewer=model:high,reviewer=model:high'},{...base,codex:'worker=model:high'},{...base,codex:'balanced'},{...base,codex:'reviewer=$(id):high'},{...base,codex:'reviewer=model;id:high'},{...base,'avoid-codex':''},{...base,'avoid-kimi':'model'},{roles:'reviewer','max-concurrent':'3'},{...base,unknown:'value'},{...base,codex:'x'.repeat(66000)}])assert.throws(()=>parseExplicitOptions(options,ROLE_IDS),{code:'INVALID_EXPLICIT_CONFIG'});
 const inherited=Object.assign(Object.create({roles:'reviewer','max-concurrent':'3'}),{codex:base.codex});assert.throws(()=>parseExplicitOptions(inherited,ROLE_IDS),{code:'INVALID_EXPLICIT_CONFIG'});
});

test('native Kimi alias consistency and Antigravity tiers remain policy requirements',()=>{
 const valid={roles:'worker,reviewer','max-concurrent':'3',kimi:'worker=native/k3:high,reviewer=native/k3:native',antigravity:'worker=pro,reviewer=flash'};
 assert.doesNotThrow(()=>validatePolicy(parseExplicitOptions(valid,ROLE_IDS)));
 assert.throws(()=>validatePolicy(parseExplicitOptions({...valid,kimi:'worker=native/k3:high,reviewer=native/k3:low'},ROLE_IDS)),{code:'INVALID_POLICY'});
 assert.throws(()=>parseExplicitOptions({...valid,antigravity:'worker=pro:high,reviewer=flash'},ROLE_IDS),{code:'INVALID_EXPLICIT_CONFIG'});
});

test('the visible multiline command passes literal per-tool arguments through a real shell',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'apk-explicit-shell-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const output=path.join(root,'arguments.json'),fake=path.join(root,'npx');
 fs.writeFileSync(fake,`#!${process.execPath}\nrequire('node:fs').writeFileSync(process.env.APK_TEST_ARGUMENTS,JSON.stringify(process.argv.slice(2)));\n`,{mode:0o700});
 const policy={...balanced,selectedRoles:['reviewer'],clients:{codex:{code:{model:'provider:model@2026[1m]',effort:null},light:{model:'provider:model@2026[1m]',effort:null},avoidModels:['gpt-6-astra']}}};
 fs.writeFileSync(path.join(root,'reviewer=provider:model@20261:native'),'glob trap');
 const command=formatExplicitCommand(policy,'0.1.0',ROLE_IDS);
 const run=spawnSync('/bin/sh',['-c',command],{cwd:root,env:{...process.env,PATH:root+path.delimiter+process.env.PATH,APK_TEST_ARGUMENTS:output},encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const args=JSON.parse(fs.readFileSync(output));assert.equal(args[args.indexOf('--codex')+1],'reviewer=provider:model@2026[1m]:native');assert.equal(args[args.indexOf('--roles')+1],'reviewer');assert.equal(args.at(-1),'--apply');assert.ok(command.includes(' \\\n'));
});
