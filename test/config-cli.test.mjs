import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const bin=fileURLToPath(new URL('../bin/agent-policy.mjs',import.meta.url));
function fixture(t) { const home=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),"native cli's "));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));return home; }
function cli(home,args,input,env={}) {return spawnSync(process.execPath,[bin,...args],{encoding:'utf8',input,env:{...process.env,HOME:home,USERPROFILE:home,CODEX_HOME:path.join(home,'.codex'),CLAUDE_CONFIG_DIR:path.join(home,'.claude'),KIMI_CODE_HOME:path.join(home,'.kimi-code'),AGENT_POLICY_HOME:path.join(home,'.agent-policy-kit'),PATH:path.dirname(process.execPath),...env}});}
test('CLI exposes configuration commands and no ongoing runtime entry points',t=>{
  const home=fixture(t),help=cli(home,['--help']);assert.equal(help.status,0);
  for(const command of ['setup','uninstall','doctor','instructions']) assert.match(help.stdout,new RegExp(`\\b${command}\\b`));
  assert.doesNotMatch(help.stdout,/^\s+(?:run|hook|record|audit|evaluate)\s/m);
  assert.equal(cli(home,['--version']).stdout.trim(),'0.1.0');
});
test('packaged instructions work before any policy/client setup',t=>{
  const got=cli(fixture(t),['instructions']);assert.equal(got.status,0);assert.match(got.stdout,/configuration.only|configurator/i);
});
test('preferences init is independent and never overwrites',t=>{
  const home=fixture(t),policy=path.join(home,'custom.json');
  assert.equal(cli(home,['init','--policy',policy]).status,0);
  assert.equal(JSON.parse(fs.readFileSync(policy)).maxConcurrent,3);
  fs.writeFileSync(policy,'PRIVATE_EXISTING_VALUE');assert.notEqual(cli(home,['init','--policy',policy]).status,0);
  assert.equal(fs.readFileSync(policy,'utf8'),'PRIVATE_EXISTING_VALUE');
});
test('missing native CLIs create no configuration, even from ephemeral npm paths',t=>{
  const home=fixture(t);fs.mkdirSync(path.join(home,'.claude'));
  const got=cli(home,['setup','--apply']);assert.equal(got.status,3);assert.equal(JSON.parse(got.stdout).status,'no_clients');
  assert.deepEqual(fs.readdirSync(home),['.claude']);
});
test('selected missing client is not configured',t=>{
  const home=fixture(t),got=cli(home,['install','--client','codex','--apply']);
  assert.equal(got.status,3);assert.equal(JSON.parse(got.stdout).status,'no_clients');assert.deepEqual(fs.readdirSync(home),[]);
});
test('receipt-based uninstall needs neither preferences nor native executable',t=>{
  const home=fixture(t),state=path.join(home,'.agent-policy-kit');fs.mkdirSync(state);fs.writeFileSync(path.join(state,'policy.json'),'{broken');
  const got=cli(home,['uninstall','--apply']);assert.equal(got.status,0);assert.equal(JSON.parse(got.stdout).status,'not_installed');
});
test('doctor separates native configuration from model execution',t=>{
  const got=cli(fixture(t),['doctor','--client','agy']);assert.equal(got.status,0);
  const report=JSON.parse(got.stdout);assert.equal(report.mode,'configuration_only');
  assert.equal(report.clients.agy.configuration.status,'not_configured');
  assert.equal(report.clients.agy.modelExecution,'not_checked');
});
test('removed runtime commands reject before reading corrupt preferences or private input',t=>{
  const home=fixture(t),state=path.join(home,'.agent-policy-kit');fs.mkdirSync(state);fs.writeFileSync(path.join(state,'policy.json'),'{broken');
  for(const command of ['run','hook','record','audit','evaluate']) {
    const got=cli(home,[command],'PRIVATE_TASK');assert.equal(got.status,1);assert.equal(JSON.parse(got.stdout).error,'UNKNOWN_COMMAND');
    assert.equal((got.stdout+got.stderr).includes('PRIVATE_TASK'),false);
  }
});

const nativeHomes={codex:['CODEX_HOME','.codex','codex-cli 0.165.0'],claude:['CLAUDE_CONFIG_DIR','.claude','2.1.312 (Claude Code)'],kimi:['KIMI_CODE_HOME','.kimi-code','kimi 2.4.0']};
const provisionedKimi='[providers.fixture]\ntype = "kimi"\n[models."kimi-code/k3"]\nprovider = "fixture"\nmodel = "k3"\nmax_context_size = 1048576\nsupport_efforts = ["high"]\n[models."kimi-code/kimi-for-coding"]\nprovider = "fixture"\nmodel = "kimi-for-coding"\nmax_context_size = 262144\nsupport_efforts = ["low", "high"]\n';
function nativeBinary(home,client) {
 const directory=path.join(home,'fixture-bin');fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,client),`#!${process.execPath}\nconsole.log(${JSON.stringify(nativeHomes[client][2])});\n`,{mode:0o700});return directory;
}
for(const [client,[variable,directory]]of Object.entries(nativeHomes))test(`CLI ${client} active home override refuses dormant setup and doctor verification`,t=>{
 const home=fixture(t),active=path.join(home,'active-profile'),config=path.join(active,client==='claude'?'settings.json':'config.toml');fs.mkdirSync(active);fs.writeFileSync(config,'PRIVATE_ACTIVE_SENTINEL');
 const env={PATH:nativeBinary(home,client),[variable]:active};const got=cli(home,['setup','--client',client,'--apply'],undefined,env);assert.equal(got.status,3);const result=JSON.parse(got.stdout);assert.equal(result.status,'partial');assert.equal(result.results[0].status,'prerequisite');assert.ok(result.requiredActions.some(a=>a.code==='native-home-override-unsupported'));assert.equal(fs.readFileSync(config,'utf8'),'PRIVATE_ACTIVE_SENTINEL');assert.equal(fs.existsSync(path.join(home,directory)),false);assert.equal(fs.existsSync(path.join(home,'.agent-policy-kit')),false);assert.ok(!got.stdout.includes(active));
 const report=JSON.parse(cli(home,['doctor','--client',client],undefined,env).stdout);assert.deepEqual(report.clients[client].configuration,{status:'attention',reason:'NATIVE_HOME_OVERRIDE_UNSUPPORTED'});assert.ok(!JSON.stringify(report).includes(active));
 // A receipt for a standard profile must never make an overridden active profile look verified.
 const standard=path.join(home,directory);if(client==='kimi'){fs.mkdirSync(standard);fs.writeFileSync(path.join(standard,'config.toml'),provisionedKimi);}
 assert.equal(cli(home,['setup','--client',client,'--apply'],undefined,{PATH:env.PATH}).status,0);
 const installedReport=JSON.parse(cli(home,['doctor','--client',client],undefined,env).stdout);assert.equal(installedReport.clients[client].configuration.status,'attention');assert.equal(installedReport.clients[client].configuration.reason,'NATIVE_HOME_OVERRIDE_UNSUPPORTED');assert.equal(fs.readFileSync(config,'utf8'),'PRIVATE_ACTIVE_SENTINEL');
});
for(const [client,[variable,directory]]of Object.entries(nativeHomes))test(`CLI ${client} same-default home and explicit target stay supported`,t=>{
 const home=fixture(t),standard=path.join(home,directory),target=path.join(home,'explicit-target'),active=path.join(home,'active-profile');fs.mkdirSync(target);fs.mkdirSync(active);fs.writeFileSync(path.join(active,'sentinel'),'private');const env={PATH:nativeBinary(home,client),[variable]:standard+path.sep+'.'};
 if(client==='kimi'){fs.mkdirSync(standard);fs.writeFileSync(path.join(standard,'config.toml'),provisionedKimi);fs.mkdirSync(path.join(target,directory));fs.writeFileSync(path.join(target,directory,'config.toml'),provisionedKimi);}
 assert.equal(cli(home,['install','--client',client,'--apply'],undefined,env).status,0);
 const explicitEnv={...env,[variable]:active},state=path.join(target,'.agent-policy-kit');const args=['--client',client,'--home',target,'--state-dir',state];assert.equal(cli(home,['install',...args,'--apply'],undefined,explicitEnv).status,0);assert.equal(JSON.parse(cli(home,['doctor',...args],undefined,explicitEnv).stdout).clients[client].configuration.status,'verified');assert.equal(cli(home,['uninstall',...args,'--apply'],undefined,explicitEnv).status,0);assert.equal(fs.readFileSync(path.join(active,'sentinel'),'utf8'),'private');
});

test('external preference updates coordinate the retained canonical file after owned removal',t=>{
 const home=fixture(t),policy=path.join(home,'custom.json'),state=path.join(home,'.agent-policy-kit'),env={PATH:nativeBinary(home,'codex')};
 assert.equal(cli(home,['init','--policy',policy],undefined,env).status,0);
 assert.equal(cli(home,['install','--client','codex','--policy',policy,'--apply'],undefined,env).status,0);
 assert.equal(cli(home,['uninstall','--client','codex','--apply'],undefined,env).status,0);
 const canonical=path.join(state,'policy.json');assert.equal(fs.existsSync(canonical),true);assert.deepEqual(fs.readdirSync(path.join(state,'installations')),[]);assert.equal(fs.existsSync(path.join(state,'pending.json')),false);assert.equal(fs.existsSync(path.join(state,'.install.lock')),false);
 const replacement=JSON.parse(fs.readFileSync(policy));replacement.maxConcurrent=2;fs.writeFileSync(policy,JSON.stringify(replacement));
 const conflict=cli(home,['setup','--client','codex','--policy',policy,'--apply'],undefined,env);assert.equal(conflict.status,3);assert.equal(JSON.parse(conflict.stdout).results[0].error,'POLICY_CONFLICT');
 fs.writeFileSync(canonical,JSON.stringify(replacement));
 assert.equal(cli(home,['setup','--client','codex','--policy',policy,'--apply'],undefined,env).status,0);
 const report=JSON.parse(cli(home,['doctor','--client','codex','--policy',policy],undefined,env).stdout);assert.equal(report.clients.codex.configuration.status,'verified');assert.match(fs.readFileSync(path.join(home,'.codex/config.toml'),'utf8'),/max_concurrent_threads_per_session = 2/);
});
