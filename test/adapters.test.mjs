import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatePolicy } from '../src/policy.mjs';
import { handleHook } from '../src/adapters.mjs';
const policy = validatePolicy(JSON.parse(await readFile(new URL('../policies/balanced.json', import.meta.url))));
const event = (tool, input, extra = {}) => ({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input, ...extra });

test('Codex rewrites only spawn parameters and preserves a private task unchanged', () => {
  const input = { agent_type: 'explorer', message: 'PRIVATE_TASK', fork_turns: 'none' };
  const got = handleHook('codex', event('spawn_agent', input), policy);
  assert.equal(got.output.hookSpecificOutput.permissionDecision, 'allow');
  assert.deepEqual(got.output.hookSpecificOutput.updatedInput, { ...input, model: 'gpt-6-luna', reasoning_effort: 'high' });
  assert.equal(JSON.stringify(got.audit).includes('PRIVATE_TASK'), false);
  assert.equal(input.model, undefined);
});
test('Claude denies Opus even for an installed plugin role', () => {
  const got = handleHook('claude', event('Agent', { subagent_type: 'plugin:custom', model: 'opus' }), policy);
  assert.equal(got.output.hookSpecificOutput.permissionDecision, 'deny');
});
test('Kimi asks for an explicit pool alias without emitting unsupported updatedInput', () => {
  const got = handleHook('kimi', event('Agent', { subagent_type: 'explore', prompt: 'PRIVATE' }), policy);
  assert.equal(got.output.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(got.output.hookSpecificOutput.updatedInput, undefined);
  assert.match(got.output.hookSpecificOutput.permissionDecisionReason, /subagent-light/);
});
test('Kimi allows an explicitly selected alias without inventing a tool effort parameter', () => {
  assert.equal(handleHook('kimi', event('Agent', { subagent_type: 'explore', model: 'subagent-light' }), policy).output, null);
});
test('unrelated tools are not blocked by a subagent gate', () => {
  assert.equal(handleHook('codex', event('Bash', { command: 'echo PRIVATE' }), policy).output, null);
});
test('observer mode does not change a forbidden call', () => {
  const observe = validatePolicy({ ...policy, mode: 'observe' });
  const got = handleHook('codex', event('spawn_agent', { model: 'gpt-6-astra' }), observe);
  assert.equal(got.output, null);
  assert.equal(got.audit.action, 'deny');
  assert.equal(got.audit.enforced, false);
});
test('observer mode also leaves malformed target input unblocked', () => {
  const observe = validatePolicy({ ...policy, mode: 'observe' });
  assert.equal(handleHook('codex', event('spawn_agent', 'malformed'), observe).output, null);
});
test('observation records never infer a reported model from the request', () => {
  const got = handleHook('codex', { hook_event_name: 'PostToolUse', tool_name: 'spawn_agent', tool_input: { model: 'gpt-6.1-sol' } }, policy);
  assert.equal(got.audit.reportedModel, null);
  assert.equal(got.audit.source, 'unavailable');
});
test('PostToolUse caller model is not reported as the spawned child model', () => {
  const got = handleHook('codex', { hook_event_name: 'PostToolUse', tool_name: 'spawn_agent', model: 'gpt-6.1-sol', tool_input: { model: 'gpt-6-luna' } }, policy);
  assert.equal(got.audit.reportedModel, null); assert.equal(got.audit.source, 'unavailable');
});
test('malformed targeted arguments receive a fixed denial without echoing secrets', () => {
  const got = handleHook('codex', event('spawn_agent', 'PRIVATE_CREDENTIAL'), policy);
  assert.equal(got.output.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(JSON.stringify(got).includes('PRIVATE_CREDENTIAL'), false);
});
