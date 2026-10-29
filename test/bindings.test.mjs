import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { validatePolicy } from '../src/policy.mjs';
import { verifyBinding } from '../src/bindings.mjs';
const policy = validatePolicy(JSON.parse(fs.readFileSync(new URL('../policies/balanced.json', import.meta.url))));
function home(t) { const p = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'policy-binding-')); t.after(() => fs.rmSync(p, { recursive: true, force: true })); return p; }
test('a Kimi alias pointing at the wrong upstream model is not approved', async t => {
  const p = home(t); fs.mkdirSync(path.join(p, '.kimi-code'));
  fs.writeFileSync(path.join(p, '.kimi-code/config.toml'), '[secondary_model]\ndefault_model="subagent-code"\n[models.subagent-code]\nmodel="unexpected-expensive-model"\ndefault_effort="high"\n');
  assert.equal((await verifyBinding('kimi', { model: 'subagent-code' }, { home: p, cwd: p }, policy)).status, 'invalid');
});
test('Kimi validates effective per-entry effort instead of the main effort', async t => {
  const p = home(t); fs.mkdirSync(path.join(p, '.kimi-code'));
  fs.writeFileSync(path.join(p, '.kimi-code/config.toml'), '[thinking]\neffort="max"\n[secondary_model]\ndefault_model="subagent-light"\n[models.subagent-light]\nmodel="kimi-for-coding"\n[models.subagent-light.overrides]\ndefault_effort="low"\n');
  assert.equal((await verifyBinding('kimi', { model: 'subagent-light' }, { home: p, cwd: p }, policy)).status, 'verified');
});
test('a fixed Codex role cannot override the gate with Astra', async t => {
  const p = home(t); fs.mkdirSync(path.join(p, '.codex/agents'), { recursive: true });
  fs.writeFileSync(path.join(p, '.codex/agents/reviewer.toml'), 'name="reviewer"\nmodel="gpt-6-astra"\nmodel_reasoning_effort="high"\n');
  assert.equal((await verifyBinding('codex', { agent_type: 'reviewer', model: 'gpt-6.1-sol', reasoning_effort: 'high' }, { home: p, cwd: p }, policy)).status, 'invalid');
});
test('missing Kimi setup is unsupported, not a verified native binding', async t => {
  const p = home(t);
  assert.equal((await verifyBinding('kimi', { model: 'subagent-code' }, { home: p, cwd: p }, policy)).status, 'unsupported');
});
