import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
  const env = { ...process.env, HOME: freshHome, USERPROFILE: freshHome, XDG_CONFIG_HOME: path.join(freshHome, 'xdg/config'),
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
  for (const name of names) assert.equal(/(?:^|\/)(?:\.agent-work|\.superpowers|artifacts|node_modules)(?:\/|$)/.test(name), false, name);
  const tarball = path.join(root, packed[0].filename);
  parse(command('npm', ['install', '--prefix', consumer, tarball, '--ignore-scripts', '--no-audit', '--no-fund', '--offline', '--json'], { cwd: consumer, env }));
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
  assert.equal(version.stdout.trim(), '0.1.0');
  parse(cli(['init', '--policy', path.join(state, 'policy.json')]));
  const doctor = parse(cli(['doctor', '--client', 'agy']));
  assert.equal(doctor.package.mode, 'installed-package');
  assert.equal(doctor.clients.agy.runtime.status, 'unsupported');
  fs.mkdirSync(path.join(freshHome, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(freshHome, '.claude/settings.json'), JSON.stringify({ model: 'opus', env: { USER_TOKEN: 'PRIVATE_CREDENTIAL' }, theme: 'light' }));
  fs.mkdirSync(path.join(freshHome, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(freshHome, '.codex/config.toml'), '# user comment\nmodel="gpt-6.1-sol"\n');
  for (const client of ['codex', 'claude', 'kimi']) {
    const before = fs.existsSync(path.join(state, 'installations', `${client}.json`));
    assert.equal(before, false);
    const plan = parse(cli(['install', '--client', client]));
    assert.equal(plan.status, 'planned');
    assert.equal(fs.existsSync(path.join(state, 'installations', `${client}.json`)), false, 'plan-only must not install');
    assert.equal(JSON.stringify(plan).includes('PRIVATE_CREDENTIAL'), false);
    assert.equal(parse(cli(['install', '--client', client, '--apply'])).status, 'applied');
    assert.equal(parse(cli(['install', '--client', client, '--apply'])).status, 'unchanged');
  }
  const settingsPath = path.join(freshHome, '.claude/settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath));
  assert.equal(settings.model, 'opus'); assert.equal(settings.env.USER_TOKEN, 'PRIVATE_CREDENTIAL');
  settings.theme = 'dark'; fs.writeFileSync(settingsPath, JSON.stringify(settings));
  const hook = settings.hooks.PreToolUse.find(x => x.hooks?.some(h => h.command?.includes('agent-policy.mjs'))).hooks[0].command;
  const gate = isolated('/bin/sh', ['-c', hook], { input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Agent', session_id: 'PRIVATE_SESSION', tool_input: { prompt: 'PRIVATE_TASK', model: 'opus' } }) });
  assert.equal(JSON.parse(gate.stdout).hookSpecificOutput.permissionDecision, 'deny');
  const audit = parse(cli(['audit', '--public']));
  assert.equal(audit.records, 1); assert.equal(JSON.stringify(audit).includes('PRIVATE'), false);
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
