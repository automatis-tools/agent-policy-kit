import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const bin=fileURLToPath(new URL('../bin/agent-policy.mjs',import.meta.url));
function fixture(t) { const home=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),"native cli's "));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));return home; }
function cli(home,args,input) {return spawnSync(process.execPath,[bin,...args],{encoding:'utf8',input,env:{...process.env,HOME:home,USERPROFILE:home,AGENT_POLICY_HOME:path.join(home,'.agent-policy-kit'),PATH:path.dirname(process.execPath)}});}
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
