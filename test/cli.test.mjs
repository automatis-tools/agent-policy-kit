import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const bin = new URL('../bin/agent-policy.mjs', import.meta.url);
function temp(t) { const p = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "policy cli's ")); t.after(() => fs.rmSync(p, { recursive: true, force: true })); return p; }
function run(args, input, env = {}) { return spawnSync(process.execPath, [fileURLToPath(bin), ...args], { input, encoding: 'utf8', env: { ...process.env, ...env } }); }

test('installed-style CLI evaluates a forbidden model without echoing the task', () => {
  const got = run(['evaluate', '--client', 'codex', '--model', 'gpt-6-astra', '--effort', 'high']);
  assert.equal(got.status, 2);
  assert.equal(JSON.parse(got.stdout).action, 'deny');
});
test('hook converts malformed stdin into a valid fixed deny response', t => {
  const got = run(['hook', '--client', 'codex', '--state-dir', temp(t)], 'PRIVATE_INVALID_JSON');
  assert.equal(got.status, 0);
  assert.equal(JSON.parse(got.stdout).hookSpecificOutput.permissionDecision, 'deny');
  assert.equal((got.stdout + got.stderr).includes('PRIVATE_INVALID_JSON'), false);
});
test('hook enforces the policy and writes only sanitized metadata', t => {
  const state = temp(t);
  const got = run(['hook', '--client', 'codex', '--state-dir', state], JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'spawn_agent', session_id: 'PRIVATE_SESSION', tool_input: { message: 'PRIVATE_TASK', model: 'gpt-6-astra' } }));
  assert.equal(got.status, 0);
  assert.equal(JSON.parse(got.stdout).hookSpecificOutput.permissionDecision, 'deny');
  const exported = run(['audit', '--state-dir', state, '--public']);
  assert.equal(exported.status, 0);
  assert.equal(JSON.parse(exported.stdout).records, 1);
  assert.equal(exported.stdout.includes('PRIVATE'), false);
});
test('init refuses to overwrite an existing policy', t => {
  const p = path.join(temp(t), 'policy.json');
  assert.equal(run(['init', '--policy', p]).status, 0);
  fs.writeFileSync(p, 'PRIVATE_CONTENT');
  assert.notEqual(run(['init', '--policy', p]).status, 0);
  assert.equal(fs.readFileSync(p, 'utf8'), 'PRIVATE_CONTENT');
});
test('doctor separates package, client trust and model-runtime outcomes', t => {
  const got = run(['doctor', '--client', 'agy', '--home', temp(t), '--state-dir', temp(t)]);
  const report = JSON.parse(got.stdout);
  assert.equal(report.package.status, 'pass');
  assert.equal(report.clients.agy.runtime.status, 'unsupported');
  assert.notEqual(report.clients.agy.clientTrust.status, 'pass');
});
