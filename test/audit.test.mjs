import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validatePolicy } from '../src/policy.mjs';
import { appendRecord, readRecords, publicSummary } from '../src/audit.mjs';
const policy = validatePolicy(JSON.parse(fs.readFileSync(new URL('../policies/balanced.json', import.meta.url))));
function dir(t) { const p = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'policy-audit-')); t.after(() => fs.rmSync(p, { recursive: true, force: true })); return p; }

test('audit allowlist strips prompts, arguments, user paths and unknown model strings', t => {
  const state = dir(t);
  appendRecord(state, { client: 'codex', kind: 'decision', action: 'deny', reason: 'model_not_allowed', role: 'private-customer', requestedModel: 'PRIVATE_KEY', sessionId: 'PRIVATE_SESSION', cwd: '/private/customer', prompt: 'PRIVATE_PROMPT', tool_input: { secret: 'PRIVATE_ARGUMENT' } }, policy);
  const text = JSON.stringify(readRecords(state));
  for (const secret of ['PRIVATE_KEY', 'PRIVATE_SESSION', 'PRIVATE_PROMPT', 'PRIVATE_ARGUMENT', '/private/customer', 'private-customer']) assert.equal(text.includes(secret), false);
  assert.equal(readRecords(state)[0].requestedModel, 'unrecognized');
});
test('requested and client-reported models remain separate', t => {
  const state = dir(t);
  appendRecord(state, { client: 'agy', kind: 'observation', action: 'unsupported', reason: 'tier_not_model', requestedModel: 'pro', reportedModel: 'gemini-3.8-flash-tiered', source: 'client_reported' }, policy);
  const [record] = readRecords(state);
  assert.equal(record.requestedModel, 'pro');
  assert.equal(record.reportedModel, 'gemini-3.8-flash-tiered');
  assert.equal(record.source, 'client_reported');
});
test('public export aggregates and removes identifiers and activity timestamps', t => {
  const state = dir(t);
  appendRecord(state, { client: 'codex', kind: 'decision', action: 'allow', reason: 'profile_allowed', sessionId: 'secret-id', requestedModel: 'gpt-6.1-sol', tokens: { input: 10, output: 2, surprise: 'SECRET' } }, policy);
  const got = publicSummary(readRecords(state));
  assert.equal(got.records, 1);
  assert.equal(got.groups[0].inputTokens, 10);
  assert.equal(JSON.stringify(got).includes('session'), false);
  assert.equal(JSON.stringify(got).includes('timestamp'), false);
});
test('audit refuses a symlinked data directory', t => {
  const state = dir(t); const other = dir(t); const linked = path.join(state, 'link');
  fs.symlinkSync(other, linked, 'dir');
  assert.throws(() => appendRecord(linked, { client: 'codex' }, policy));
});
