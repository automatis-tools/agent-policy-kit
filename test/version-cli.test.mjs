import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const bin=fileURLToPath(new URL('../bin/agent-policy.mjs',import.meta.url));
function fixture(t){const home=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),"release cli's "));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));fs.mkdirSync(path.join(home,'tmp'));const native=path.join(home,'bin');fs.mkdirSync(native);for(const [name,v]of Object.entries({codex:'codex-cli 0.166.0',claude:'2.1.312 (Claude Code)'}))fs.writeFileSync(path.join(native,name),`#!${process.execPath}\nconsole.log(${JSON.stringify(v)});\n`,{mode:0o700});return {home,env:{PATH:native+path.delimiter+path.dirname(process.execPath),HOME:home,USERPROFILE:home,TMPDIR:path.join(home,'tmp'),AGENT_POLICY_HOME:path.join(home,'.policy'),CODEX_HOME:path.join(home,'.codex'),CLAUDE_CONFIG_DIR:path.join(home,'.claude'),KIMI_CODE_HOME:path.join(home,'.kimi-code')}};}
function cli(f,args){return spawnSync(process.execPath,[bin,...args],{env:f.env,encoding:'utf8'});}
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const config=()=>({schemaVersion:1,maxConcurrent:2,clients:{codex:{code:{model:'gpt-6.1-sol',effort:'high'},light:{model:'gpt-6-luna',effort:'high'},avoidModels:[],roles:{reviewer:{model:'review-model',effort:'medium'}}}}});
const expanded=()=>['--roles','reviewer,explorer','--max-concurrent','3','--codex','reviewer=gpt-6.1-sol:high,explorer=gpt-6-luna:low','--avoid-codex','gpt-6-astra'];

test('fully explicit tool options plan and apply exactly the displayed role models',t=>{
 const f=fixture(t),args=[...expanded(),'--claude','reviewer=provider:model@2026:native,explorer=haiku:high'];
 const plan=cli(f,['setup',...args]);assert.equal(plan.status,0,plan.stdout);assert.equal(JSON.parse(plan.stdout).status,'planned');assert.equal(fs.existsSync(path.join(f.home,'.policy')),false);assert.deepEqual(fs.readdirSync(path.join(f.home,'tmp')),[]);
 const got=cli(f,['setup',...args,'--apply']);assert.equal(got.status,0,got.stdout);const data=JSON.parse(got.stdout);
 for(const client of ['codex','claude']){const row=data.results.find(value=>value.client===client);assert.equal(row.appliedSource,'custom');assert.equal(row.appliedPreset,null);}
 assert.match(fs.readFileSync(path.join(f.home,'.codex/agents/apk-explorer.toml'),'utf8'),/model_reasoning_effort = "low"/);
 assert.match(fs.readFileSync(path.join(f.home,'.claude/agents/apk-reviewer.md'),'utf8'),/model: "provider:model@2026"/);assert.doesNotMatch(fs.readFileSync(path.join(f.home,'.claude/agents/apk-reviewer.md'),'utf8'),/^effort:/m);
 assert.equal(fs.existsSync(path.join(f.home,'.codex/agents/apk-worker.toml')),false);assert.equal(fs.existsSync(path.join(f.home,'.gemini')),false);
 assert.deepEqual(fs.readdirSync(path.join(f.home,'tmp')),[]);assert.equal(JSON.parse(cli(f,['doctor','--client','codex']).stdout).clients.codex.configuration.status,'verified');assert.equal(cli(f,['uninstall','--apply']).status,0);
});

test('explicit tool options reject incomplete inputs and cannot fall back to all clients',t=>{
 const f=fixture(t);
 for(const args of [['--roles','reviewer'],['--codex','reviewer=model:high'],['--roles','reviewer','--max-concurrent','3','--codex',''],[...expanded(),'--avoid-kimi','model'],['--roles','reviewer','--max-concurrent','3','--codex','balanced']]){
  const got=cli(f,['setup',...args,'--apply']);assert.equal(got.status,1);assert.equal(JSON.parse(got.stdout).error,'INVALID_EXPLICIT_CONFIG');
 }
 assert.equal(fs.existsSync(path.join(f.home,'.policy')),false);assert.equal(fs.existsSync(path.join(f.home,'.codex')),false);assert.deepEqual(fs.readdirSync(path.join(f.home,'tmp')),[]);
});

test('duplicate explicit flags and mixed input modes fail before any writes',t=>{
 const f=fixture(t);
 for(const args of [[...expanded(),'--codex','reviewer=other:high'],[...expanded(),'--roles','reviewer'],[...expanded(),'--max-concurrent','2']]){const got=cli(f,['setup',...args,'--apply']);assert.equal(got.status,1);assert.equal(JSON.parse(got.stdout).error,'DUPLICATE_OPTION');}
 for(const args of [[...expanded(),'--release'],[...expanded(),'--preset','fast'],[...expanded(),'--config',encode(config())],[...expanded(),'--policy','missing'],[...expanded(),'--client','codex']]){const got=cli(f,['setup',...args,'--apply']);assert.equal(got.status,1);assert.equal(JSON.parse(got.stdout).error,'CONFLICTING_OPTIONS');}
 for(const command of ['init','detect','doctor','uninstall','release','instructions']){const got=cli(f,[command,...expanded()]);assert.equal(got.status,1);assert.equal(JSON.parse(got.stdout).error,'CONFLICTING_OPTIONS');}
 assert.equal(fs.existsSync(path.join(f.home,'.policy')),false);assert.deepEqual(fs.readdirSync(path.join(f.home,'tmp')),[]);
});
test('release metadata and notes are available independently of configured state',t=>{
 const f=fixture(t);fs.mkdirSync(path.join(f.home,'.policy'));fs.writeFileSync(path.join(f.home,'.policy/policy.json'),'{broken');
 const got=cli(f,['release']);assert.equal(got.status,0);const data=JSON.parse(got.stdout);assert.equal(data.version,'0.1.0');assert.match(data.notes,/Why this release/);assert.match(data.preferencesHash,/^[a-f0-9]{64}$/);
});
test('release and custom preference sources are mutually exclusive before writes',t=>{
 const f=fixture(t);for(const args of [['--release','--policy','missing.json'],['--release','--config',encode(config())],['--config',encode(config()),'--policy','missing.json']]){
  const got=cli(f,['setup',...args,'--apply']);assert.equal(got.status,1);assert.equal(JSON.parse(got.stdout).error,'CONFLICTING_OPTIONS');
 }assert.equal(fs.existsSync(path.join(f.home,'.policy')),false);assert.deepEqual(fs.readdirSync(path.join(f.home,'tmp')),[]);
});
test('config input is bounded canonical base64url and validated before client changes',t=>{
 const f=fixture(t);for(const value of ['not-json','e30=',encode({bad:'PRIVATE_VALUE'}),'a'.repeat(90000)]){const got=cli(f,['setup','--config',value,'--apply']);assert.equal(got.status,1);assert.equal(JSON.parse(got.stdout).error,'INVALID_CONFIG');assert.ok(!got.stdout.includes('PRIVATE_VALUE'));}
 assert.equal(fs.existsSync(path.join(f.home,'.policy')),false);assert.deepEqual(fs.readdirSync(path.join(f.home,'tmp')),[]);
});
test('page payload configures selected tasks/tools, records custom provenance and cleans temporary input',t=>{
 const f=fixture(t);const got=cli(f,['setup','--config',encode(config()),'--apply']);assert.equal(got.status,0,got.stdout+got.stderr);const result=JSON.parse(got.stdout);
 assert.equal(result.results.find(r=>r.client==='codex').appliedSource,'custom');assert.equal(result.results.find(r=>r.client==='claude').status,'not_selected');
 assert.equal(fs.existsSync(path.join(f.home,'.claude')),false);assert.match(fs.readFileSync(path.join(f.home,'.codex/agents/apk-reviewer.toml'),'utf8'),/review-model/);assert.match(fs.readFileSync(path.join(f.home,'.codex/config.toml'),'utf8'),/max_concurrent_threads_per_session = 2/);
 assert.deepEqual(fs.readdirSync(path.join(f.home,'tmp')),[]);
 fs.writeFileSync(path.join(f.home,'.policy/policy.json'),'{broken');
 const report=JSON.parse(cli(f,['doctor','--client','codex']).stdout);assert.equal(report.clients.codex.configuration.status,'verified');assert.equal(report.clients.codex.configuration.releaseVersion,'0.1.0');assert.equal(report.clients.codex.configuration.source,'custom');
});
test('explicit bundled release replaces custom choices without a physical uninstall gap',t=>{
 const f=fixture(t);assert.equal(cli(f,['setup','--config',encode(config()),'--apply']).status,0);
 const plan=cli(f,['setup','--release','--client','codex']);assert.equal(plan.status,0,plan.stdout);assert.match(fs.readFileSync(path.join(f.home,'.codex/agents/apk-reviewer.toml'),'utf8'),/review-model/);
 const apply=cli(f,['setup','--release','--client','codex','--apply']);assert.equal(apply.status,0,apply.stdout);const metadata=JSON.parse(apply.stdout).results[0];assert.equal(metadata.previousSource,'custom');assert.equal(metadata.appliedSource,'release');assert.equal(metadata.appliedReleaseVersion,'0.1.0');
 assert.doesNotMatch(fs.readFileSync(path.join(f.home,'.codex/agents/apk-reviewer.toml'),'utf8'),/review-model/);
});

test('named release presets apply and report their saved identity',t=>{
 const f=fixture(t);const metadata=JSON.parse(cli(f,['release','--preset','fast']).stdout);assert.equal(metadata.preset,'fast');
 const applied=cli(f,['setup','--release','--preset','fast','--client','codex','--apply']);assert.equal(applied.status,0,applied.stdout);
 assert.equal(JSON.parse(applied.stdout).results[0].appliedPreset,'fast');assert.match(fs.readFileSync(path.join(f.home,'.codex/agents/apk-worker.toml'),'utf8'),/gpt-6-luna/);
 const report=JSON.parse(cli(f,['doctor','--client','codex']).stdout);assert.equal(report.clients.codex.configuration.preset,'fast');
 assert.equal(cli(f,['setup','--preset','unknown','--apply']).status,1);
 const conflict=cli(f,['setup','--preset','fast','--config',encode(config()),'--apply']);assert.equal(conflict.status,1);assert.equal(JSON.parse(conflict.stdout).error,'CONFLICTING_OPTIONS');
});
test('empty explicit selectors cannot fall back to changing all clients',t=>{
 const f=fixture(t);assert.equal(cli(f,['setup','--release','--client','codex','--apply']).status,0);
 const receipt=path.join(f.home,'.policy/installations/codex.json'),before=fs.readFileSync(receipt,'utf8');
 const got=cli(f,['uninstall','--client','','--apply']);assert.equal(got.status,1);assert.equal(JSON.parse(got.stdout).error,'UNSUPPORTED_CLIENT');assert.equal(fs.readFileSync(receipt,'utf8'),before);
 assert.equal(JSON.parse(cli(f,['setup','--preset','','--apply']).stdout).error,'UNKNOWN_PRESET');
});

test('Google dated Claude payload writes quoted native model strings and verifies without inference',t=>{
 const f=fixture(t),model='claude-sonnet-4-5@20250929',payload={schemaVersion:1,maxConcurrent:2,clients:{claude:{code:{model,effort:null},light:{model:'haiku',effort:null},roles:{reviewer:{model:'fable',effort:'high'}},avoidModels:[]}}};const got=cli(f,['setup','--config',encode(payload),'--apply']);assert.equal(got.status,0,got.stdout+got.stderr);const body=fs.readFileSync(path.join(f.home,'.claude/agents/apk-worker.md'),'utf8');assert.equal(JSON.parse(body.match(/^model: (.+)$/m)[1]),model);assert.doesNotMatch(body,/^effort:/m);assert.equal(JSON.parse(fs.readFileSync(path.join(f.home,'.claude/settings.json'))).env.CLAUDE_CODE_SUBAGENT_MODEL,model);const review=fs.readFileSync(path.join(f.home,'.claude/agents/apk-reviewer.md'),'utf8');assert.equal(JSON.parse(review.match(/^model: (.+)$/m)[1]),'fable');assert.equal(JSON.parse(cli(f,['doctor','--client','claude']).stdout).clients.claude.configuration.status,'verified');assert.deepEqual(fs.readdirSync(path.join(f.home,'tmp')),[]);assert.equal(fs.existsSync(path.join(f.home,'.codex')),false);
});
