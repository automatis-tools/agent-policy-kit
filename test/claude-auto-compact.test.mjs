import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validatePolicy} from '../src/policy.mjs';
import {parseExplicitOptions,explicitOptions,formatExplicitCommand,EXPLICIT_FIELDS} from '../src/explicit.mjs';
import {planInstall,applyInstall,uninstall,inspectConfiguration} from '../src/install.mjs';
import {readConfiguration} from '../src/inspect.mjs';
import {formatResult} from '../src/output.mjs';
import {ROLE_IDS,ROLE_DEFINITIONS} from '../src/roles.mjs';

const bin=fileURLToPath(new URL('../bin/agent-policy.mjs',import.meta.url));
const choice={model:'claude-opus-5-5',effort:'high'},light={model:'claude-haiku-5-5',effort:null};
const roleCatalog=ROLE_DEFINITIONS.map(role=>({id:role.id,kind:role.kind}));
const claude=(extra={})=>({code:choice,light,avoidModels:[],...extra});
const policy=(window,extra={})=>({schemaVersion:1,maxConcurrent:3,clients:{claude:claude(window===undefined?{}:{autoCompactWindow:window})},...extra});
const explicit=(extra={})=>({roles:'worker,reviewer','max-concurrent':'3',claude:'worker=claude-opus-5-5:high,reviewer=claude-sonnet-5-5:high',...extra});
const WINDOW=500000;

function fixture(t,value=policy(WINDOW)){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'apk-auto-compact-')));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const home=path.join(root,'home');fs.mkdirSync(path.join(home,'.claude'),{recursive:true});
 const policyPath=path.join(root,'input.json');fs.writeFileSync(policyPath,JSON.stringify(value));
 return {root,client:'claude',home,stateDir:path.join(home,'.agent-policy-kit'),policyPath,settings:path.join(home,'.claude/settings.json')};
}
const options=f=>({client:'claude',home:f.home,stateDir:f.stateDir,policyPath:f.policyPath,releaseVersion:'0.5.2'});
const install=async(f,extra={})=>applyInstall(await planInstall({...options(f),...extra}));
const setPolicy=(f,value)=>fs.writeFileSync(f.policyPath,JSON.stringify(value));
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const receiptPath=f=>path.join(f.stateDir,'installations/claude.json');
const receipt=f=>readJson(receiptPath(f));
const jsonEntry=value=>value.files.find(file=>file.type==='json');
const putSettings=(f,value)=>fs.writeFileSync(f.settings,typeof value==='string'?value:JSON.stringify(value));
const removeOptions=f=>({client:'claude',home:f.home,stateDir:f.stateDir,apply:true});

test('the policy accepts the window only as an in-range integer on Claude',()=>{
 for(const value of [100000,500000,1000000])assert.equal(validatePolicy(policy(value)).clients.claude.autoCompactWindow,value);
 assert.equal(Object.hasOwn(validatePolicy(policy()).clients.claude,'autoCompactWindow'),false);
 for(const value of [99999,1000001,500000.5,'500000','500k',null,true])assert.throws(()=>validatePolicy(policy(value)),{code:'INVALID_POLICY'},String(value));
 const chatgpt={code:{model:'gpt-6.1-sol',effort:'high'},light:{model:'gpt-6-luna',effort:'high'},avoidModels:[],autoCompactWindow:WINDOW};
 assert.throws(()=>validatePolicy({schemaVersion:1,maxConcurrent:3,clients:{chatgpt}}),{code:'INVALID_POLICY'});
});

test('the option is off by default and no preset or schema default sets it',()=>{
 for(const name of fs.readdirSync(new URL('../policies/',import.meta.url))){
  assert.doesNotMatch(fs.readFileSync(new URL(`../policies/${name}`,import.meta.url),'utf8'),/autoCompactWindow/,name);
 }
 const schema=readJson(fileURLToPath(new URL('../schema/policy.schema.json',import.meta.url))).$defs.claudeClient;
 assert.deepEqual([schema.properties.autoCompactWindow.minimum,schema.properties.autoCompactWindow.maximum],[100000,1000000]);
 assert.equal(schema.required.includes('autoCompactWindow'),false);
 assert.equal(Object.hasOwn(parseExplicitOptions(explicit(),ROLE_IDS).clients.claude,'autoCompactWindow'),false);
});

test('the explicit option normalizes every input form and round-trips',()=>{
 assert.ok(EXPLICIT_FIELDS.includes('claude-auto-compact'));
 for(const[input,window]of [['100000',100000],['250000',250000],['1000000',1000000],['100k',100000],['500k',500000],['1000k',1000000],['1M',1000000]]){
  const parsed=parseExplicitOptions(explicit({'claude-auto-compact':input}),ROLE_IDS);
  assert.equal(validatePolicy(parsed).clients.claude.autoCompactWindow,window,input);
  const round=explicitOptions(parsed,roleCatalog);
  assert.equal(round['claude-auto-compact'],String(window));
  assert.deepEqual(parseExplicitOptions(round,ROLE_IDS),parsed);
 }
 const parsed=parseExplicitOptions(explicit({'claude-auto-compact':'500k'}),ROLE_IDS);
 assert.match(formatExplicitCommand(parsed,'1.2.3',roleCatalog),/--claude-auto-compact 500000/);
 assert.equal(explicitOptions(parseExplicitOptions(explicit(),ROLE_IDS),roleCatalog)['claude-auto-compact'],undefined);
});

test('the explicit option refuses other forms and needs --claude',()=>{
 const reject=value=>assert.throws(()=>parseExplicitOptions(value,ROLE_IDS),{code:'INVALID_EXPLICIT_CONFIG'},JSON.stringify(value));
 for(const value of ['','200','99999','1000001','99k','1001k','2M','0','500K','1m','0.5M','1.5M','500 k','5e5','-500000','+500000','0500000','500000k','auto','500000 '])reject(explicit({'claude-auto-compact':value}));
 reject({roles:'worker','max-concurrent':'3',chatgpt:'worker=gpt-6.1-sol:high','claude-auto-compact':'500k'});
 const other={schemaVersion:1,maxConcurrent:3,clients:{chatgpt:{code:{model:'m',effort:'high'},light:{model:'m',effort:'high'},avoidModels:[],autoCompactWindow:WINDOW}}};
 assert.throws(()=>explicitOptions(other,roleCatalog),{code:'INVALID_EXPLICIT_CONFIG'});
});

test('setup without the option writes exactly the v4 receipt that 0.5.2 accepts',async t=>{
 for(const[effort,effortOp]of [['high',[{kind:'value',path:['env','CLAUDE_CODE_SUBAGENT_EFFORT'],existed:false,before:null,after:'high'}]],[null,[]]]){
  const value={schemaVersion:1,maxConcurrent:3,clients:{claude:claude({code:{model:'claude-opus-5-5',effort}})}};
  const f=fixture(t,value);await install(f);
  const text=fs.readFileSync(receiptPath(f),'utf8'),written=JSON.parse(text);
  assert.equal(written.schemaVersion,4);
  assert.deepEqual(Object.keys(written),['schemaVersion','kind','client','home','stateDir','releaseVersion','source','selectedRoles','policyHash','warnings','files']);
  // The JSON entry, byte for byte, in the only shape that the 0.5.2 validator takes: two or three env operations.
  const expected={path:f.settings,type:'json',existed:false,ops:[{kind:'value',path:['env','CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS'],existed:false,before:null,after:'3'},{kind:'value',path:['env','CLAUDE_CODE_SUBAGENT_MODEL'],existed:false,before:null,after:'claude-opus-5-5'},...effortOp],created:[['env']]};
  assert.ok(text.includes(JSON.stringify(expected,null,2).replaceAll('\n','\n    ')),'the entry keeps its 0.5.2 bytes');
  assert.equal(fs.readFileSync(f.settings,'utf8'),JSON.stringify({env:{CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS:'3',CLAUDE_CODE_SUBAGENT_MODEL:'claude-opus-5-5',...(effort?{CLAUDE_CODE_SUBAGENT_EFFORT:'high'}:{})}},null,2)+'\n');
  assert.equal(JSON.stringify(written).includes('autoCompactWindow'),false);
  assert.equal(fs.readFileSync(path.join(f.stateDir,'policy.json'),'utf8').includes('autoCompactWindow'),false);
 }
});

test('setup with the option owns the top-level key through receipt format v5',async t=>{
 const f=fixture(t),original={model:'main',permissions:{allow:['x']}};
 putSettings(f,original);
 const plan=await planInstall(options(f));
 assert.ok(!plan.warnings.includes('claude-auto-compact-overridden'));
 await applyInstall(plan);
 const saved=readJson(f.settings);
 assert.equal(saved.autoCompactWindow,WINDOW);
 assert.equal(saved.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW,undefined,'the variable would remove per-model control');
 assert.equal(saved.model,'main');assert.deepEqual(saved.permissions,{allow:['x']});
 const written=receipt(f);
 assert.equal(written.schemaVersion,5);
 assert.deepEqual(jsonEntry(written).ops.at(-1),{kind:'value',path:['autoCompactWindow'],existed:false,before:null,after:WINDOW});
 assert.deepEqual(jsonEntry(written).ops.slice(0,-1).map(op=>op.path),[['env','CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS'],['env','CLAUDE_CODE_SUBAGENT_MODEL'],['env','CLAUDE_CODE_SUBAGENT_EFFORT']]);
 assert.equal((await inspectConfiguration(options(f))).status,'verified');
 assert.equal((await planInstall(options(f))).status,'unchanged');
 await uninstall(removeOptions(f));
 assert.deepEqual(readJson(f.settings),original);
});

test('uninstall removes a key that did not exist and the file that setup created',async t=>{
 const f=fixture(t);
 await install(f);
 assert.equal(readJson(f.settings).autoCompactWindow,WINDOW);
 await uninstall(removeOptions(f));
 assert.equal(fs.existsSync(f.settings),false);
 assert.equal(fs.existsSync(receiptPath(f)),false);
});

test('a different user value is recorded and restored, and an unusable one is refused',async t=>{
 const f=fixture(t);
 putSettings(f,{autoCompactWindow:200000,theme:'dark'});
 await install(f);
 assert.equal(readJson(f.settings).autoCompactWindow,WINDOW);
 assert.deepEqual(jsonEntry(receipt(f)).ops.at(-1),{kind:'value',path:['autoCompactWindow'],existed:true,before:200000,after:WINDOW});
 await uninstall(removeOptions(f));
 assert.deepEqual(readJson(f.settings),{autoCompactWindow:200000,theme:'dark'});
 for(const value of ['500000',null,500000.5,{}]){
  const g=fixture(t);putSettings(g,{autoCompactWindow:value});
  await assert.rejects(planInstall(options(g)),{code:'UNSUPPORTED_CONFIG'},JSON.stringify(value));
 }
 const g=fixture(t);putSettings(g,{autoCompactWindow:50000});
 await install(g);
 await uninstall(removeOptions(g));
 assert.deepEqual(readJson(g.settings),{autoCompactWindow:50000},'a value outside the option range is still a user value to restore');
});

test('a replacing setup changes the format with the option and keeps the first user value',async t=>{
 const f=fixture(t,policy());
 putSettings(f,{autoCompactWindow:200000});
 await install(f);
 assert.equal(receipt(f).schemaVersion,4);
 assert.equal(readJson(f.settings).autoCompactWindow,200000,'without the option the user key is not owned');
 setPolicy(f,policy(WINDOW));
 await assert.rejects(planInstall(options(f)),{code:'INSTALLATION_CONFLICT'});
 await install(f,{replace:true});
 assert.equal(receipt(f).schemaVersion,5);
 assert.equal(jsonEntry(receipt(f)).ops.at(-1).before,200000);
 setPolicy(f,policy(1000000));
 await install(f,{replace:true});
 assert.equal(readJson(f.settings).autoCompactWindow,1000000);
 assert.equal(jsonEntry(receipt(f)).ops.at(-1).before,200000,'the baseline stays the value from before the first setup');
 setPolicy(f,policy());
 await install(f,{replace:true});
 assert.equal(receipt(f).schemaVersion,4,'a setup without the option returns to v4');
 assert.equal(jsonEntry(receipt(f)).ops.some(op=>op.path[0]==='autoCompactWindow'),false);
 assert.equal(readJson(f.settings).autoCompactWindow,200000,'the user value comes back');
});

test('a replacing setup without the option removes a key APK added',async t=>{
 const f=fixture(t);
 await install(f);
 setPolicy(f,policy());
 await install(f,{replace:true});
 assert.equal(receipt(f).schemaVersion,4);
 assert.equal(Object.hasOwn(readJson(f.settings),'autoCompactWindow'),false);
});

test('a changed owned value is drift, and later edits elsewhere survive',async t=>{
 for(const edit of [settings=>{settings.autoCompactWindow=300000;},settings=>{delete settings.autoCompactWindow;}]){
  const f=fixture(t);await install(f);
  const settings=readJson(f.settings);edit(settings);putSettings(f,settings);
  const before=fs.readFileSync(f.settings,'utf8');
  await assert.rejects(inspectConfiguration(options(f)),{code:'OWNED_DRIFT'});
  await assert.rejects(uninstall(removeOptions(f)),{code:'OWNED_DRIFT'});
  setPolicy(f,policy());
  await assert.rejects(planInstall({...options(f),replace:true}),{code:'OWNED_DRIFT'});
  assert.equal(fs.readFileSync(f.settings,'utf8'),before,'a refused removal writes nothing');
  assert.equal(receipt(f).schemaVersion,5);
 }
 const f=fixture(t);await install(f);
 const settings=readJson(f.settings);
 settings.modelSettings={'claude-opus-5-5':{autoCompactWindow:300000}};settings.theme='dark';
 putSettings(f,settings);
 await uninstall(removeOptions(f));
 assert.deepEqual(readJson(f.settings),{modelSettings:{'claude-opus-5-5':{autoCompactWindow:300000}},theme:'dark'});
});

test('a damaged v5 receipt and any v5 shape outside the format are refused',async t=>{
 const windowOp={kind:'value',path:['autoCompactWindow'],existed:false,before:null,after:WINDOW};
 const cases=[
  r=>{jsonEntry(r).ops.pop();},
  r=>{jsonEntry(r).ops.push(windowOp);},
  r=>{jsonEntry(r).ops.at(-1).after=99999;},
  r=>{jsonEntry(r).ops.at(-1).after='500000';},
  r=>{jsonEntry(r).ops.at(-1).path=['env','CLAUDE_CODE_AUTO_COMPACT_WINDOW'];},
  r=>{Object.assign(jsonEntry(r).ops.at(-1),{existed:true,before:null});},
  r=>{Object.assign(jsonEntry(r).ops.at(-1),{existed:false,before:200000});},
  r=>{Object.assign(jsonEntry(r).ops.at(-1),{existed:true,before:'200000'});},
  r=>{jsonEntry(r).ops.at(-1).note='x';},
  r=>{r.schemaVersion=4;},
  r=>{r.schemaVersion=6;},
 ];
 for(const[i,edit]of cases.entries()){
  const f=fixture(t);await install(f);
  const written=receipt(f);edit(written);fs.writeFileSync(receiptPath(f),JSON.stringify(written));
  await assert.rejects(inspectConfiguration(options(f)),{code:'INVALID_RECEIPT'},`case ${i}`);
 }
 const f=fixture(t,policy());await install(f);
 const v4=receipt(f);jsonEntry(v4).ops.push(windowOp);fs.writeFileSync(receiptPath(f),JSON.stringify(v4));
 await assert.rejects(inspectConfiguration(options(f)),{code:'INVALID_RECEIPT'},'v4 cannot own the key');
});

test('v5 is refused on any client other than Claude',async t=>{
 const f=fixture(t),policyValue={schemaVersion:1,maxConcurrent:3,clients:{chatgpt:{code:{model:'gpt-6.1-sol',effort:'high'},light:{model:'gpt-6-luna',effort:'high'},avoidModels:[]}}};
 setPolicy(f,policyValue);
 const chatgpt={client:'chatgpt',home:f.home,stateDir:f.stateDir,policyPath:f.policyPath,releaseVersion:'0.5.2'};
 await applyInstall(await planInstall(chatgpt));
 const file=path.join(f.stateDir,'installations/chatgpt.json'),written=readJson(file);
 written.schemaVersion=5;fs.writeFileSync(file,JSON.stringify(written));
 await assert.rejects(inspectConfiguration(chatgpt),{code:'INVALID_RECEIPT'});
});

test('setup reports a higher-priority control and does not block or change it',async t=>{
 const overriding=[
  [{modelSettings:{'claude-opus-5-5':{autoCompactWindow:300000}}},{}],
  [{env:{CLAUDE_CODE_AUTO_COMPACT_WINDOW:'300000'}},{}],
  [{env:{CLAUDE_CODE_AUTO_COMPACT_WINDOW:'300k'}},{}],
  [{env:{CLAUDE_CODE_AUTO_COMPACT_WINDOW:'200'}},{}],
  [{},{CLAUDE_CODE_AUTO_COMPACT_WINDOW:'300000'}],
 ];
 for(const[settings,env]of overriding){
  const f=fixture(t);putSettings(f,settings);
  const plan=await planInstall({...options(f),env});
  assert.ok(plan.warnings.includes('claude-auto-compact-overridden'),JSON.stringify([settings,env]));
  await applyInstall(plan);
  const saved=readJson(f.settings);
  assert.equal(saved.autoCompactWindow,WINDOW);
  if(settings.modelSettings)assert.deepEqual(saved.modelSettings,settings.modelSettings);
  if(settings.env)assert.equal(saved.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW,settings.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW);
  assert.ok((await inspectConfiguration(options(f))).warnings.includes('claude-auto-compact-overridden'));
  assert.doesNotMatch(fs.readFileSync(receiptPath(f),'utf8'),/300000|300k/,'no override value reaches the receipt');
 }
 for(const[settings,env]of [
  [{env:{CLAUDE_CODE_AUTO_COMPACT_WINDOW:'auto'}},{}],
  [{},{CLAUDE_CODE_AUTO_COMPACT_WINDOW:''}],
  [{modelSettings:{'claude-opus-5-5':{effort:'high'}}},{}],
  [{modelSettings:'bad'},{}],
 ]){
  const f=fixture(t);putSettings(f,settings);
  assert.ok(!(await planInstall({...options(f),env})).warnings.includes('claude-auto-compact-overridden'),JSON.stringify([settings,env]));
 }
 const f=fixture(t,policy());putSettings(f,{env:{CLAUDE_CODE_AUTO_COMPACT_WINDOW:'300000'}});
 assert.ok(!(await planInstall(options(f))).warnings.includes('claude-auto-compact-overridden'),'no option, no warning');
});

test('setup text explains the override',()=>{
 const text=formatResult('setup',{status:'configured',results:[{client:'claude',status:'configured',warnings:['claude-auto-compact-overridden']}]},{version:'1.2.3',apply:true});
 assert.match(text,/CLAUDE_CODE_AUTO_COMPACT_WINDOW or a per-model \/autocompact value outranks/);
});

test('show reports the configured value and each override',async t=>{
 const f=fixture(t);await install(f);
 const read=async(env={})=>(await readConfiguration({home:f.home,client:'claude',env,stateDir:f.stateDir,explicitHome:true})).clients.claude;
 let c=await read();
 assert.equal(c.autoCompactWindow,WINDOW);
 assert.equal(c.apk.status,'verified');
 assert.deepEqual([c.overrides.autoCompactWindowEnv,c.overrides.autoCompactWindowModels],[undefined,undefined]);
 const render=client=>formatResult('show',{schemaVersion:1,scope:'user',modelExecution:'not_checked',clients:{claude:client}},{version:'1.2.3'});
 assert.match(render(c),/Auto-compact window: 500000 \(native setting\)/);
 assert.doesNotMatch(render(c),/Override autoCompact/);
 const settings=readJson(f.settings);
 putSettings(f,{...settings,modelSettings:{a:{autoCompactWindow:300000},b:{autoCompactWindow:400000},c:{effort:'high'}}});
 c=await read();
 assert.equal(c.overrides.autoCompactWindowModels,2);
 assert.match(render(c),/Override autoCompactWindowModels: 2/);
 c=await read({CLAUDE_CODE_AUTO_COMPACT_WINDOW:'300k'});
 assert.equal(c.overrides.autoCompactWindowEnv,300000);
 assert.match(render(c),/Override autoCompactWindowEnv: 300000/);
 assert.equal((await read({CLAUDE_CODE_AUTO_COMPACT_WINDOW:'200'})).overrides.autoCompactWindowEnv,100000,'Claude Code clamps a small count');
 assert.equal((await read({CLAUDE_CODE_AUTO_COMPACT_WINDOW:'5M'})).overrides.autoCompactWindowEnv,1000000,'Claude Code clamps a large count');
 assert.equal((await read({CLAUDE_CODE_AUTO_COMPACT_WINDOW:'auto'})).overrides.autoCompactWindowEnv,undefined,'Claude Code ignores a value that is not a token count');
});

test('show reads a user-set key, ignores an unusable one and adds no override without a key',async t=>{
 const f=fixture(t,policy());
 const read=async(env={})=>(await readConfiguration({home:f.home,client:'claude',env,stateDir:f.stateDir,explicitHome:true})).clients.claude;
 putSettings(f,{autoCompactWindow:200000});
 let c=await read();
 assert.equal(c.status,'configured');assert.equal(c.autoCompactWindow,200000);
 putSettings(f,{autoCompactWindow:'huge'});
 c=await read();
 assert.equal(Object.hasOwn(c,'autoCompactWindow'),false);assert.notEqual(c.status,'attention');
 putSettings(f,{modelSettings:{a:{autoCompactWindow:300000}}});
 c=await read({CLAUDE_CODE_AUTO_COMPACT_WINDOW:'300000'});
 assert.equal(Object.keys(c.overrides).length,0);assert.equal(c.status,'not_configured');
});

function cliFixture(t){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'apk-auto-compact-cli-')));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const home=path.join(root,'home'),tools=path.join(root,'bin');fs.mkdirSync(home);fs.mkdirSync(tools);
 const fake=path.join(tools,'claude');fs.writeFileSync(fake,'#!/bin/sh\necho "2.1.316 (Claude Code)"\n');fs.chmodSync(fake,0o755);
 const env={HOME:home,USERPROFILE:home,TMPDIR:root,PATH:[tools,path.dirname(process.execPath),'/usr/bin','/bin'].join(path.delimiter)};
 return {root,home,env};
}
const cli=(f,args)=>spawnSync(process.execPath,[bin,...args],{env:f.env,encoding:'utf8',timeout:60000});

test('CLI applies, shows, verifies and removes the option in a temporary home',t=>{
 const f=cliFixture(t),args=['--roles','worker','--max-concurrent','3','--claude','worker=claude-opus-5-5:high'];
 const preview=cli(f,['setup',...args,'--claude-auto-compact','500k']);
 assert.equal(preview.status,0,preview.stdout);
 assert.equal(fs.existsSync(path.join(f.home,'.claude/settings.json')),false,'a preview writes nothing');
 const applied=cli(f,['setup',...args,'--claude-auto-compact','500k','--apply']);
 assert.equal(applied.status,0,applied.stdout);
 assert.equal(readJson(path.join(f.home,'.claude/settings.json')).autoCompactWindow,500000);
 const state=path.join(f.home,'.agent-policy-kit');
 assert.equal(readJson(path.join(state,'installations/claude.json')).schemaVersion,5);
 assert.equal(JSON.parse(cli(f,['doctor','--client','claude']).stdout).clients.claude.configuration.status,'verified');
 const shown=JSON.parse(cli(f,['show','--client','claude']).stdout).clients.claude;
 assert.equal(shown.autoCompactWindow,500000);
 const replaced=cli(f,['setup',...args,'--apply']);
 assert.equal(replaced.status,0,replaced.stdout);
 assert.equal(readJson(path.join(state,'installations/claude.json')).schemaVersion,4);
 assert.equal(Object.hasOwn(readJson(path.join(f.home,'.claude/settings.json')),'autoCompactWindow'),false);
 assert.equal(cli(f,['setup',...args,'--claude-auto-compact','1M','--apply']).status,0);
 assert.equal(cli(f,['uninstall','--apply']).status,0);
 assert.equal(fs.existsSync(path.join(f.home,'.claude/settings.json')),false);
});

test('CLI refuses a bad window and needs --claude, before any write',t=>{
 const f=cliFixture(t);
 for(const args of [['--roles','worker','--max-concurrent','3','--claude','worker=claude-opus-5-5:high','--claude-auto-compact','200'],['--roles','worker','--max-concurrent','3','--chatgpt','worker=gpt-6.1-sol:high','--claude-auto-compact','500k']]){
  const got=cli(f,['setup',...args,'--apply']);
  assert.equal(got.status,1);assert.equal(JSON.parse(got.stdout).error,'INVALID_EXPLICIT_CONFIG');
 }
 assert.deepEqual(fs.readdirSync(f.home),[]);
 assert.equal(JSON.parse(cli(f,['setup','--claude-auto-compact','500k']).stdout).error,'INVALID_EXPLICIT_CONFIG');
 assert.match(cli(f,['--help']).stdout,/--claude-auto-compact WINDOW/);
});
