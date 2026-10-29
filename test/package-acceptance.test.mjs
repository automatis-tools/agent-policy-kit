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

test('packed package survives a fresh install without source access and preserves user config', { timeout: 180000 }, t => {
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
  const version = cli(['--version']);
  assert.equal(version.status, 0, `Installed entry point failed: ${version.stderr}`);
  assert.equal(version.stdout.trim(), packed[0].version);
  const guide = cli(['instructions']); assert.equal(guide.status, 0); assert.match(guide.stdout, /LLM-first/);
  const absent = isolated(bin, ['setup', '--apply'], { env: { ...env, PATH: path.dirname(process.execPath) } });
  assert.equal(absent.status, 3); assert.equal(JSON.parse(absent.stdout).status, 'no_clients');
  assert.equal(fs.existsSync(state), false, 'absent clients must not create state');
  // These version/help-only fixtures establish package detection compatibility,
  // not native client loading or provider-model execution.
  const nativeBin = path.join(consumer, 'native-bin'); fs.mkdirSync(nativeBin);
  const identities = {
    codex: ['codex-cli 0.165.0', 'Usage: codex'],
    claude: ['2.1.312 (Claude Code)', 'Usage: claude'],
    kimi: ['2.4.0', 'Usage: kimi\nKimi Code CLI\nhttps://moonshotai.github.io/kimi-code/'],
    agy: ['1.4.10', 'Usage of agy:\n--agent --model --effort\nAvailable subcommands: agent models plugin'],
  };
  for (const [name, [v, h]] of Object.entries(identities)) {
    fs.writeFileSync(path.join(nativeBin, name), `#!/usr/bin/env node\nconsole.log(process.argv.includes('--version')?${JSON.stringify(v)}:${JSON.stringify(h)});\n`, { mode: 0o755 });
  }
  env.PATH = [nativeBin, path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter);
  parse(cli(['init', '--policy', path.join(state, 'policy.json')]));
  const doctor = parse(cli(['doctor', '--client', 'agy']));
  assert.equal(doctor.package.mode, 'installed-package');
  assert.equal(doctor.clients.agy.runtime.status, 'unsupported');
  // A late filesystem fault is injected outside the product through Node's
  // preloader. The package has no hidden failure flags or test-only API.
  const faultHome = path.join(consumer, "rollback home's"); fs.mkdirSync(faultHome);
  const faultState = path.join(faultHome, '.agent-policy-kit');
  fs.mkdirSync(path.join(faultHome, '.codex'));
  const originalConfig = '# retain my config\nmodel="gpt-6.1-sol"\n';
  fs.writeFileSync(path.join(faultHome, '.codex/config.toml'), originalConfig);
  const failureMarker = path.join(consumer, 'late-failure-observed');
  const preloader = path.join(consumer, 'disk-failure.mjs');
  fs.writeFileSync(preloader, `import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
const rename=fs.rename;let failed=false;
fs.rename=async(from,to)=>{if(to===${JSON.stringify(path.join(faultState, 'installations/codex.json'))}&&!failed){
failed=true;await fs.access(${JSON.stringify(path.join(faultHome, '.codex/hooks.json'))});
await fs.writeFile(${JSON.stringify(failureMarker)},'committed-files-observed');
throw Object.assign(new Error('injected late disk fault'),{code:'EIO'});}return rename(from,to);};
syncBuiltinESMExports();\n`);
  const failedInstall = isolated(bin, ['install', '--client', 'codex', '--home', faultHome, '--state-dir', faultState, '--apply'],
    { env: { ...env, NODE_OPTIONS: `--import=${pathToFileURL(preloader).href}` } });
  assert.notEqual(failedInstall.status, 0);
  assert.equal(fs.readFileSync(failureMarker, 'utf8'), 'committed-files-observed');
  assert.equal(fs.readFileSync(path.join(faultHome, '.codex/config.toml'), 'utf8'), originalConfig);
  assert.equal(fs.existsSync(path.join(faultHome, '.codex/hooks.json')), false);
  assert.equal(fs.existsSync(path.join(faultState, 'installations/codex.json')), false);
  assert.equal(parse(cli(['install', '--client', 'codex', '--home', faultHome, '--state-dir', faultState, '--apply'])).results[0].status, 'configured');
  fs.mkdirSync(path.join(freshHome, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(freshHome, '.claude/settings.json'), JSON.stringify({ model: 'opus', env: { USER_TOKEN: 'PRIVATE_CREDENTIAL' }, theme: 'light' }));
  fs.mkdirSync(path.join(freshHome, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(freshHome, '.codex/config.toml'), '# user comment\nmodel="gpt-6.1-sol"\n');
  fs.mkdirSync(path.join(freshHome, '.kimi-code'), { recursive: true });
  const installedRoot = path.join(consumer, 'node_modules/agent-policy-kit');
  fs.writeFileSync(path.join(freshHome, '.kimi-code/config.toml'), fs.readFileSync(path.join(installedRoot, 'examples/kimi-pool.toml')));
  for (const client of ['codex', 'claude', 'kimi']) {
    const before = fs.existsSync(path.join(state, 'installations', `${client}.json`));
    assert.equal(before, false);
    const plan = parse(cli(['install', '--client', client]));
    assert.equal(plan.status, 'planned');
    assert.equal(fs.existsSync(path.join(state, 'installations', `${client}.json`)), false, 'plan-only must not install');
    assert.equal(JSON.stringify(plan).includes('PRIVATE_CREDENTIAL'), false);
    assert.equal(parse(cli(['install', '--client', client, '--apply'])).results[0].status, 'configured');
    assert.equal(parse(cli(['install', '--client', client, '--apply'])).results[0].status, 'unchanged');
  }
  const settingsPath = path.join(freshHome, '.claude/settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath));
  assert.equal(settings.model, 'opus'); assert.equal(settings.env.USER_TOKEN, 'PRIVATE_CREDENTIAL');
  settings.theme = 'dark'; fs.writeFileSync(settingsPath, JSON.stringify(settings));
  const hook = settings.hooks.PreToolUse.find(x => x.hooks?.some(h => h.command?.includes('agent-policy.mjs'))).hooks[0].command;
  const gate = isolated('/bin/sh', ['-c', hook], { input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Agent', session_id: 'PRIVATE_SESSION', tool_input: { prompt: 'PRIVATE_TASK', model: 'opus' } }) });
  assert.equal(JSON.parse(gate.stdout).hookSpecificOutput.permissionDecision, 'deny');
  const kimiText = fs.readFileSync(path.join(freshHome, '.kimi-code/config.toml'), 'utf8');
  const kimiCommand = kimiText.match(/^command = ("(?:[^"\\]|\\.)*")$/m);
  assert.ok(kimiCommand);
  const kimiGate = isolated('/bin/sh', ['-c', JSON.parse(kimiCommand[1])], { input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'explore', model: 'subagent-light' } }) });
  assert.equal(kimiGate.status, 0); assert.equal(kimiGate.stdout, '');
  const audit = parse(cli(['audit', '--public']));
  assert.equal(audit.records, 2); assert.equal(JSON.stringify(audit).includes('PRIVATE'), false);
  assert.equal(parse(cli(['uninstall', '--client', 'claude', '--apply'])).status, 'applied');
  const after = JSON.parse(fs.readFileSync(settingsPath));
  assert.equal(after.theme, 'dark'); assert.equal(after.env.USER_TOKEN, 'PRIVATE_CREDENTIAL'); assert.equal(after.model, 'opus');
  const codexConfig = path.join(freshHome, '.codex/config.toml');
  fs.appendFileSync(codexConfig, '\n# unrelated later edit\n');
  assert.equal(parse(cli(['uninstall', '--client', 'codex', '--apply'])).status, 'applied');
  assert.match(fs.readFileSync(codexConfig, 'utf8'), /unrelated later edit/);
  const kimiConfig = path.join(freshHome, '.kimi-code/config.toml');
  fs.appendFileSync(kimiConfig, '\n[hooks.extra]\nprivate_user_value="preserve"\n');
  const drift = cli(['uninstall', '--client', 'kimi', '--apply']);
  assert.notEqual(drift.status, 0); assert.match(fs.readFileSync(kimiConfig, 'utf8'), /private_user_value/);
  // Npm uninstall does not run an implicit client-settings mutator.
  assert.equal(command('npm', ['uninstall', '--prefix', consumer, 'agent-policy-kit', '--ignore-scripts', '--offline', '--no-audit', '--no-fund'], { cwd: consumer, env }).status, 0);
  assert.equal(fs.existsSync(bin), false);
});
