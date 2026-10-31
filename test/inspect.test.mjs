import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {readConfiguration} from '../src/inspect.mjs';
async function fixture(t){const home=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'apk-inspect-'));t.after(()=>fs.rm(home,{recursive:true,force:true}));return home;}
async function put(home,file,text){const target=path.join(home,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,text);}
const read=(home,client,extra={})=>readConfiguration({home,client,env:{},...extra});
test('Codex native settings and custom roles are readable without APK or executables',async t=>{
 const home=await fixture(t);await put(home,'.codex/config.toml','model="main-private"\n[agents]\nmax_threads=7\ndefault_subagent_model="custom/code"\ndefault_subagent_reasoning_effort="high"\nenabled=false\n[credentials]\napi_key="PRIVATE_SENTINEL"\n');
 await put(home,'.codex/agents/reviewer.toml','name="reviewer"\nmodel="custom/review"\ndeveloper_instructions="PRIVATE_PROMPT"\n');
 const report=await read(home,'codex'),c=report.clients.codex;assert.equal(c.defaults.model,'custom/code');assert.equal(c.defaults.effort,'high');assert.equal(c.defaults.enabled,false);assert.equal(c.concurrency.value,7);assert.equal(c.roles[0].name,'reviewer');assert.equal(c.roles[0].model,'custom/review');assert.equal(c.roles[0].effort,null);assert.equal(c.apk.status,'not_configured');assert.equal(report.scope,'user');assert.doesNotMatch(JSON.stringify(report),/PRIVATE_|main-private|api_key/);await assert.rejects(fs.stat(path.join(home,'.agent-policy-kit')),{code:'ENOENT'});
});
test('Claude reads simple frontmatter while ignoring hooks, prompts and main settings',async t=>{
 const home=await fixture(t);await put(home,'.claude/settings.json',JSON.stringify({model:'main-private',env:{CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS:'5',CLAUDE_CODE_SUBAGENT_MODEL:'sonnet',CLAUDE_CODE_EFFORT_LEVEL:'high',USER_TOKEN:'PRIVATE_SENTINEL'},hooks:{}}));
 await put(home,'.claude/agents/custom.md',"---\r\nname: 'reviewer'\r\nmodel: sonnet # comment\r\neffort: high\r\ntools: [Read, Grep]\r\ndescription: |\r\n  PRIVATE_DESCRIPTION\r\n---\r\nPRIVATE_PROMPT");
 const c=(await read(home,'claude')).clients.claude;assert.equal(c.concurrency.value,5);assert.equal(c.defaults.model,'sonnet');assert.equal(c.overrides.effort,'high');assert.equal(c.roles[0].model,'sonnet');assert.equal(c.roles[0].effort,'high');assert.doesNotMatch(JSON.stringify(c),/PRIVATE_|main-private|hooks/);
});
test('Kimi shows the real native pool effort precedence and APK role routing guidance',async t=>{
 const home=await fixture(t);await put(home,'.kimi-code/config.toml','[secondary_model]\ndefault_model="existing/alias"\ndefault_effort="high"\n[secondary_model.models]\n"existing/alias"="PRIVATE_HINT"\n[models."existing/alias"]\ndefault_effort="low"\n[models."existing/alias".overrides]\ndefault_effort="max"\n');
 await put(home,'.kimi-code/agents/apk-reviewer.md','---\nname: apk-reviewer\n---\nThe parent must select configured pool alias existing/alias for this role; Markdown frontmatter does not select a model. Requested effort: native default.\n');
 await put(home,'.kimi-code/AGENTS.md','When delegating, run at most 4 subagents concurrently in this session.');
 const c=(await read(home,'kimi')).clients.kimi;assert.equal(c.defaults.model,'existing/alias');assert.equal(c.pool[0].effort,'high');assert.equal(c.roles[0].model,'existing/alias');assert.equal(c.roles[0].modelSelection,'guidance');assert.equal(c.concurrency.value,null);assert.equal(c.concurrency.kind,'guidance');assert.doesNotMatch(JSON.stringify(c),/PRIVATE_HINT/);
});
test('Antigravity tiers and omitted effort remain distinct from provider model claims',async t=>{
 const home=await fixture(t);await put(home,'.gemini/config/agents/review.md','---\nname: reviewer\nmodel: flash\nsubagent: true\n---\nPRIVATE_PROMPT');
 const c=(await read(home,'agy')).clients.agy;assert.equal(c.roles[0].model,'flash');assert.equal(c.roles[0].effort,null);assert.equal(c.concurrency.kind,'guidance');
});
test('manual edits are read from current files and never replaced by requested APK preferences',async t=>{
 const home=await fixture(t);await put(home,'.agent-policy-kit/policy.json','{"clients":{"codex":{"code":{"model":"stale"}}}}');
 await put(home,'.codex/agents/apk-worker.toml','name="apk-worker"\nmodel="manual/current"\nmodel_reasoning_effort="low"\n');
 const c=(await read(home,'codex')).clients.codex;assert.equal(c.roles[0].model,'manual/current');assert.equal(c.roles[0].effort,'low');
});
test('active native-home overrides are read, while explicit --home selects its own standard layout',async t=>{
 const home=await fixture(t),active=path.join(home,'active');await put(home,'active/config.toml','[agents]\ndefault_subagent_model="active/model"\n');await put(home,'.codex/config.toml','[agents]\ndefault_subagent_model="standard/model"\n');
 assert.equal((await read(home,'codex',{env:{CODEX_HOME:active}})).clients.codex.defaults.model,'active/model');assert.equal((await read(home,'codex',{env:{CODEX_HOME:active},explicitHome:true})).clients.codex.defaults.model,'standard/model');
});
test('a bad client cannot hide independent results or leak raw errors',async t=>{
 const home=await fixture(t);await put(home,'.claude/settings.json','{ PRIVATE_BAD_JSON');await put(home,'.codex/agents/good.toml','name="good"\nmodel="safe/model"\n');
 const result=await read(home,null);assert.equal(result.clients.claude.status,'attention');assert.equal(result.clients.codex.roles[0].model,'safe/model');assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|apk-inspect-|SyntaxError/);
});
test('symlink profiles and role files are refused without exposing their targets',async t=>{
 const home=await fixture(t);await put(home,'outside/secret.toml','name="secret"\nmodel="PRIVATE_SENTINEL"\n');await fs.mkdir(path.join(home,'.codex/agents'),{recursive:true});await fs.symlink(path.join(home,'outside/secret.toml'),path.join(home,'.codex/agents/link.toml'));
 const result=await read(home,'codex');assert.equal(result.clients.codex.status,'attention');assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|outside|apk-inspect-/);
 await fs.symlink(path.join(home,'outside'),path.join(home,'.claude'));assert.equal((await read(home,'claude')).clients.claude.status,'attention');
});
test('oversized files and unsupported selected frontmatter are bounded, explicit and read-only',async t=>{
 const home=await fixture(t);await put(home,'.codex/config.toml','x'.repeat(1024*1024+1));await put(home,'.claude/agents/custom.md','---\nname: custom\nmodel: *privateAlias\n---\n');
 const result=await read(home,null);assert.equal(result.clients.codex.status,'attention');assert.equal(result.clients.claude.status,'attention');assert.doesNotMatch(JSON.stringify(result),/privateAlias/);await assert.rejects(fs.stat(path.join(home,'.agent-policy-kit')),{code:'ENOENT'});
});
test('conflicting native caps are reported rather than silently choosing one',async t=>{
 const home=await fixture(t);await put(home,'.codex/config.toml','[agents]\nmax_threads=4\nmax_concurrent_threads_per_session=5\n');const c=(await read(home,'codex')).clients.codex;assert.equal(c.status,'attention');assert.equal(c.concurrency.value,null);
});
test('APK instruction caps are displayed as guidance rather than native hard caps',async t=>{
 const home=await fixture(t);await put(home,'.gemini/AGENTS.md','<!-- BEGIN agent-policy-kit -->\nWhen delegating, run at most 6 subagents concurrently in this session. Give each agent one concrete result and explicit file ownership.\n<!-- END agent-policy-kit -->\n');const c=(await read(home,'agy')).clients.agy;assert.equal(c.concurrency.value,6);assert.equal(c.concurrency.kind,'guidance');
});
test('unsupported YAML merge keys and quoted configuration keys cannot silently become inherited defaults',async t=>{
 const home=await fixture(t);await put(home,'.claude/agents/merged.md','---\nname: merged\n<<: *defaults\n---\n');await put(home,'.claude/agents/quoted.md','---\nname: quoted\n"model": sonnet\n---\n');const c=(await read(home,'claude')).clients.claude;assert.equal(c.status,'attention');assert.equal(c.roles.length,0);
});
test('large role directories stop at the inspection budget',async t=>{
 const home=await fixture(t);await fs.mkdir(path.join(home,'.codex/agents'),{recursive:true});await Promise.all(Array.from({length:257},(_,i)=>put(home,`.codex/agents/role-${i}.toml`,`name="role-${i}"\nmodel="safe/model"\n`)));const c=(await read(home,'codex')).clients.codex;assert.equal(c.status,'attention');assert.ok(c.warnings.includes('INSPECTION_LIMIT'));
});
test('valid spaces before YAML colons preserve explicit model and effort values',async t=>{
 const home=await fixture(t);await put(home,'.claude/agents/spaced.md','---\nname: spaced\ndescription: Review code\nmodel : sonnet\neffort : high\n---\n');const c=(await read(home,'claude')).clients.claude;assert.equal(c.roles[0].model,'sonnet');assert.equal(c.roles[0].effort,'high');
});
test('Antigravity does not report unsupported effort as a native pin',async t=>{
 const home=await fixture(t);await put(home,'.gemini/config/agents/custom.md','---\nname: custom\ndescription: Review code\nmodel: pro\nsubagent: true\neffort: high\n---\n');const c=(await read(home,'agy')).clients.agy;assert.equal(c.status,'attention');assert.equal(c.roles[0].effort,null);assert.ok(c.warnings.includes('UNSUPPORTED_ROLE_EFFORT'));
});
test('Antigravity delegation-disabled roles retain their disabled state',async t=>{
 const home=await fixture(t);await put(home,'.gemini/config/agents/primary.md','---\nname: primary-only\ndescription: Primary agent\nmodel: pro\nsubagent: false\n---\n');const c=(await read(home,'agy')).clients.agy;assert.equal(c.roles[0].enabled,false);
});
