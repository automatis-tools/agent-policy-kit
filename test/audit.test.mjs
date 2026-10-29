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
test('audit inspection refuses injected fields instead of exporting their private values', t => {
  const state = dir(t);
  const file = appendRecord(state, { client: 'codex', action: 'allow' }, policy);
  const record = JSON.parse(fs.readFileSync(file)); record.prompt = 'PRIVATE_INJECTED_PROMPT';
  fs.writeFileSync(file, JSON.stringify(record));
  assert.throws(() => readRecords(state, policy));
});
test('audit inspection masks a tampered unknown model using the current allowlist', t => {
  const state = dir(t);
  const file = appendRecord(state, { client: 'codex', action: 'allow' }, policy);
  const record = JSON.parse(fs.readFileSync(file)); record.reportedModel = 'PRIVATE_INJECTED_KEY';
  fs.writeFileSync(file, JSON.stringify(record));
  assert.equal(readRecords(state, policy)[0].reportedModel, 'unrecognized');
});
test('missing token evidence stays unknown rather than reporting free usage', t => {
  const state = dir(t);
  appendRecord(state, { client: 'codex', action: 'allow' }, policy);
  const records = readRecords(state, policy);
  assert.equal(records[0].tokens.input, null);
  assert.equal(publicSummary(records).groups[0].inputTokens, null);
});
test('audit inspection rejects private nested fields in token metadata', t => {
  const state = dir(t);
  const file = appendRecord(state, { client: 'codex', action: 'allow' }, policy);
  const record = JSON.parse(fs.readFileSync(file)); record.tokens.prompt = 'PRIVATE_NESTED';
  fs.writeFileSync(file, JSON.stringify(record));
  assert.throws(() => readRecords(state, policy));
});
test('events form one inspectable JSONL journal with no correlation identifiers', t => {
  const state = dir(t);
  const first = appendRecord(state, { client: 'codex', action: 'allow', sessionId: 'private-session', agentId: 'private-agent' }, policy);
  const second = appendRecord(state, { client: 'codex', action: 'deny' }, policy);
  assert.equal(first, second);
  assert.equal(fs.readFileSync(first, 'utf8').trim().split('\n').length, 2);
  const [record] = readRecords(state, policy);
  assert.equal(Object.hasOwn(record, 'session'), false); assert.equal(Object.hasOwn(record, 'agent'), false);
});
test('another writer creating a private directory does not lose a valid event', t => {
  const state = path.join(dir(t), 'new-state');
  const mkdir = fs.mkdirSync;
  fs.mkdirSync = (p, options) => {
    if (p === state) { mkdir(p, options); throw Object.assign(new Error('another writer won'), { code: 'EEXIST' }); }
    return mkdir(p, options);
  };
  try { appendRecord(state, { client: 'codex', action: 'allow' }, policy); }
  finally { fs.mkdirSync = mkdir; }
  assert.equal(readRecords(state, policy).length, 1);
});
