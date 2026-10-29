import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from '../hooks/register.mjs';

function hooks(options = {}) {
  const handlers = new Map();
  register((event, matcher, handler) => {
    const entry = { run: handler ?? matcher, fallback: null };
    handlers.set(event, entry);
    return { catch(fallback) { entry.fallback = fallback; } };
  }, options);
  return handlers;
}

test('native gating failure has an explicit fixed fallback', async () => {
  const entry = hooks().get('agent.spawn');
  assert.equal(typeof entry.fallback, 'function');
  const engine = { fs: { read() { throw new Error('PRIVATE /private/config'); } } };
  assert.deepEqual(await entry.fallback(engine, {}, () => { throw new Error('must not start'); }), {
    deny: 'Agent policy refused this subagent spawn.',
  });
});

test('custom policy paths reject relative paths before reading local files', async () => {
  let reads = 0;
  const entry = hooks({ policyPath: '../private/policy.json' }).get('agent.spawn');
  const engine = {
    fs: { read() { reads += 1; } },
    store: { set() { throw new Error('store unavailable'); } },
  };
  assert.deepEqual(await entry.run(engine, { model: 'sonnet' }, () => { throw new Error('must not start'); }), {
    deny: 'Agent policy refused this subagent spawn.',
  });
  assert.equal(reads, 0);
});
