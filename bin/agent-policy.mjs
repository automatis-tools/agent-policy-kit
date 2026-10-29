#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { CLIENTS, validatePolicy, evaluate } from '../src/policy.mjs';
import { handleHook, denial } from '../src/adapters.mjs';
import { appendRecord, readRecords, publicSummary } from '../src/audit.mjs';

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packageInfo = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
const builtinPolicy = path.join(packageRoot, 'policies/balanced.json');
const rawArgs = process.argv.slice(2);
const print = value => process.stdout.write(JSON.stringify(value, null, 2) + '\n');
const failure = code => Object.assign(new Error(code), { code });

async function stdin() {
  const chunks = []; let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 1024 * 1024) throw failure('INPUT_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function loadPolicy(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) throw failure('INVALID_POLICY');
  return validatePolicy(JSON.parse(fs.readFileSync(file, 'utf8')));
}
const safeCode = code => typeof code === 'string' && /^[A-Za-z_]{1,64}$/.test(code) ? code : 'OPERATION_FAILED';
function help() {
  console.log(`Agent Policy Kit ${packageInfo.version}

Usage: agent-policy <command> [options]

  init       Copy the balanced policy to --policy (never overwrite)
  evaluate   Explain a --client/--role/--model/--effort decision
  hook       Native hook protocol on stdin/stdout
  doctor     Separate package, client trust/load, and runtime readiness
  install    Show a client plan; add --apply to change settings
  uninstall  Show owned removals; add --apply to remove them
  audit      Read private metadata; --public emits aggregate-only JSON
  record     Record a normalized observation from stdin (not provider proof)
  run        Launch --client with supported native limits; use -- before args

Options: --client codex|claude|kimi|agy --home PATH --state-dir PATH
         --policy FILE --role NAME --model ID --effort LEVEL --apply
         --public --version --help

State defaults to AGENT_POLICY_HOME or ~/.agent-policy-kit.
No command publishes code or sends prompts to an external classifier.`);
}
function clientVersion(client) {
  const result = spawnSync(client, ['--version'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
  const match = (result.stdout ?? '').match(/\b\d+\.\d+\.\d+\b/);
  return result.status === 0 && match ? match[0] : null;
}
async function doctor(clients, home, stateDir, policy) {
  const report = {
    schemaVersion: 1,
    package: { status: 'pass', version: packageInfo.version, mode: fs.existsSync(path.join(packageRoot, '.git')) ? 'development-checkout' : 'installed-package' },
    clients: {},
  };
  for (const client of clients) {
    const version = clientVersion(client);
    const receipt = path.join(stateDir, 'installations', `${client}.json`);
    const installed = fs.existsSync(receipt);
    const native = client === 'codex' || client === 'claude';
    let binding = { status: 'not_checked', reason: 'requires_native_event' };
    if (client === 'kimi') {
      const { verifyBinding } = await import('../src/bindings.mjs');
      const results = await Promise.all(Object.values(policy.clients.kimi?.profiles ?? {}).map(p =>
        verifyBinding('kimi', { model: p.model }, { home, cwd: process.cwd() }, policy)));
      binding = { status: results.length && results.every(r => r.status === 'verified') ? 'pass' : 'not_ready', reason: 'native_pool_prerequisite' };
    }
    report.clients[client] = {
      available: Boolean(version), version, configured: installed, policyMode: policy.mode,
      clientTrust: { status: installed ? 'requires_native_review_or_load_check' : 'not_configured' },
      runtime: client === 'agy' ? { status: 'unsupported', reason: 'tier_is_not_exact_model' }
        : { status: 'not_checked', reason: 'configuration_is_not_model_execution', binding },
      coverage: {
        requestedModels: client === 'agy' ? 'unsupported' : 'supported_hook_paths',
        concurrency: native ? 'native_limit_with_client_exceptions' : client === 'kimi' ? 'AgentSwarm_only_via_run' : 'coordination_only',
        providerModelProof: 'not_claimed', resume: 'not_claimed',
      },
    };
  }
  return report;
}

async function main() {
  const separator = rawArgs.indexOf('--');
  const parsedArgs = separator < 0 ? rawArgs : rawArgs.slice(0, separator);
  const passArgs = separator < 0 ? [] : rawArgs.slice(separator + 1);
  const { values: opts, positionals } = parseArgs({ args: parsedArgs, allowPositionals: true, strict: true, options: {
    client: { type: 'string' }, home: { type: 'string' }, 'state-dir': { type: 'string' }, policy: { type: 'string' },
    role: { type: 'string' }, model: { type: 'string' }, effort: { type: 'string' },
    apply: { type: 'boolean', default: false }, public: { type: 'boolean', default: false },
    version: { type: 'boolean' }, help: { type: 'boolean' },
  } });
  const command = positionals[0];
  if (opts.version) { console.log(packageInfo.version); return; }
  if (opts.help || !command || command === 'help') { help(); return; }
  if (positionals.length !== 1) throw failure('UNEXPECTED_ARGUMENT');
  const home = path.resolve(opts.home ?? os.homedir());
  const selectedState = opts['state-dir'] ?? process.env.AGENT_POLICY_HOME ?? path.join(home, '.agent-policy-kit');
  if (!path.isAbsolute(selectedState)) throw failure('STATE_PATH_MUST_BE_ABSOLUTE');
  const stateDir = path.resolve(selectedState);
  const policyPath = opts.policy ? path.resolve(opts.policy) : fs.existsSync(path.join(stateDir, 'policy.json')) ? path.join(stateDir, 'policy.json') : builtinPolicy;
  const client = opts.client;
  if (client && !CLIENTS.includes(client)) throw failure('UNSUPPORTED_CLIENT');
  if (command === 'init') {
    if (!opts.policy) throw failure('POLICY_PATH_REQUIRED');
    const content = JSON.stringify(validatePolicy(JSON.parse(fs.readFileSync(builtinPolicy, 'utf8'))), null, 2) + '\n';
    fs.mkdirSync(path.dirname(policyPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(policyPath, content, { flag: 'wx', mode: 0o600 });
    print({ status: 'created', schemaVersion: 1 }); return;
  }
  const policy = loadPolicy(policyPath);
  if (command === 'evaluate') {
    if (!client) throw failure('CLIENT_REQUIRED');
    const result = evaluate(policy, { client, role: opts.role ?? null, model: opts.model ?? null, effort: opts.effort ?? null });
    print(result); process.exitCode = result.action === 'deny' ? 2 : result.action === 'unsupported' ? 3 : 0; return;
  }
  if (command === 'hook') {
    if (!client) throw failure('CLIENT_REQUIRED');
    const event = await stdin();
    const result = handleHook(client, event, policy);
    const matched = event?.hook_event_name === 'PreToolUse' && event?.tool_input
      && (client === 'codex' && ['spawn_agent', 'Agent'].includes(event.tool_name)
        || client === 'kimi' && ['Agent', 'AgentSwarm'].includes(event.tool_name));
    if (matched && policy.mode === 'enforce' && result.output?.hookSpecificOutput?.permissionDecision !== 'deny') {
      const { verifyBinding } = await import('../src/bindings.mjs');
      const input = result.output?.hookSpecificOutput?.updatedInput ?? event.tool_input;
      const binding = await verifyBinding(client, input, { home, cwd: process.cwd() }, policy);
      if (binding.status !== 'verified') {
        result.output = denial('native_binding_invalid');
        result.audit = { ...result.audit, action: 'deny', reason: 'native_binding_invalid' };
      }
    }
    if (result.audit) appendRecord(stateDir, result.audit, policy);
    if (result.output) print(result.output);
    process.exitCode = result.exitCode; return;
  }
  if (command === 'doctor') { print(await doctor(client ? [client] : CLIENTS, home, stateDir, policy)); return; }
  if (command === 'install') {
    if (!client) throw failure('CLIENT_REQUIRED');
    const { planInstall, applyInstall, summarizePlan } = await import('../src/install.mjs');
    const plan = await planInstall({ client, home, stateDir, policyPath, packageRoot, nodePath: process.execPath });
    print(opts.apply ? await applyInstall(plan) : summarizePlan(plan)); return;
  }
  if (command === 'uninstall') {
    if (!client) throw failure('CLIENT_REQUIRED');
    const { uninstall, summarizePlan } = await import('../src/install.mjs');
    const result = await uninstall({ client, home, stateDir, apply: opts.apply });
    print(opts.apply ? result : summarizePlan(result)); return;
  }
  if (command === 'record') { const record = await stdin(); appendRecord(stateDir, record, policy); print({ status: 'recorded', evidence: 'caller_supplied_not_provider_verified' }); return; }
  if (command === 'audit') { const records = readRecords(stateDir); print(opts.public ? publicSummary(records) : records); return; }
  if (command === 'run') {
    if (!client || !policy.clients[client]) throw failure('CLIENT_REQUIRED');
    if (client === 'agy') throw failure('AGY_EXACT_MODEL_GUARD_UNSUPPORTED');
    const max = String(policy.clients[client].maxConcurrent);
    const env = { ...process.env };
    const args = [...passArgs];
    if (client === 'kimi') env.KIMI_CODE_AGENT_SWARM_MAX_CONCURRENCY = max;
    if (client === 'claude') env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS = max;
    if (client === 'codex') args.unshift('--enable', 'hooks', '-c', `agents.max_concurrent_threads_per_session=${max}`);
    const child = spawnSync(client, args, { env, stdio: 'inherit', windowsHide: false });
    process.exitCode = Number.isInteger(child.status) ? child.status : 1; return;
  }
  throw failure('UNKNOWN_COMMAND');
}

main().catch(error => {
  if (rawArgs[0] === 'hook') { print(denial('guard_unavailable')); process.exitCode = 0; }
  else { print({ error: safeCode(error.code) }); process.exitCode = 1; }
});
