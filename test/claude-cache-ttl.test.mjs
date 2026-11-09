import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validatePolicy} from '../src/policy.mjs';
import {nativeRoles} from '../src/native.mjs';
import {parseExplicitOptions,explicitOptions,formatExplicitCommand} from '../src/explicit.mjs';
import {planInstall,applyInstall,uninstall,inspectConfiguration} from '../src/install.mjs';
import {readConfiguration} from '../src/inspect.mjs';
import {formatResult} from '../src/output.mjs';
import {ROLE_IDS,ROLE_DEFINITIONS} from '../src/roles.mjs';

const choice={model:'claude-opus-5-5',effort:'high'},light={model:'claude-haiku-5-5',effort:null};
const roleCatalog=ROLE_DEFINITIONS.map(role=>({id:role.id,kind:role.kind}));
const claude=(worker={})=>({code:choice,light,roles:{worker:{...choice,...worker}},avoidModels:[]});
const policy=(worker={},extra={})=>({schemaVersion:1,maxConcurrent:3,clients:{claude:claude(worker)},...extra});
const LONG={cacheTtl:'1h'};
const cacheLines=/^experimental:\n {2}cacheTtl: 1h\n/m;
const explicit=(extra={})=>({roles:'worker,reviewer','max-concurrent':'3',claude:'worker=claude-opus-5-5:high,reviewer=claude-sonnet-5-5:high',...extra});

async function fixture(t,value=policy(LONG)) {
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'apk-cache-ttl-')));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const home=path.join(root,'home');await fs.mkdir(home);
 const policyPath=path.join(root,'input.json');await fs.writeFile(policyPath,JSON.stringify(value));
 return {root,client:'claude',home,stateDir:path.join(home,'.local/state/agent-policy'),policyPath,packageRoot:path.resolve('.'),nodePath:process.execPath};
}
const settingsPath=f=>path.join(f.home,'.claude/settings.json');
const rolePath=(f,role)=>path.join(f.home,'.claude/agents',`apk-${role}.md`);
async function put(file,text) {await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,text);}
const exists=file=>fs.access(file).then(()=>true,()=>false);

test('preferences accept the one-hour cache only on the Claude Coder role',()=>{
 assert.equal(validatePolicy(policy(LONG)).clients.claude.roles.worker.cacheTtl,'1h');
 assert.equal(validatePolicy(policy()).clients.claude.roles.worker.cacheTtl,undefined);
 for(const invalid of [
  policy({cacheTtl:'5m'}),
  policy({cacheTtl:1}),
  policy({cacheTtl:null}),
  {...policy(),clients:{claude:{...claude(),roles:{reviewer:{...choice,...LONG}}}}},
  {...policy(),clients:{claude:{...claude(),code:{...choice,...LONG}}}},
  {...policy(),clients:{claude:{...claude(),light:{...light,...LONG}}}},
  {...policy(),clients:{chatgpt:{code:{model:'gpt-6.1-sol',effort:'high'},light:{model:'gpt-6-luna',effort:'high'},roles:{worker:{model:'gpt-6.1-sol',effort:'high',...LONG}},avoidModels:[]}}},
  policy(LONG,{selectedRoles:['reviewer']}),
 ])assert.throws(()=>validatePolicy(invalid),{code:'INVALID_POLICY'});
});

test('only the Coder role file carries the native cache field',()=>{
 const roles=['worker','reviewer','tester'];
 const withCache=nativeRoles('claude',validatePolicy(policy(LONG)).clients.claude,roles),without=nativeRoles('claude',validatePolicy(policy()).clients.claude,roles);
 assert.match(withCache[0],cacheLines);
 assert.doesNotMatch(without[0],/cacheTtl|experimental/);
 assert.equal(withCache[1],without[1]);assert.equal(withCache[2],without[2]);
 assert.equal(withCache[0].replace(cacheLines,''),without[0],'the option adds only the two frontmatter lines');
});

test('the explicit command contract carries the cache option and round-trips it',()=>{
 const parsed=parseExplicitOptions(explicit({'claude-cache-ttl':'worker=1h'}),ROLE_IDS);
 assert.equal(validatePolicy(parsed).clients.claude.roles.worker.cacheTtl,'1h');
 assert.equal(parsed.clients.claude.roles.reviewer.cacheTtl,undefined);
 assert.equal(parsed.clients.claude.code.cacheTtl,undefined,'the shared fallback stays free of the role option');
 assert.equal(parsed.clients.claude.light.cacheTtl,undefined);
 const options=explicitOptions(parsed,roleCatalog);
 assert.equal(options['claude-cache-ttl'],'worker=1h');
 assert.deepEqual(parseExplicitOptions(options,ROLE_IDS),parsed);
 assert.match(formatExplicitCommand(parsed,'1.2.3',roleCatalog),/--claude-cache-ttl 'worker=1h'/);
 assert.equal(explicitOptions(parseExplicitOptions(explicit(),ROLE_IDS),roleCatalog)['claude-cache-ttl'],undefined);
});

test('the explicit cache option refuses anything but the Claude Coder at one hour',()=>{
 const reject=options=>assert.throws(()=>parseExplicitOptions(options,ROLE_IDS),{code:'INVALID_EXPLICIT_CONFIG'});
 for(const value of ['worker=5m','reviewer=1h','worker','1h','worker=1h,reviewer=1h',''])reject(explicit({'claude-cache-ttl':value}));
 reject({roles:'reviewer','max-concurrent':'3',claude:'reviewer=claude-sonnet-5-5:high','claude-cache-ttl':'worker=1h'});
 reject({roles:'worker','max-concurrent':'3',chatgpt:'worker=gpt-6.1-sol:high','claude-cache-ttl':'worker=1h'});
});

test('setup writes the role field without touching settings.json ownership and uninstall removes it',async t=>{
 const f=await fixture(t),original=JSON.stringify({model:'main',promptCacheTtl:'5m',env:{KEEP:'1'}});
 await put(settingsPath(f),original);
 const plan=await planInstall(f);
 assert.ok(plan.warnings.includes('claude-role-cache-ttl-experimental'));
 assert.ok(!plan.warnings.includes('claude-role-cache-ttl-overridden'));
 await applyInstall(plan);
 assert.match(await fs.readFile(rolePath(f,'worker'),'utf8'),cacheLines);
 assert.doesNotMatch(await fs.readFile(rolePath(f,'reviewer'),'utf8'),/cacheTtl/);
 const settings=JSON.parse(await fs.readFile(settingsPath(f)));
 assert.equal(settings.subagentPromptCacheTtl,undefined);assert.equal(settings.env.CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL,undefined);assert.equal(settings.promptCacheTtl,'5m');
 const receipt=JSON.parse(await fs.readFile(path.join(f.stateDir,'installations/claude.json')));
 assert.equal(receipt.schemaVersion,4);
 assert.deepEqual(receipt.files.find(file=>file.type==='json').ops.map(op=>op.path),[['env','CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS'],['env','CLAUDE_CODE_SUBAGENT_MODEL'],['env','CLAUDE_CODE_SUBAGENT_EFFORT']]);
 assert.equal((await inspectConfiguration(f)).status,'verified');
 await uninstall({...f,apply:true});
 assert.equal(await exists(rolePath(f,'worker')),false);
 assert.deepEqual(JSON.parse(await fs.readFile(settingsPath(f))),JSON.parse(original));
});

test('setup without the option stays free of the cache warning and field',async t=>{
 const f=await fixture(t,policy());
 const plan=await planInstall(f);
 assert.ok(!plan.warnings.some(warning=>warning.startsWith('claude-role-cache-ttl')));
 await applyInstall(plan);
 assert.doesNotMatch(await fs.readFile(rolePath(f,'worker'),'utf8'),/cacheTtl|experimental/);
});

test('setup warns when a higher-priority native control outranks the role file',async t=>{
 for(const settings of [
  {subagentPromptCacheTtl:'1h'},
  {subagentPromptCacheTtl:'5m'},
  {env:{CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL:'5m'}},
  {env:{FORCE_PROMPT_CACHING_5M:'1'}},
 ]){
  const f=await fixture(t);await put(settingsPath(f),JSON.stringify(settings));
  const plan=await planInstall(f);
  assert.ok(plan.warnings.includes('claude-role-cache-ttl-overridden'),JSON.stringify(settings));
  await applyInstall(plan);
  assert.ok((await inspectConfiguration(f)).warnings.includes('claude-role-cache-ttl-overridden'));
  const saved=JSON.parse(await fs.readFile(settingsPath(f)));
  for(const[key,value]of Object.entries(settings))if(key!=='env')assert.equal(saved[key],value,'the user value stays');
 }
 for(const settings of [{subagentPromptCacheTtl:'2h'},{env:{FORCE_PROMPT_CACHING_5M:'0'}}]){
  const f=await fixture(t);await put(settingsPath(f),JSON.stringify(settings));
  assert.ok(!(await planInstall(f)).warnings.includes('claude-role-cache-ttl-overridden'),JSON.stringify(settings));
 }
});

test('a replacing setup turns the option on and off, and local role edits are refused',async t=>{
 const f=await fixture(t,policy());
 await applyInstall(await planInstall(f));
 await fs.writeFile(f.policyPath,JSON.stringify(policy(LONG)));
 await assert.rejects(planInstall(f),{code:'INSTALLATION_CONFLICT'});
 await applyInstall(await planInstall({...f,replace:true}));
 assert.match(await fs.readFile(rolePath(f,'worker'),'utf8'),cacheLines);
 await fs.writeFile(f.policyPath,JSON.stringify(policy()));
 await applyInstall(await planInstall({...f,replace:true}));
 assert.doesNotMatch(await fs.readFile(rolePath(f,'worker'),'utf8'),/cacheTtl/);
 await fs.writeFile(f.policyPath,JSON.stringify(policy(LONG)));
 await applyInstall(await planInstall({...f,replace:true}));
 await fs.appendFile(rolePath(f,'worker'),'local edit\n');
 await assert.rejects(uninstall({...f,apply:true}),{code:'OWNED_DRIFT'});
});

test('show reports the role cache and the control that outranks it',async t=>{
 const f=await fixture(t);await applyInstall(await planInstall(f));
 const read=async(env={})=>(await readConfiguration({home:f.home,client:'claude',env,stateDir:f.stateDir})).clients.claude;
 let c=await read();
 assert.equal(c.roles.find(role=>role.name==='apk-worker').cacheTtl,'1h');
 assert.ok(!('cacheTtl' in c.roles.find(role=>role.name==='apk-reviewer')));
 assert.equal(c.overrides.subagentCacheTtl,undefined);
 const text=formatResult('show',{schemaVersion:1,scope:'user',modelExecution:'not_checked',clients:{claude:c}},{version:'1.2.3',apply:false});
 assert.match(text,/apk-worker .*cache 1h/);assert.doesNotMatch(text,/apk-reviewer .*cache/);
 const settings=JSON.parse(await fs.readFile(settingsPath(f)));
 await fs.writeFile(settingsPath(f),JSON.stringify({...settings,subagentPromptCacheTtl:'1h'}));
 assert.equal((await read()).overrides.subagentCacheTtl,'1h');
 assert.equal((await read({CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL:'5m'})).overrides.subagentCacheTtl,'5m');
 assert.equal((await read({CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL:'2h'})).overrides.subagentCacheTtl,'1h','Claude Code ignores any other value');
 assert.equal((await read({FORCE_PROMPT_CACHING_5M:'1'})).overrides.subagentCacheTtl,'5m');
});

test('show reads the cache field only from the experimental map of Claude roles',async t=>{
 const f=await fixture(t,policy());
 const agents=path.join(f.home,'.claude/agents');
 await put(path.join(agents,'top.md'),'---\nname: top\ncacheTtl: 1h\n---\nprompt');
 await put(path.join(agents,'other.md'),'---\nname: other\nextra:\n  cacheTtl: 1h\n---\nprompt');
 await put(path.join(agents,'bad.md'),'---\nname: bad\nexperimental:\n  cacheTtl: 2h\n---\nprompt');
 await put(path.join(agents,'after.md'),'---\nname: after\nexperimental:\n  other: x\nmodel: sonnet\n  cacheTtl: 1h\n---\nprompt');
 await put(path.join(agents,'good.md'),'---\r\nname: good\r\nexperimental:\r\n  cacheTtl: "1h" # comment\r\n---\r\nprompt');
 const roles=(await readConfiguration({home:f.home,client:'claude',env:{},stateDir:f.stateDir})).clients.claude.roles;
 const of=name=>roles.find(role=>role.name===name);
 for(const name of ['top','other','bad','after'])assert.ok(!('cacheTtl' in of(name)),name);
 assert.equal(of('good').cacheTtl,'1h');
});
