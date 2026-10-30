import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {validatePolicy} from '../src/policy.mjs';
import {planInstall,applyInstall,uninstall,inspectConfiguration} from '../src/install.mjs';
import {parseToml} from '../src/toml.mjs';

const roles=['worker','reviewer','explorer','routine'];
const dirs={codex:'.codex',claude:'.claude',kimi:'.kimi-code',agy:'.gemini'};
async function fixture(t,client='codex'){
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'apk-selected-roles-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const home=path.join(root,'home');await fs.mkdir(home);
 const policy=JSON.parse(await fs.readFile(new URL('../policies/balanced.json',import.meta.url)));
 return {client,home,stateDir:path.join(home,'.agent-policy-kit'),policyPath:path.join(root,'preferences.json'),policy};
}
async function put(file,text){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,text);}
const rolePath=(f,role)=>path.join(f.home,dirs[f.client],f.client==='agy'?'config/agents':'agents',`apk-${role}.${f.client==='codex'?'toml':'md'}`);
const receipt=f=>path.join(f.stateDir,'installations',f.client+'.json');
async function install(f,replace=false){await put(f.policyPath,JSON.stringify(f.policy));return applyInstall(await planInstall({...f,replace}));}

test('selectedRoles is optional, nonempty, unique and limited to the native role catalog',()=>{
 const base={schemaVersion:1,maxConcurrent:3,clients:{codex:{code:{model:'code',effort:'high'},light:{model:'light',effort:'high'},avoidModels:[]}}};
 assert.doesNotThrow(()=>validatePolicy(base));
 assert.deepEqual(validatePolicy({...base,selectedRoles:['reviewer']}).selectedRoles,['reviewer']);
 for(const selectedRoles of [[],['reviewer','reviewer'],['invented'],'reviewer',null,[null]])assert.throws(()=>validatePolicy({...base,selectedRoles}),{code:'INVALID_POLICY'});
 const kimi={code:{model:'unused',effort:'high'},light:{model:'shared',effort:'low'},avoidModels:['unused'],roles:{reviewer:{model:'shared',effort:'high'}}};
 assert.doesNotThrow(()=>validatePolicy({...base,selectedRoles:['reviewer'],clients:{kimi}}));
});

test('every native adapter creates only the selected role and uses its model as the subagent default',async t=>{
 for(const client of Object.keys(dirs)){
  const f=await fixture(t,client),config=f.policy.clients[client];f.policy.selectedRoles=['reviewer'];
  config.roles={reviewer:{model:client==='agy'?'flash':'fixture-review',effort:client==='agy'?null:'high'}};
  if(client==='kimi')await put(path.join(f.home,dirs[client],'config.toml'),'default_model="user-main"\n[providers.fixture]\ntype="kimi"\n[models.fixture-review]\nprovider="fixture"\nmodel="fixture-review"\nmax_context_size=262144\nsupport_efforts=["high"]\n');
  await install(f);
  assert.match(await fs.readFile(rolePath(f,'reviewer'),'utf8'),/fixture-review|model: "flash"/);
  for(const role of roles.filter(role=>role!=='reviewer'))await assert.rejects(fs.stat(rolePath(f,role)),{code:'ENOENT'});
  const instructions=await fs.readFile(path.join(f.home,dirs[client],client==='claude'?'CLAUDE.md':'AGENTS.md'),'utf8');
  assert.match(instructions,/apk-reviewer/);assert.doesNotMatch(instructions,/apk-worker|apk-explorer|apk-routine/);
  if(client==='codex')assert.equal(parseToml(await fs.readFile(path.join(f.home,dirs[client],'config.toml'),'utf8')).agents.default_subagent_model,'fixture-review');
  if(client==='claude')assert.equal(JSON.parse(await fs.readFile(path.join(f.home,dirs[client],'settings.json'))).env.CLAUDE_CODE_SUBAGENT_MODEL,'fixture-review');
  if(client==='kimi'){const native=parseToml(await fs.readFile(path.join(f.home,dirs[client],'config.toml'),'utf8'));assert.equal(native.default_model,'user-main');assert.equal(native.secondary_model.default_model,'fixture-review');assert.deepEqual(Object.keys(native.secondary_model.models),['fixture-review']);}
  assert.equal((await inspectConfiguration(f)).status,'verified');
  const record=JSON.parse(await fs.readFile(receipt(f)));assert.equal(record.schemaVersion,4);assert.deepEqual(record.selectedRoles,['reviewer']);
  await uninstall({...f,apply:true});await assert.rejects(fs.stat(rolePath(f,'reviewer')),{code:'ENOENT'});
 }
});

test('role-set replacement removes only earlier owned roles and supports expanding again',async t=>{
 const f=await fixture(t);await install(f);f.policy.selectedRoles=['reviewer'];await install(f,true);
 for(const role of roles.filter(role=>role!=='reviewer'))await assert.rejects(fs.stat(rolePath(f,role)),{code:'ENOENT'});
 await put(rolePath(f,'routine'),'unowned user role\n');f.policy.selectedRoles=['reviewer','explorer'];await install(f,true);
 assert.equal(await fs.readFile(rolePath(f,'routine'),'utf8'),'unowned user role\n');assert.match(await fs.readFile(rolePath(f,'explorer'),'utf8'),/apk-explorer/);
 await uninstall({...f,apply:true});assert.equal(await fs.readFile(rolePath(f,'routine'),'utf8'),'unowned user role\n');
});

test('subset installation preserves unselected same-name files and routine refers back to the parent',async t=>{
 const f=await fixture(t);f.policy.selectedRoles=['routine'];await put(rolePath(f,'worker'),'unowned worker\n');await install(f);
 assert.doesNotMatch(await fs.readFile(rolePath(f,'routine'),'utf8'),/apk-worker/);
 await uninstall({...f,apply:true});assert.equal(await fs.readFile(rolePath(f,'worker'),'utf8'),'unowned worker\n');
});

test('removing a previously owned role refuses drift before changing any file',async t=>{
 const f=await fixture(t);await install(f);await fs.appendFile(rolePath(f,'worker'),'# user edit\n');const original=await fs.readFile(rolePath(f,'reviewer'),'utf8');f.policy.selectedRoles=['reviewer'];
 await assert.rejects(install(f,true),{code:'OWNED_DRIFT'});assert.equal(await fs.readFile(rolePath(f,'reviewer'),'utf8'),original);assert.match(await fs.readFile(rolePath(f,'worker'),'utf8'),/# user edit/);
});

test('v4 receipt role sets bind its owned files and old v3 receipts remain removable',async t=>{
 const f=await fixture(t);f.policy.selectedRoles=['reviewer'];await install(f);const original=JSON.parse(await fs.readFile(receipt(f)));
 for(const selectedRoles of [[],['reviewer','worker'],['reviewer','reviewer'],['invented']]){await fs.writeFile(receipt(f),JSON.stringify({...original,selectedRoles}));await assert.rejects(uninstall({...f,apply:true}),{code:'INVALID_RECEIPT'});}
 await fs.writeFile(receipt(f),JSON.stringify(original));await uninstall({...f,apply:true});delete f.policy.selectedRoles;await install(f,true);
 const old=JSON.parse(await fs.readFile(receipt(f)));old.schemaVersion=3;delete old.selectedRoles;await fs.writeFile(receipt(f),JSON.stringify(old));assert.equal((await inspectConfiguration(f)).status,'verified');await uninstall({...f,apply:true});
});
