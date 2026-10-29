import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// This gate tests the distributable, not imports from a checkout. The isolated
// build snapshot is removed, and the real checkout is denied to each consumer.
const source = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function command(exe, args, options = {}) {
  const result = spawnSync(exe, args, { encoding: 'utf8', timeout: 60000, ...options });
  assert.equal(result.error, undefined, result.error?.code);
  return result;
}
function parse(result) { assert.equal(result.status, 0, result.stdout + result.stderr); return JSON.parse(result.stdout); }
function quoteSandbox(value) { return JSON.stringify(value); }

test('packed configurator produces independent native files that survive npm and state removal', { timeout: 180000 }, t => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "agent package's "));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const snapshot = path.join(root, 'source snapshot'); const consumer = path.join(root, "consumer's prefix");
  fs.mkdirSync(consumer); const freshHome = path.join(consumer, "fresh home's"); fs.mkdirSync(freshHome);
  const state = path.join(freshHome, '.agent-policy-kit');
  const cache = process.env.npm_config_cache ?? path.join(os.homedir(), '.npm');
  const cleanPath = [path.dirname(process.execPath), ...(process.env.PATH ?? '').split(path.delimiter)
    .filter(part => part && !part.startsWith(source))].join(path.delimiter);
  const env = { PATH: cleanPath, LANG: 'C.UTF-8', HOME: freshHome, USERPROFILE: freshHome, XDG_CONFIG_HOME: path.join(freshHome, 'xdg/config'),
    XDG_DATA_HOME: path.join(freshHome, 'xdg/data'), XDG_STATE_HOME: path.join(freshHome, 'xdg/state'),
    CODEX_HOME: path.join(freshHome, '.codex'), CLAUDE_CONFIG_DIR: path.join(freshHome, '.claude'), KIMI_CODE_HOME: path.join(freshHome, '.kimi-code'),
    AGENT_POLICY_HOME: state, npm_config_cache: cache, npm_config_registry: 'https://registry.npmjs.org',
    npm_config_userconfig: path.join(freshHome, '.npmrc'), npm_config_globalconfig: path.join(freshHome, 'npm-global-config') };
  delete env.NODE_OPTIONS;
  fs.writeFileSync(env.npm_config_userconfig, ''); fs.writeFileSync(env.npm_config_globalconfig, '');
  fs.cpSync(source, snapshot, { recursive: true, filter: file => {
    const relative = path.relative(source, file);
    return !relative.split(path.sep).some(p => ['node_modules', '.git', '.agent-work', '.superpowers', 'artifacts', 'coverage'].includes(p)) && !relative.endsWith('.tgz');
  } });
  const packed = parse(command('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', root], { cwd: snapshot, env }));
  const names = packed[0].files.map(x => x.path);
  assert.ok(names.includes('AGENT_INSTALL.md'));
  for (const name of names) assert.equal(/(?:^|\/)(?:\.agent-work|\.superpowers|artifacts|node_modules)(?:\/|$)/.test(name), false, name);
  const tarball = path.join(root, packed[0].filename);
  parse(command('npm', ['install', '--prefix', consumer, tarball, '--ignore-scripts', '--no-audit', '--no-fund', '--offline', '--json'], { cwd: consumer, env }));
  assert.match(fs.readFileSync(path.join(consumer, 'node_modules/agent-policy-kit/README.md'), 'utf8'), /```mermaid\nflowchart LR/);
  fs.rmSync(snapshot, { recursive: true, force: true });
  const bin = path.join(consumer, 'node_modules/.bin/agent-policy');
  assert.ok(fs.existsSync(bin));
  const profile = `(version 1)(allow default)(deny file-read* (subpath ${quoteSandbox(source)}))`;
  const mac = process.platform === 'darwin' && fs.existsSync('/usr/bin/sandbox-exec');
  const linux = process.platform === 'linux' && command('sh', ['-c', 'command -v bwrap']).status === 0;
  assert.ok(mac || linux, 'Source isolation requires sandbox-exec (macOS) or bubblewrap (Linux). No package PASS without isolation.');
  function isolated(exe, args, extra = {}) {
    return mac ? command('/usr/bin/sandbox-exec', ['-p', profile, exe, ...args], { cwd: consumer, env, ...extra })
      : command('bwrap', ['--ro-bind', '/', '/', '--bind', consumer, consumer, '--tmpfs', source, '--chdir', consumer, exe, ...args], { env, ...extra });
  }
  function cli(args, input) { return isolated(bin, args, input === undefined ? {} : { input }); }
  const isolationReady = isolated(process.execPath, ['-e', 'process.exit(0)']);
  assert.equal(isolationReady.status, 0, `Source-isolation environment unavailable: ${isolationReady.stderr}`);
  const blocked = isolated(process.execPath, ['-e', `require('node:fs').readFileSync(${JSON.stringify(path.join(source, 'package.json'))})`]);
  assert.notEqual(blocked.status, 0, 'The consumer must be unable to read the source checkout.');
  const installedRoot=path.join(consumer,'node_modules/agent-policy-kit');
  assert.equal(cli(['--version']).stdout.trim(),packed[0].version);
  const guide=cli(['instructions']);assert.equal(guide.status,0);assert.match(guide.stdout,/configuration-only/);
  for(const name of names) assert.equal(/^(?:hooks\/|\.claude-plugin\/)|^src\/(?:audit|adapters|bindings)\.mjs$/.test(name),false,name);
  const absent=isolated(bin,['setup','--apply'],{env:{...env,PATH:path.dirname(process.execPath)}});
  assert.equal(absent.status,3);assert.equal(JSON.parse(absent.stdout).status,'no_clients');assert.equal(fs.existsSync(state),false);

  // Identity + native-file consumer fixtures, never actual vendor/model execution.
  const nativeBin=path.join(consumer,'native-bin');fs.mkdirSync(nativeBin);
  const identities={codex:['codex-cli 0.165.0','Usage: codex'],claude:['2.1.312 (Claude Code)','Usage: claude'],
    kimi:['2.4.0','Usage: kimi\nKimi Code CLI\nhttps://moonshotai.github.io/kimi-code/'],
    agy:['1.4.10','Usage of agy:\n--agent --model --effort\nAvailable subcommands: agent models plugin']};
  const dirs={codex:'.codex',claude:'.claude',kimi:'.kimi-code',agy:'.gemini'};
  const models={codex:['gpt-6.1-sol','gpt-6-luna'],claude:['sonnet','haiku'],agy:['pro','flash']};
  for(const [client,[version,help]]of Object.entries(identities)) {
    const inspect=`const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const client=${JSON.stringify(client)},base=path.join(process.env.HOME,${JSON.stringify(dirs[client])});
const roles=['worker','reviewer','explorer','routine'];
for(const [i,role]of roles.entries()){
const file=path.join(base,client==='agy'?'config/agents':'agents','apk-'+role+(client==='codex'?'.toml':'.md'));
const body=fs.readFileSync(file,'utf8');
assert.ok(body.includes('apk-'+role));
if(client==='codex')assert.match(body,new RegExp('model = '+JSON.stringify(${JSON.stringify(models.codex)}[i<2?0:1]).replaceAll('.','\\\\.')));
else if(client==='kimi')assert.ok(body.includes(i<2?'kimi-code/k3':'kimi-code/kimi-for-coding'));
else assert.ok(body.includes('model: '+${JSON.stringify(models[client]??[])}[i<2?0:1]));
assert.ok(!body.includes('node_modules')&&!body.includes('agent-policy.mjs'));
}
const instructions=fs.readFileSync(path.join(base,client==='claude'?'CLAUDE.md':'AGENTS.md'),'utf8');assert.ok(instructions.includes('apk-worker'));
if(client==='claude'){const config=JSON.parse(fs.readFileSync(path.join(base,'settings.json')));assert.equal(config.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS,'3');assert.equal(config.model,'opus');}
if(client==='codex')assert.match(fs.readFileSync(path.join(base,'config.toml'),'utf8'),/max_concurrent_threads_per_session\\s*=\\s*3/);
console.log(JSON.stringify({client,roles:4,configuration:'readable',evidence:'standalone_consumer_fixture'}));`;
    fs.writeFileSync(path.join(nativeBin,client),`#!/usr/bin/env node\nif(process.argv.includes('--inspect-native')){${inspect}}else console.log(process.argv.includes('--version')?${JSON.stringify(version)}:${JSON.stringify(help)});\n`,{mode:0o755});
  }
  env.PATH=[nativeBin,path.dirname(process.execPath),'/usr/bin','/bin'].join(path.delimiter);
  function put(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
  const prerequisiteHome=path.join(consumer,'unprovisioned');fs.mkdirSync(prerequisiteHome);
  const missing=cli(['install','--client','kimi','--home',prerequisiteHome,'--state-dir',path.join(prerequisiteHome,'.policy'),'--apply']);
  assert.equal(missing.status,3);assert.equal(JSON.parse(missing.stdout).results[0].status,'prerequisite');
  assert.deepEqual(fs.readdirSync(prerequisiteHome),[],'missing native metadata must create nothing');

  // External late-fault injection, with no product test flags.
  const faultHome=path.join(consumer,"rollback home's"),faultState=path.join(faultHome,'.agent-policy-kit');fs.mkdirSync(faultHome);
  const originalConfig='# user settings\nmodel="gpt-6.1-sol"\n';
  put(path.join(faultHome,'.codex/config.toml'),originalConfig);
  const failureMarker=path.join(consumer,'late-failure-observed'),preloader=path.join(consumer,'disk-failure.mjs');
  fs.writeFileSync(preloader,`import fs from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';
const rename=fs.rename;let failed=false;
fs.rename=async(from,to)=>{if(to===${JSON.stringify(path.join(faultState,'installations/codex.json'))}&&!failed){
failed=true;await fs.access(${JSON.stringify(path.join(faultHome,'.codex/agents/apk-worker.toml'))});
await fs.writeFile(${JSON.stringify(failureMarker)},'committed-files-observed');throw Object.assign(new Error('late fault'),{code:'EIO'});}return rename(from,to);};syncBuiltinESMExports();`);
  const failed=isolated(bin,['install','--client','codex','--home',faultHome,'--state-dir',faultState,'--apply'],{env:{...env,NODE_OPTIONS:`--import=${pathToFileURL(preloader).href}`}});
  assert.notEqual(failed.status,0);assert.equal(fs.readFileSync(failureMarker,'utf8'),'committed-files-observed');
  assert.equal(fs.readFileSync(path.join(faultHome,'.codex/config.toml'),'utf8'),originalConfig);
  assert.equal(fs.existsSync(path.join(faultHome,'.codex/agents/apk-worker.toml')),false);
  assert.equal(fs.existsSync(path.join(faultState,'installations/codex.json')),false);
  assert.equal(parse(cli(['install','--client','codex','--home',faultHome,'--state-dir',faultState,'--apply'])).results[0].status,'configured');
  assert.equal(parse(cli(['uninstall','--client','codex','--home',faultHome,'--state-dir',faultState,'--apply'])).status,'applied');

  const userHooks=JSON.stringify({hooks:{PreToolUse:[{matcher:'Bash',hooks:[{type:'command',command:'echo user_hook'}]}]}});
  const codexConfig=path.join(freshHome,'.codex/config.toml'),claudeConfig=path.join(freshHome,'.claude/settings.json'),kimiConfig=path.join(freshHome,'.kimi-code/config.toml');
  put(codexConfig,'# retain comment\nmodel="gpt-6.1-sol"\nmodel_reasoning_effort="ultra"\n');
  put(path.join(freshHome,'.codex/hooks.json'),userHooks);
  put(claudeConfig,JSON.stringify({model:'opus',effortLevel:'max',theme:'light',env:{USER_TOKEN:'PRIVATE_CREDENTIAL'},hooks:JSON.parse(userHooks).hooks}));
  put(path.join(freshHome,'.claude/agents/user-role.md'),'User owned agent file.');
  const kimiOriginal=`default_model="kimi-code/k3"
[thinking]
enabled=true
effort="max"
[providers."managed:kimi-code"]
type="kimi"
api_key="PRIVATE_KIMI_CREDENTIAL"
[models."kimi-code/k3"]
provider="managed:kimi-code"
model="k3-256k"
max_context_size=262144
support_efforts=["low","high","max"]
default_effort="high"
[models."kimi-code/kimi-for-coding"]
provider="managed:kimi-code"
model="kimi-for-coding"
max_context_size=262144
support_efforts=["low","high","max"]
default_effort="high"
[secondary_model]
default_effort="medium"
[[hooks]]
event="PreToolUse"
command="echo user_hook"
`;
  put(kimiConfig,kimiOriginal);
  const nativePaths=[];
  for(const [client,dir]of Object.entries(dirs)) {
    const instructions=path.join(freshHome,dir,client==='claude'?'CLAUDE.md':'AGENTS.md');put(instructions,'User instruction before setup.\n');nativePaths.push(instructions);
    for(const role of ['worker','reviewer','explorer','routine'])nativePaths.push(path.join(freshHome,dir,client==='agy'?'config/agents':'agents',`apk-${role}.${client==='codex'?'toml':'md'}`));
  }
  parse(cli(['init','--policy',path.join(state,'policy.json')]));
  const plan=parse(cli(['setup']));assert.equal(plan.status,'planned');assert.equal(JSON.stringify(plan).includes('PRIVATE_'),false);
  assert.equal(fs.existsSync(path.join(state,'installations')),false,'plan-only must not write receipts');
  const applied=parse(cli(['setup','--apply']));assert.equal(applied.status,'configured');assert.equal(applied.results.filter(r=>r.status==='configured').length,4);
  const repeated=parse(cli(['setup','--apply']));assert.ok(repeated.results.every(r=>r.status==='unchanged'));
  const doctor=parse(cli(['doctor']));assert.equal(doctor.mode,'configuration_only');
  for(const client of Object.keys(dirs)){assert.equal(doctor.clients[client].configuration.status,'verified');assert.equal(doctor.clients[client].modelExecution,'not_checked');}
  assert.equal(fs.readFileSync(path.join(freshHome,'.codex/hooks.json'),'utf8'),userHooks);
  assert.deepEqual(JSON.parse(fs.readFileSync(claudeConfig)).hooks,JSON.parse(userHooks).hooks);
  assert.match(fs.readFileSync(codexConfig,'utf8'),/model_reasoning_effort="ultra"/);
  assert.match(fs.readFileSync(kimiConfig,'utf8'),/effort="max"/);
  assert.doesNotMatch(fs.readFileSync(kimiConfig,'utf8'),/default_effort="medium"/);
  assert.match(fs.readFileSync(kimiConfig,'utf8'),/echo user_hook/);
  assert.equal(fs.readFileSync(path.join(freshHome,'.claude/agents/user-role.md'),'utf8'),'User owned agent file.');
  assert.equal(fs.existsSync(path.join(state,'bin')),false);

  // Unrelated later settings survive; changed owned roles fail removal without edits.
  const settings=JSON.parse(fs.readFileSync(claudeConfig));settings.theme='dark';fs.writeFileSync(claudeConfig,JSON.stringify(settings));
  const codexRole=path.join(freshHome,'.codex/agents/apk-worker.toml'),beforeRole=fs.readFileSync(codexRole,'utf8');fs.appendFileSync(codexRole,'# owned drift\n');
  const drift=cli(['uninstall','--client','codex','--apply']);assert.equal(drift.status,3);assert.equal(JSON.parse(drift.stdout).results[0].error,'OWNED_DRIFT');
  assert.match(fs.readFileSync(codexRole,'utf8'),/owned drift/);fs.writeFileSync(codexRole,beforeRole);
  const removed=parse(cli(['uninstall','--apply']));assert.equal(removed.status,'completed');
  const after=JSON.parse(fs.readFileSync(claudeConfig));assert.equal(after.theme,'dark');assert.equal(after.env.USER_TOKEN,'PRIVATE_CREDENTIAL');assert.equal(after.model,'opus');
  // Surgical TOML restoration may change assignment spacing/trailing blank lines.
  const layout=text=>text.split('\n').map(line=>line.replace(/\s*=\s*/,'=')).filter(line=>line.trim()).join('\n');
  assert.equal(layout(fs.readFileSync(kimiConfig,'utf8')),layout(kimiOriginal));
  for(const file of nativePaths.filter(f=>f.includes('apk-')))assert.equal(fs.existsSync(file),false);
  parse(cli(['setup','--apply']));
  for(const file of [...nativePaths,codexConfig,claudeConfig,kimiConfig]) {
    const text=fs.readFileSync(file,'utf8');
    for(const forbidden of [source,installedRoot,state,process.execPath,'node_modules','agent-policy.mjs','AGENT_POLICY_'])assert.equal(text.includes(forbidden),false,`${path.basename(file)} references ${forbidden}`);
  }
  const saved=new Map(nativePaths.map(file=>[file,fs.readFileSync(file,'utf8')]));
  assert.equal(command('npm',['uninstall','--prefix',consumer,'agent-policy-kit','--ignore-scripts','--offline','--no-audit','--no-fund'],{cwd:consumer,env}).status,0);
  assert.equal(fs.existsSync(bin),false);
  fs.rmSync(state,{recursive:true,force:true});
  for(const [file,text]of saved)assert.equal(fs.readFileSync(file,'utf8'),text);
  for(const client of Object.keys(dirs)) {
    const consumed=parse(isolated(path.join(nativeBin,client),['--inspect-native']));
    assert.equal(consumed.roles,4);assert.equal(consumed.configuration,'readable');assert.equal(consumed.evidence,'standalone_consumer_fixture');
  }
});
