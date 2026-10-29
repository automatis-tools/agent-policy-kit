import { describe, expect, mock, test } from 'claude-code/testing';

const policy = {
  schemaVersion: 1, mode: 'enforce', clients: {
    claude: {
      defaultProfile: 'code', maxConcurrent: 3,
      profiles: {
        code: { model: 'sonnet', effort: 'high', roles: ['worker', 'reviewer', 'general-purpose'] },
        light: { model: 'haiku', effort: 'high', roles: ['Explore', 'explorer', 'routine'] },
      },
      deniedModels: ['opus', 'fable', 'claude-opus-5-5', 'claude-fable-5-1'],
      observedModels: ['claude-sonnet-5-5', 'claude-haiku-5-5'],
    },
  },
};
const spawn = {
  tool_use_id: 'private-tool', prompt: 'PRIVATE PROMPT', description: 'PRIVATE DESCRIPTION',
  subagentType: 'worker', provider: { plugin: 'engine', tier: 'core' },
  parentModel: 'PRIVATE PARENT MODEL', parentAgentId: 'PRIVATE PARENT ID',
  name: 'PRIVATE AGENT NAME', cwd: '/private/workspace', background: false, fork: false,
};

function setup(on, value = policy) {
  mock.store(on);
  on('fs.read', () => ({ value: JSON.stringify(value) }));
  on('command.register', ($, e) => ({ value: { command: e.name } }));
}

async function audit($) {
  return JSON.parse((await $.command.run({ command: 'agent-policy-status', args: 'audit' })).text);
}

describe('native subagent policy', () => {
  test('routes Explore to Haiku before starting the downstream subagent', async ($, on) => {
    setup(on);
    on('agent.spawn', ($, e) => ({ model: e.model, agentId: 'private-child' }));
    const result = await $.agent.spawn({ ...spawn, subagentType: 'Explore', model: 'sonnet' });
    expect(result.model).toBe('haiku');
  });

  test('pins a known role over a conflicting permitted model', async ($, on) => {
    setup(on);
    on('agent.spawn', ($, e) => ({ model: e.model }));
    expect((await $.agent.spawn({ ...spawn, subagentType: 'reviewer', model: 'haiku' })).model).toBe('sonnet');
  });

  test('uses the fixed default profile for unknown roles and absent models', async ($, on) => {
    setup(on);
    on('agent.spawn', ($, e) => ({ model: e.model }));
    expect((await $.agent.spawn({ ...spawn, subagentType: 'unrecognized-private-role' })).model).toBe('sonnet');
  });

  test('an incomplete native event cannot bypass fork checks', async ($, on) => {
    setup(on);
    on('agent.spawn', ($, e) => ({ model: e.model }));
    // The test engine dispatches whole events, rather than the partial public
    // $.agent.spawn call shape. Missing pinned fork metadata is unprovable.
    expect((await $.agent.spawn({ prompt: 'PRIVATE PROMPT', subagentType: 'Explore' })).deny).toBe('Agent policy refused this subagent spawn.');
  });

  for (const model of ['opus', 'fable', 'claude-opus-5-5', 'claude-fable-5-1', 'PRIVATE UNKNOWN MODEL']) {
    test(`refuses a forbidden or unrecognized model (${model === 'PRIVATE UNKNOWN MODEL' ? 'unknown' : model})`, async ($, on) => {
      setup(on);
      on('agent.spawn', () => ({ model: 'BAD' }));
      expect((await $.agent.spawn({ ...spawn, model })).deny).toBe('Agent policy refused this subagent spawn.');
    });
  }

  test('blocks forks whose inherited model cannot be pinned', async ($, on) => {
    setup(on);
    on('agent.spawn', () => ({ model: 'BAD' }));
    expect((await $.agent.spawn({ ...spawn, fork: true, model: 'sonnet' })).deny).toBe('Agent policy refused this subagent spawn.');
    expect((await audit($)).records[0].reason).toBe('fork_model_unprovable');
  });

  test('observe mode passes the original fork and model through', async ($, on) => {
    setup(on, { ...policy, mode: 'observe' });
    on('agent.spawn', ($, e) => ({ model: e.model }));
    expect((await $.agent.spawn({ ...spawn, fork: true, model: 'opus' })).model).toBe('opus');
    const record = (await audit($)).records[0];
    expect(record.action).toBe('observe');
    expect(record.reason).toBe('fork_model_unprovable');
  });

  for (const value of [{ ...policy, unknown: 'PRIVATE CONFIG' }, { schemaVersion: 42 }, { ...policy, clients: {} }]) {
    test('invalid policy fails closed with a fixed denial', async ($, on) => {
      setup(on, value);
      on('agent.spawn', () => ({ model: 'BAD' }));
      expect((await $.agent.spawn(spawn)).deny).toBe('Agent policy refused this subagent spawn.');
    });
  }

  test('read errors fail closed without disclosing error or path', async ($, on) => {
    mock.store(on);
    on('fs.read', () => { throw new Error('/private/SECRET POLICY missing'); });
    on('agent.spawn', () => ({ model: 'BAD' }));
    const result = await $.agent.spawn(spawn);
    expect(result).toEqual({ deny: 'Agent policy refused this subagent spawn.' });
  });

  test('malformed JSON policy does not escape as an exception or raw context', async ($, on) => {
    mock.store(on);
    on('fs.read', () => ({ value: '{"PRIVATE /private/policy":' }));
    on('agent.spawn', () => ({ model: 'BAD' }));
    expect(await $.agent.spawn(spawn)).toEqual({ deny: 'Agent policy refused this subagent spawn.' });
  });

  test('records canonical client model separately and excludes private input', async ($, on) => {
    setup(on);
    on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'PRIVATE CHILD ID' }));
    await $.agent.spawn({ ...spawn, model: 'sonnet' });
    const result = await audit($);
    expect(result.records).toEqual([{
      schemaVersion: 1, client: 'claude', action: 'allow', reason: 'profile_allowed',
      profile: 'code', requestedModel: 'sonnet', reportedModel: 'claude-sonnet-5-5', source: 'client_reported',
    }]);
    expect(JSON.stringify(result).includes('PRIVATE')).toBe(false);
    expect(JSON.stringify(result).includes('/private/')).toBe(false);
  });

  test('masks arbitrary requested and reported model strings in the private store', async ($, on) => {
    const values = new Map();
    on('store.set', ($, e) => { values.set(e.key, e.value); return { value: undefined }; });
    on('store.get', ($, e) => ({ value: values.get(e.key) }));
    on('store.keys', () => ({ value: [...values.keys()] }));
    on('store.delete', ($, e) => { values.delete(e.key); return { value: undefined }; });
    on('fs.read', () => ({ value: JSON.stringify({ ...policy, mode: 'observe' }) }));
    on('agent.spawn', () => ({ model: 'PRIVATE RESULT MODEL' }));
    await $.agent.spawn({ ...spawn, model: 'PRIVATE UNKNOWN MODEL' });
    const keys = [...values.keys()];
    expect(keys.length).toBe(1);
    const record = values.get(keys[0]);
    expect(record.requestedModel).toBe('unrecognized');
    expect(record.reportedModel).toBe('unrecognized');
    expect(JSON.stringify(record).includes('PRIVATE')).toBe(false);
    expect(keys[0].includes('private')).toBe(false);
  });

  test('audit store failure cannot bypass enforce checks or block an observing spawn', async ($, on) => {
    on('fs.read', () => ({ value: JSON.stringify({ ...policy, mode: 'observe' }) }));
    on('store.keys', () => { throw new Error('PRIVATE STORE ERROR'); });
    on('agent.spawn', ($, e) => ({ model: e.model }));
    expect((await $.agent.spawn({ ...spawn, model: 'opus' })).model).toBe('opus');
  });

  test('store failure cannot make enforce mode allow a forbidden model', async ($, on) => {
    on('fs.read', () => ({ value: JSON.stringify(policy) }));
    on('store.set', () => { throw new Error('PRIVATE STORE ERROR'); });
    on('agent.spawn', () => ({ model: 'BAD' }));
    expect((await $.agent.spawn({ ...spawn, model: 'opus' })).deny).toBe('Agent policy refused this subagent spawn.');
  });

  test('observing a failed downstream spawn neither retries nor returns a policy denial', async ($, on) => {
    setup(on, { ...policy, mode: 'observe' });
    let starts = 0;
    on('agent.spawn', () => { starts += 1; throw new Error('downstream failure'); });
    await expect($.agent.spawn({ ...spawn, model: 'opus' })).rejects.toThrow('no implementation for agent.spawn');
    expect(starts).toBe(1);
    expect((await audit($)).records[0].reason).toBe('spawn_failed');
  });

  test('a validated observe dispatch stays observing if the policy read later fails', async ($, on) => {
    mock.store(on);
    let reads = 0;
    on('fs.read', () => {
      reads += 1;
      if (reads > 1) throw new Error('policy changed during dispatch');
      return { value: JSON.stringify({ ...policy, mode: 'observe' }) };
    });
    let starts = 0;
    on('agent.spawn', () => { starts += 1; throw new Error('downstream failure'); });
    await expect($.agent.spawn({ ...spawn, model: 'opus' })).rejects.toThrow('no implementation for agent.spawn');
    expect(starts).toBe(1);
  });

  test('a downstream error becomes a fixed safe denial in enforce mode', async ($, on) => {
    setup(on);
    on('agent.spawn', () => { throw new Error('PRIVATE DOWNSTREAM ERROR /private/context'); });
    expect(await $.agent.spawn({ ...spawn, model: 'sonnet' })).toEqual({ deny: 'Agent policy refused this subagent spawn.' });
    expect((await audit($)).records[0].reason).toBe('spawn_failed');
  });

  test('canonical requested model is routed to its selected role alias', async ($, on) => {
    setup(on);
    on('agent.spawn', ($, e) => ({ model: e.model }));
    expect((await $.agent.spawn({ ...spawn, model: 'claude-sonnet-5-5' })).model).toBe('sonnet');
    expect((await audit($)).records[0].requestedModel).toBe('claude-sonnet-5-5');
  });

  test('bounded audit retains independent records without a mutable counter', { timeoutMs: 15000 }, async ($, on) => {
    setup(on);
    on('agent.spawn', ($, e) => ({ model: e.model }));
    for (let index = 0; index < 132; index += 1) await $.agent.spawn({ ...spawn, model: 'sonnet' });
    const result = await audit($);
    expect(result.records.length).toBe(128);
    expect(result.actions.allow).toBe(128);
    expect(result.completeLedger).toBe(false);
  });

  test('concurrent spawns keep distinct audit records', async ($, on) => {
    setup(on);
    on('agent.spawn', ($, e) => ({ model: e.model }));
    await Promise.all(Array.from({ length: 12 }, () => $.agent.spawn({ ...spawn, model: 'sonnet' })));
    expect((await audit($)).records.length).toBe(12);
  });

  test('concurrent retention during export cannot fabricate a denial', async ($, on) => {
    const record = {
      schemaVersion: 1, client: 'claude', action: 'allow', reason: 'profile_allowed',
      profile: 'code', requestedModel: 'sonnet', reportedModel: 'sonnet', source: 'client_reported',
    };
    const values = new Map(Array.from({ length: 128 }, (_, index) => [
      `audit-v1:${index.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`, record,
    ]));
    let snapshotTaken;
    let resumeExport;
    const listed = new Promise(resolve => { snapshotTaken = resolve; });
    const resume = new Promise(resolve => { resumeExport = resolve; });
    let pauseNextList = true;
    on('fs.read', () => ({ value: JSON.stringify(policy) }));
    on('store.set', ($, e) => { values.set(e.key, e.value); return { value: undefined }; });
    on('store.get', ($, e) => ({ value: values.get(e.key) }));
    on('store.delete', ($, e) => { values.delete(e.key); return { value: undefined }; });
    on('store.keys', async () => {
      const keys = [...values.keys()];
      if (pauseNextList) {
        pauseNextList = false;
        snapshotTaken();
        await resume;
      }
      return { value: keys };
    });
    on('agent.spawn', ($, e) => ({ model: e.model }));

    const pendingExport = audit($);
    await listed;
    // This real policy dispatch appends record 129 and prunes the first key
    // from the snapshot the export is about to read.
    await $.agent.spawn({ ...spawn, model: 'sonnet' });
    resumeExport();
    const result = await pendingExport;
    expect(result.records.length).toBe(127);
    expect(result.actions).toEqual({ allow: 127, rewrite: 0, deny: 0, observe: 0 });
    expect(result.completeLedger).toBe(false);
    expect(JSON.stringify(result).includes('audit-v1:')).toBe(false);
    expect(JSON.stringify(result).includes('PRIVATE')).toBe(false);
  });

  test('audit export strips poisoned old record fields and strings', async ($, on) => {
    mock.store(on, {
      'audit-v1:11111111-1111-4111-8111-111111111111': {
        schemaVersion: 42, client: 'PRIVATE', action: 'PRIVATE', reason: 'PRIVATE', profile: '/private/profile',
        requestedModel: '/private/model', reportedModel: 'PRIVATE', source: 'provider_reported', prompt: 'PRIVATE PROMPT',
      },
      'private-id-key': { prompt: 'PRIVATE' },
    });
    on('fs.read', () => ({ value: JSON.stringify(policy) }));
    const result = await audit($);
    expect(result.records).toEqual([{
      schemaVersion: 1, client: 'claude', action: 'deny', reason: 'invalid_policy', profile: 'custom',
      requestedModel: 'unrecognized', reportedModel: 'unrecognized', source: 'unavailable',
    }]);
    expect(JSON.stringify(result).includes('PRIVATE')).toBe(false);
    expect(JSON.stringify(result).includes('/private/')).toBe(false);
  });

  test('status is local and advertises only supported coverage', async ($, on) => {
    setup(on);
    const status = JSON.parse((await $.command.run({ command: 'agent-policy-status' })).text);
    expect(status.client).toBe('claude');
    expect(status.capabilities).toEqual({ spawnModel: true, spawnEffort: false, forks: 'deny_in_enforce', resume: false, perStep: false, mainTurnModified: false });
    expect(status.audit.completeLedger).toBe(false);
    expect(status.audit.records).toBe(0);
  });

  test('session startup registers the local command and keeps the session cwd', async ($, on) => {
    mock.store(on);
    on('fs.read', () => ({ value: JSON.stringify(policy) }));
    const commands = [];
    on('command.register', ($, e) => { commands.push(e.name); return { value: { command: e.name } }; });
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    expect(await $.session.start({ cwd: '/private/workspace', surface: null, isInteractive: false })).toEqual({ cwd: '/private/workspace' });
    expect(commands).toEqual(['agent-policy-status']);
  });

  test('status errors disclose only a fixed unavailable reason', async ($, on) => {
    mock.store(on);
    on('fs.read', () => { throw new Error('PRIVATE /private/policy'); });
    expect(JSON.parse((await $.command.run({ command: 'agent-policy-status' })).text)).toEqual({
      schemaVersion: 1, client: 'claude', status: 'unavailable', reason: 'policy_or_audit_unavailable',
    });
  });

  test('leaves main model and effort unchanged', async ($, on) => {
    setup(on);
    on('turn.step', async function* ($, e) {
      return { turnId: e.turnId, index: e.index, answer: `${e.model}:${e.effort}`, toolUses: [], stopReason: 'end_turn', usage: null };
    });
    const stream = $.turn.step({ turnId: 'private-main-turn', index: 0, model: 'opus', effort: 'max', messageCount: 1 });
    const final = await stream.next();
    expect(final.done).toBe(true);
    expect(final.value.answer).toBe('opus:max');
  });
});
