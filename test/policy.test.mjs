import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePolicy, evaluate } from '../src/policy.mjs';

const raw = JSON.parse(await readFile(new URL('../policies/balanced.json', import.meta.url), 'utf8'));
const policy = validatePolicy(raw);

test('an unpinned explorer gets the light profile without changing its input', () => {
  const request = { client: 'codex', role: 'explorer', model: null, effort: null };
  assert.deepEqual(evaluate(policy, request), {
    action: 'rewrite', reason: 'pin_profile', profile: 'light', model: 'gpt-6-luna', effort: 'high',
  });
  assert.equal(request.model, null);
});
test('a forbidden explicit model is denied even on a known role', () => {
  assert.equal(evaluate(policy, { client: 'codex', role: 'worker', model: 'gpt-6-astra', effort: 'high' }).action, 'deny');
});
test('a plugin cannot explicitly select an unknown expensive model', () => {
  const result = evaluate(policy, { client: 'claude', role: 'plugin:custom', model: 'opus', effort: 'high' });
  assert.equal(result.action, 'deny');
  assert.equal(result.reason, 'model_not_allowed');
});
test('high is a ceiling and an unrecognized effort is not treated as cheap', () => {
  for (const effort of ['xhigh', 'max', 'ultra', 'typo', 1]) {
    assert.equal(evaluate(policy, { client: 'codex', role: 'worker', model: 'gpt-6.1-sol', effort }).action, 'deny');
  }
});
test('an unknown role with an allowed explicit light model keeps that selection', () => {
  assert.equal(evaluate(policy, { client: 'codex', role: 'custom', model: 'gpt-6-luna', effort: 'high' }).action, 'allow');
});
test('an allowed wrong model on a fixed role is rewritten to the role profile', () => {
  assert.equal(evaluate(policy, { client: 'codex', role: 'reviewer', model: 'gpt-6-luna', effort: 'high' }).model, 'gpt-6.1-sol');
});
test('agy never reports exact-model enforcement from a tier label', () => {
  assert.equal(evaluate(policy, { client: 'agy', role: 'reviewer', model: 'pro', effort: null }).action, 'unsupported');
});
test('unknown policy keys and unsafe prototype keys fail before use', () => {
  for (const candidate of [{ ...raw, surprise: true }, JSON.parse('{"schemaVersion":1,"__proto__":{}}')]) {
    assert.throws(() => validatePolicy(candidate));
  }
});
test('policy rejects ambiguous role and model bindings', () => {
  const candidate = structuredClone(raw);
  candidate.clients.codex.profiles.light.roles.push('reviewer');
  assert.throws(() => validatePolicy(candidate));
});
