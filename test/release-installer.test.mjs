import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import * as installer from '../src/install.mjs';
import {setupDetected} from '../src/setup.mjs';
const {planInstall,applyInstall,uninstall}=installer;
const hash=value=>createHash('sha256').update(value).digest('hex');
const run=promisify(execFile);
async function put(file,text){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,text);}
async function fixture(t,client='codex'){
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'release-installer-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));const home=path.join(root,'home');await fs.mkdir(home);const policyPath=path.join(root,'requested.json');await fs.copyFile(new URL('../policies/balanced.json',import.meta.url),policyPath);return{root,home,client,stateDir:path.join(home,'.policy'),policyPath,releaseVersion:'1.0.0',source:'release'};
}
const config=f=>path.join(f.home,f.client==='claude'?'.claude/settings.json':'.codex/config.toml');
const receipt=f=>path.join(f.stateDir,'installations',f.client+'.json');
async function preferences(f,model){const value=JSON.parse(await fs.readFile(f.policyPath));value.clients[f.client].code.model=model;value.clients[f.client].avoidModels=[];await fs.writeFile(f.policyPath,JSON.stringify(value));}
async function emulateOldTemplate(f){
 const target=receipt(f),record=JSON.parse(await fs.readFile(target));const role=record.files.find(file=>file.type==='role');const body=(await fs.readFile(role.path,'utf8'))+'# Older release template\n';await fs.writeFile(role.path,body);role.afterHash=hash(body);const instructions=record.files.find(file=>file.type==='instructions');const oldBlock=instructions.block;instructions.block=oldBlock.replace('When delegating,','Old release delegation:');await fs.writeFile(instructions.path,(await fs.readFile(instructions.path,'utf8')).replace(oldBlock,instructions.block));record.warnings=['older-release-warning'];await fs.writeFile(target,JSON.stringify(record));return record;
}

test('release ownership survives template/warning changes without canonical policy or current compiler proof',async t=>{
 const f=await fixture(t);await applyInstall(await planInstall(f));await emulateOldTemplate(f);await fs.rm(path.join(f.stateDir,'policy.json'));await fs.rm(f.policyPath);assert.equal(typeof installer.inspectConfiguration,'function');assert.deepEqual(await installer.inspectConfiguration(f),{status:'verified',releaseVersion:'1.0.0',source:'release',warnings:['older-release-warning']});await uninstall({...f,apply:true});assert.deepEqual(await installer.inspectConfiguration(f),{status:'not_configured',releaseVersion:null,source:null,warnings:[]});
});

test('upgrade and downgrade virtually restore original user baseline and preserve unrelated later edits',async t=>{
 for(const client of ['codex','claude']){
  const f=await fixture(t,client),original=client==='codex'?'model = "main"\n[agents]\nmax_concurrent_threads_per_session = 11\ndefault_subagent_model = "user-original"\n':JSON.stringify({model:'main',env:{CLAUDE_CODE_SUBAGENT_MODEL:'user-original',CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS:'11'},user:true});await put(config(f),original);await applyInstall(await planInstall(f));await emulateOldTemplate(f);
  if(client==='codex')await fs.appendFile(config(f),'\n[user]\nlater = true\n');else{const native=JSON.parse(await fs.readFile(config(f)));native.later=true;await fs.writeFile(config(f),JSON.stringify(native));}
  await preferences(f,client==='codex'?'gpt-next':'sonnet-next');const upgrade=await planInstall({...f,releaseVersion:'2.0.0',replace:true});assert.equal(upgrade.status,'planned');assert.equal(upgrade.previousReleaseVersion,'1.0.0');assert.equal(upgrade.targetReleaseVersion,'2.0.0');assert.equal(upgrade.changes.length,new Set(upgrade.changes.map(c=>c.path)).size);const applied=await applyInstall(upgrade);assert.equal(applied.appliedReleaseVersion,'2.0.0');assert.equal((await installer.inspectConfiguration(f)).releaseVersion,'2.0.0');
  await fs.copyFile(new URL('../policies/balanced.json',import.meta.url),f.policyPath);const downgraded=await applyInstall(await planInstall({...f,replace:true}));assert.equal(downgraded.appliedReleaseVersion,'1.0.0');await uninstall({...f,apply:true});const restored=await fs.readFile(config(f),'utf8');if(client==='codex'){assert.match(restored,/user-original/);assert.match(restored,/max_concurrent_threads_per_session = 11/);assert.match(restored,/later = true/);assert.match(restored,/model = "main"/);}else assert.deepEqual(JSON.parse(restored),{...JSON.parse(original),later:true});
 }
});

test('default no-op keeps actual release label while explicit replacement records selected compiler release',async t=>{
 const f=await fixture(t);await applyInstall(await planInstall(f));const normal=await planInstall({...f,releaseVersion:'2.0.0',source:'saved'});assert.equal(normal.status,'unchanged');assert.equal(normal.appliedReleaseVersion,'1.0.0');assert.equal(normal.appliedSource,'release');await applyInstall(normal);assert.equal((await installer.inspectConfiguration(f)).releaseVersion,'1.0.0');await applyInstall(await planInstall({...f,releaseVersion:'2.0.0',replace:true}));assert.equal((await installer.inspectConfiguration(f)).releaseVersion,'2.0.0');
});

test('mixed clients retain actual release truth independently of the latest canonical request',async t=>{
 const f=await fixture(t);await applyInstall(await planInstall(f));await applyInstall(await planInstall({...f,client:'claude'}));await preferences(f,'gpt-next');await applyInstall(await planInstall({...f,releaseVersion:'2.0.0',replace:true}));assert.equal((await installer.inspectConfiguration(f)).releaseVersion,'2.0.0');assert.equal((await installer.inspectConfiguration({...f,client:'claude'})).releaseVersion,'1.0.0');await uninstall({...f,client:'claude',apply:true});
});

test('failed replacement rolls back to the old installed release without an uninstall gap',async t=>{
 const f=await fixture(t);await applyInstall(await planInstall(f));const oldReceipt=await fs.readFile(receipt(f),'utf8'),oldConfig=await fs.readFile(config(f),'utf8');await preferences(f,'gpt-next');const entry=path.join(f.root,'transaction.mjs'),preload=path.join(f.root,'fault.mjs');await put(preload,`import fs from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';const rename=fs.rename;let failed=false;fs.rename=async(from,to)=>{if(to===${JSON.stringify(receipt(f))}&&!failed){failed=true;throw Object.assign(new Error('late EIO'),{code:'EIO'});}return rename(from,to);};syncBuiltinESMExports();`);await put(entry,`import{planInstall,applyInstall}from ${JSON.stringify(new URL('../src/install.mjs',import.meta.url).href)};try{await applyInstall(await planInstall(${JSON.stringify({...f,releaseVersion:'2.0.0',replace:true})}));console.log('WRONG');}catch(e){console.log(e.code);}`);assert.equal((await run(process.execPath,['--import',preload,entry])).stdout.trim(),'INSTALL_FAILED');assert.equal(await fs.readFile(receipt(f),'utf8'),oldReceipt);assert.equal(await fs.readFile(config(f),'utf8'),oldConfig);assert.equal((await installer.inspectConfiguration(f)).releaseVersion,'1.0.0');
});

test('replacement prerequisites and owned drift preserve the prior release with zero writes',async t=>{
 const f=await fixture(t,'claude');await applyInstall(await planInstall(f));const oldReceipt=await fs.readFile(receipt(f),'utf8');const native=JSON.parse(await fs.readFile(config(f)));native.env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE='1';await fs.writeFile(config(f),JSON.stringify(native));await preferences(f,'sonnet-next');const prerequisite=await planInstall({...f,releaseVersion:'2.0.0',replace:true});assert.equal(prerequisite.status,'prerequisite');assert.equal(prerequisite.changes.length,0);assert.equal(prerequisite.appliedReleaseVersion,'1.0.0');assert.equal(await fs.readFile(receipt(f),'utf8'),oldReceipt);native.env.CLAUDE_CODE_SUBAGENT_MODEL='competing-user-model';await fs.writeFile(config(f),JSON.stringify(native));await assert.rejects(planInstall({...f,replace:true}),{code:'OWNED_DRIFT'});assert.equal(await fs.readFile(receipt(f),'utf8'),oldReceipt);
});

test('native v2 snapshots remain inspectable with unknown provenance; unknown layout refuses writes',async t=>{
 const f=await fixture(t);await applyInstall(await planInstall(f));const record=await emulateOldTemplate(f);record.schemaVersion=2;delete record.releaseVersion;delete record.source;record.maxConcurrent=3;record.preferences={oldSchema:'not-current-preferences'};await fs.writeFile(receipt(f),JSON.stringify(record));assert.deepEqual(await installer.inspectConfiguration(f),{status:'verified',releaseVersion:null,source:'unknown',warnings:['older-release-warning']});await applyInstall(await planInstall({...f,replace:true,releaseVersion:'2.0.0'}));assert.equal((await installer.inspectConfiguration(f)).releaseVersion,'2.0.0');const invalid=JSON.parse(await fs.readFile(receipt(f)));invalid.files.find(file=>file.type==='toml').ops[0].path=['model'];await fs.writeFile(receipt(f),JSON.stringify(invalid));await assert.rejects(planInstall({...f,replace:true}),{code:'INVALID_RECEIPT'});await assert.rejects(uninstall({...f,apply:true}),{code:'INVALID_RECEIPT'});
});

test('setup forwards release replacement metadata and keeps independent failures visible',async t=>{
 const f=await fixture(t),bin=path.join(f.root,'bin');await fs.mkdir(bin);for(const[client,version]of [['codex','codex-cli 0.165.0'],['claude','2.1.312 (Claude Code)']])await put(path.join(bin,client),`#!${process.execPath}\nconsole.log(${JSON.stringify(version)});`);for(const client of ['codex','claude'])await fs.chmod(path.join(bin,client),0o700);const options={...f,client:null,env:{PATH:bin},hostHome:f.home,apply:true};await setupDetected(options);await preferences(f,'gpt-next');const settings=path.join(f.home,'.claude/settings.json'),native=JSON.parse(await fs.readFile(settings));native.env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE='1';await fs.writeFile(settings,JSON.stringify(native));const result=await setupDetected({...options,replace:true,releaseVersion:'2.0.0'});assert.equal(result.status,'partial');assert.equal(result.results.find(r=>r.client==='codex').appliedReleaseVersion,'2.0.0');assert.equal(result.results.find(r=>r.client==='claude').status,'prerequisite');assert.equal((await installer.inspectConfiguration({...f,client:'claude'})).releaseVersion,'1.0.0');
});

test('missing detected binaries retain applied release metadata during a partial release request',async t=>{
 const f=await fixture(t),bin=path.join(f.root,'bin');await fs.mkdir(bin);for(const[client,version]of [['codex','codex-cli 0.165.0'],['claude','2.1.312 (Claude Code)']]){await put(path.join(bin,client),`#!${process.execPath}\nconsole.log(${JSON.stringify(version)});`);await fs.chmod(path.join(bin,client),0o700);}const options={...f,client:null,env:{PATH:bin},hostHome:f.home,apply:true};await setupDetected(options);await fs.rm(path.join(bin,'claude'));await preferences(f,'gpt-next');const result=await setupDetected({...options,replace:true,releaseVersion:'2.0.0'}),missing=result.results.find(r=>r.client==='claude');assert.equal(missing.status,'not_found');assert.equal(missing.targetReleaseVersion,'2.0.0');assert.equal(missing.appliedReleaseVersion,'1.0.0');assert.equal(missing.appliedSource,'release');assert.equal((await installer.inspectConfiguration({...f,client:'claude'})).releaseVersion,'1.0.0');
});

test('release replacement preserves original instructions and later outside-block edits through final removal',async t=>{
 const f=await fixture(t),target=path.join(f.home,'.codex/AGENTS.md');await put(target,'Original user instructions.');await applyInstall(await planInstall(f));await fs.writeFile(target,'Later prefix\n'+await fs.readFile(target,'utf8')+'Later suffix\n');await preferences(f,'gpt-next');await applyInstall(await planInstall({...f,replace:true,releaseVersion:'2.0.0'}));await uninstall({...f,apply:true});assert.equal(await fs.readFile(target,'utf8'),'Later prefix\nOriginal user instructions.Later suffix\n');
});

test('malformed snapshot types, paths, versions and scalar values reject inspection and replacement',async t=>{
 for(const mutate of [r=>{r.schemaVersion=9;},r=>{r.files[0].ops[0].after='3\nmodel="injected"';},r=>{r.files[0].ops[0].path=['permissions','sandbox'];},r=>{r.files[0].ops[0].addedTable=['other'];},r=>{r.files.find(file=>file.type==='role').afterHash=['a'.repeat(64)];},r=>{r.files.find(file=>file.type==='instructions').block='unbounded unmarked text';},r=>{r.releaseVersion='../unsafe';},r=>{r.source='invented';}]){
  const f=await fixture(t);await applyInstall(await planInstall(f));const target=receipt(f),record=JSON.parse(await fs.readFile(target));mutate(record);await fs.writeFile(target,JSON.stringify(record));const native=await fs.readFile(config(f),'utf8');await assert.rejects(installer.inspectConfiguration(f),{code:'INVALID_RECEIPT'});await assert.rejects(planInstall({...f,replace:true}),{code:'INVALID_RECEIPT'});assert.equal(await fs.readFile(config(f),'utf8'),native);
 }
});
