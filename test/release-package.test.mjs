import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

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

test('two real configuration packages upgrade and downgrade models and templates safely', { timeout: 180000 }, t => {
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
  const snapshotB=path.join(root,'synthetic release B'),prefixB=path.join(consumer,'release B');
  fs.cpSync(snapshot,snapshotB,{recursive:true});
  const pkgB=path.join(snapshotB,'package.json'),pkg=JSON.parse(fs.readFileSync(pkgB));pkg.version='0.2.0';fs.writeFileSync(pkgB,JSON.stringify(pkg));
  const prefsB=path.join(snapshotB,'policies/balanced.json'),prefs=JSON.parse(fs.readFileSync(prefsB));prefs.clients.codex.code.model='fixture-code-v2';fs.writeFileSync(prefsB,JSON.stringify(prefs));
  const compiler=path.join(snapshotB,'src/native.mjs'),originalCompiler=fs.readFileSync(compiler,'utf8');
  const changedCompiler=originalCompiler.replace('Implement the assigned change.','Fixture B worker. Implement the assigned change.').replace('text.push(END);',"text.push('Fixture B routing note.');text.push(END);");
  assert.notEqual(changedCompiler,originalCompiler);fs.writeFileSync(compiler,changedCompiler);
  fs.writeFileSync(path.join(snapshotB,'CHANGELOG.md'),['# Changelog','','## 0.2.0 — Unreleased','','### Why this release',"Literal $& and $' in release notes must remain data.",'Synthetic test fixture, not a real release.',''].join('\n'));
  assert.equal(command(process.execPath,['scripts/build-site.mjs'],{cwd:snapshotB,env}).status,0);
  const packedB=parse(command('npm',['pack','--json','--ignore-scripts','--pack-destination',root],{cwd:snapshotB,env}));
  parse(command('npm',['install','--prefix',prefixB,path.join(root,packedB[0].filename),'--ignore-scripts','--no-audit','--no-fund','--offline','--json'],{cwd:consumer,env}));
  fs.rmSync(snapshot,{recursive:true,force:true});fs.rmSync(snapshotB,{recursive:true,force:true});
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
  const binB=path.join(prefixB,'node_modules/.bin/agent-policy');
  const pageB=fs.readFileSync(path.join(prefixB,'node_modules/agent-policy-kit/site/index.html'),'utf8'),contextB=vm.createContext({TextEncoder,btoa});
  vm.runInContext(pageB.match(/<script>([\s\S]*?)<\/script>/)[1],contextB);
  assert.equal(typeof contextB.APKConfigurator.buildCommand,'function','release notes must not corrupt the generated page script');
  const run=(which,args,extra={})=>isolated(which==='A'?bin:binB,args,extra);
  assert.equal(parse(run('A',['release'])).version,'0.1.0');assert.equal(parse(run('B',['release'])).version,'0.2.0');
  const nativeBin=path.join(consumer,'native-bin');fs.mkdirSync(nativeBin);
  for(const [name,version]of Object.entries({codex:'codex-cli 0.166.0',claude:'2.1.312 (Claude Code)'}))fs.writeFileSync(path.join(nativeBin,name),`#!/usr/bin/env node\nconsole.log(${JSON.stringify(version)});\n`,{mode:0o755});
  env.PATH=[nativeBin,path.dirname(process.execPath),'/usr/bin','/bin'].join(path.delimiter);
  const put=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
  const codex=path.join(freshHome,'.codex/config.toml'),claude=path.join(freshHome,'.claude/settings.json'),role=path.join(freshHome,'.codex/agents/apk-worker.toml');
  const original='# user config\nmodel="main"\nmodel_reasoning_effort="ultra"\n[agents]\nenabled=false\nmax_concurrent_threads_per_session=9\n';
  put(codex,original);put(claude,JSON.stringify({model:'opus',theme:'light',env:{USER_SECRET:'PRIVATE_SENTINEL'}}));
  put(path.join(freshHome,'.codex/AGENTS.md'),'Original instructions.\n');put(path.join(freshHome,'.claude/CLAUDE.md'),'Original Claude instructions.\n');
  const setupA=parse(run('A',['setup','--release','--apply']));assert.equal(setupA.status,'configured');
  assert.ok(setupA.results.filter(r=>r.status==='configured').every(r=>r.appliedReleaseVersion==='0.1.0'));
  assert.equal(parse(run('A',['setup','--release','--apply'])).results.find(r=>r.client==='codex').status,'unchanged');
  const settings=JSON.parse(fs.readFileSync(claude));settings.theme='dark';fs.writeFileSync(claude,JSON.stringify(settings));
  fs.appendFileSync(codex,'\n# later user comment\n');fs.appendFileSync(path.join(freshHome,'.codex/AGENTS.md'),'Later user note.\n');

  const owned=[...JSON.parse(fs.readFileSync(path.join(state,'installations/codex.json'))).files.map(f=>f.path),path.join(state,'policy.json'),path.join(state,'installations/codex.json')];
  const before=new Map(owned.map(file=>[file,fs.readFileSync(file,'utf8')]));
  const preloader=path.join(consumer,'replacement-fault.mjs'),marker=path.join(consumer,'replacement-writes-observed');
  fs.writeFileSync(preloader,`import fs from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';const rename=fs.rename;let failed=false;
fs.rename=async(from,to)=>{if(to===${JSON.stringify(path.join(state,'installations/codex.json'))}&&!failed){failed=true;
const body=await fs.readFile(${JSON.stringify(role)},'utf8');if(!body.includes('Fixture B'))throw new Error('fault not late');await fs.writeFile(${JSON.stringify(marker)},'yes');throw Object.assign(new Error('late replacement fault'),{code:'EIO'});}return rename(from,to);};syncBuiltinESMExports();`);
  const failure=run('B',['setup','--release','--client','codex','--apply'],{env:{...env,NODE_OPTIONS:`--import=${pathToFileURL(preloader).href}`}});
  assert.equal(failure.status,3);assert.equal(fs.readFileSync(marker,'utf8'),'yes');for(const[file,text]of before)assert.equal(fs.readFileSync(file,'utf8'),text,'replacement rollback must restore installed A, not original user baseline');
  assert.equal(parse(run('B',['doctor','--client','codex'])).clients.codex.configuration.releaseVersion,'0.1.0');

  const currentRole=fs.readFileSync(role,'utf8');fs.appendFileSync(role,'# edited owned role\n');
  const drift=run('B',['setup','--release','--client','codex','--apply']);assert.equal(drift.status,3);assert.equal(JSON.parse(drift.stdout).results.find(r=>r.client==='codex').error,'OWNED_DRIFT');assert.match(fs.readFileSync(role,'utf8'),/edited owned role/);fs.writeFileSync(role,currentRole);
  const forced=JSON.parse(fs.readFileSync(claude));forced.env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE='1';fs.writeFileSync(claude,JSON.stringify(forced));const forcedBefore=fs.readFileSync(claude,'utf8');
  const prerequisite=run('B',['setup','--release','--client','claude','--apply']);assert.equal(prerequisite.status,3);assert.equal(JSON.parse(prerequisite.stdout).results.find(r=>r.client==='claude').status,'prerequisite');assert.equal(fs.readFileSync(claude,'utf8'),forcedBefore);
  delete forced.env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE;fs.writeFileSync(claude,JSON.stringify(forced));

  const b=parse(run('B',['setup','--release','--client','codex','--apply']));assert.equal(b.results[0].previousReleaseVersion,'0.1.0');assert.equal(b.results[0].appliedReleaseVersion,'0.2.0');
  assert.match(fs.readFileSync(role,'utf8'),/Fixture B/);assert.match(fs.readFileSync(role,'utf8'),/fixture-code-v2/);
  // Applied receipts remain true even when desired canonical state is absent/broken.
  fs.writeFileSync(path.join(state,'policy.json'),'{broken');
  const mixed=parse(run('A',['doctor']));assert.equal(mixed.clients.codex.configuration.status,'verified');assert.equal(mixed.clients.codex.configuration.releaseVersion,'0.2.0');assert.equal(mixed.clients.claude.configuration.releaseVersion,'0.1.0');
  const bAll=parse(run('B',['setup','--release','--apply']));assert.equal(bAll.status,'configured');assert.ok(bAll.results.filter(r=>['configured','unchanged'].includes(r.status)).every(r=>r.appliedReleaseVersion==='0.2.0'));
  const bodyB=fs.readFileSync(role,'utf8');
  const implicit=parse(run('A',['setup','--client','codex','--apply']));
  assert.equal(implicit.results[0].status,'unchanged');assert.equal(implicit.results[0].appliedReleaseVersion,'0.2.0');
  assert.equal(fs.readFileSync(role,'utf8'),bodyB,'normal setup must preserve saved B rather than silently downgrade templates');
  const a=parse(run('A',['setup','--release','--apply']));assert.equal(a.status,'configured');assert.ok(a.results.filter(r=>['configured','unchanged'].includes(r.status)).every(r=>r.appliedReleaseVersion==='0.1.0'));
  assert.doesNotMatch(fs.readFileSync(role,'utf8'),/Fixture B|fixture-code-v2/);
  assert.match(fs.readFileSync(role,'utf8'),/gpt-6.1-sol/);assert.equal(JSON.parse(fs.readFileSync(claude)).theme,'dark');
  assert.equal(parse(run('B',['uninstall','--apply'])).status,'completed','current generator must not invalidate older ownership');
  const restored=fs.readFileSync(codex,'utf8').replace(/\s*=\s*/g,'=');assert.match(restored,/max_concurrent_threads_per_session=9/);assert.match(restored,/enabled=false/);assert.match(restored,/later user comment/);assert.match(restored,/model_reasoning_effort="ultra"/);
  assert.deepEqual(JSON.parse(fs.readFileSync(claude)),{model:'opus',theme:'dark',env:{USER_SECRET:'PRIVATE_SENTINEL'}});
  assert.match(fs.readFileSync(path.join(freshHome,'.codex/AGENTS.md'),'utf8'),/Original instructions\.[\s\S]*Later user note\./);

  // The generated page's actual command data runs through the installed CLI.
  const html=fs.readFileSync(path.join(consumer,'node_modules/agent-policy-kit/site/index.html'),'utf8');
  const context=vm.createContext({TextEncoder,btoa});vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  const ui=context.APKConfigurator,preferences=JSON.parse(fs.readFileSync(path.join(consumer,'node_modules/agent-policy-kit/policies/balanced.json'))),choices=ui.initialState(preferences);
  choices.jobs.codex.reviewer={model:'page-review-model',effort:'high'};
  const pageConfig=ui.buildConfig(choices,preferences);assert.equal(pageConfig.errors.length,0);
  const pageCommand=ui.buildCommand(pageConfig.config,{version:'0.1.0'});assert.ok(pageCommand.startsWith('npx --yes --ignore-scripts --package agent-policy-kit@0.1.0 '));
  const encoded=pageCommand.match(/--config ([-_A-Za-z0-9]+)/)[1];
  const pageHome=path.join(consumer,'page-home');fs.mkdirSync(pageHome);const pageState=path.join(pageHome,'.state');
  const pageApplied=parse(run('A',['setup','--config',encoded,'--client','codex','--home',pageHome,'--state-dir',pageState,'--apply']));assert.equal(pageApplied.results[0].appliedSource,'custom');
  assert.match(fs.readFileSync(path.join(pageHome,'.codex/agents/apk-reviewer.toml'),'utf8'),/page-review-model/);
  assert.equal(parse(run('B',['doctor','--client','codex','--home',pageHome,'--state-dir',pageState])).clients.codex.configuration.releaseVersion,'0.1.0');
});
