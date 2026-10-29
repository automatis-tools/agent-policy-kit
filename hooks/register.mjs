import { evaluate, validatePolicy } from '../src/policy.mjs';

const DENIAL = 'Agent policy refused this subagent spawn.';
const RETENTION = 128;
const KEY = /^audit-v1:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MODELS = Object.freeze([
  'sonnet', 'haiku', 'opus', 'fable',
  'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5', 'claude-fable-5-1',
]);
const REASONS = Object.freeze([
  'profile_allowed', 'pin_profile', 'model_not_allowed', 'fork_model_unprovable',
  'invalid_policy', 'unsupported_client', 'malformed_spawn', 'spawn_failed',
]);

function modelName(value) {
  return value === undefined || value === null ? null : MODELS.includes(value) ? value : 'unrecognized';
}

// Treat the store as untrusted on export, too. Never export keys, IDs, paths or
// extra fields, even if an older version or another local writer stored them.
function metadata(value) {
  return {
    schemaVersion: 1,
    client: 'claude',
    action: ['allow', 'rewrite', 'deny', 'observe'].includes(value?.action) ? value.action : 'deny',
    reason: REASONS.includes(value?.reason) ? value.reason : 'invalid_policy',
    profile: value?.profile === null || value?.profile === undefined ? null
      : ['code', 'light'].includes(value.profile) ? value.profile : 'custom',
    requestedModel: modelName(value?.requestedModel),
    reportedModel: modelName(value?.reportedModel),
    source: ['requested', 'client_reported', 'unavailable'].includes(value?.source) ? value.source : 'unavailable',
  };
}

async function readPolicy($, options) {
  const custom = options.policyPath ?? '';
  if (typeof custom !== 'string' || custom.includes('\0')
    || (custom && (!/^(?:\/(?!\/)|[A-Za-z]:[\\/])/.test(custom)))) throw new Error('Invalid policy.');
  const raw = await $.fs.read(custom || `${$.plugin.root}/policies/balanced.json`);
  if (typeof raw !== 'string' || raw.length > 131072) throw new Error('Invalid policy.');
  const policy = validatePolicy(JSON.parse(raw));
  if (!policy.clients.claude) throw new Error('Invalid policy.');
  return policy;
}

async function appendAudit($, record) {
  try {
    // Independent keys avoid the lost updates of a mutable counter or array.
    await $.store.set(`audit-v1:${crypto.randomUUID()}`, metadata(record));
    const keys = (await $.store.keys()).filter(key => KEY.test(key));
    for (const key of keys.slice(0, Math.max(0, keys.length - RETENTION))) await $.store.delete(key);
    return true;
  } catch {
    // Audit availability never changes policy enforcement or observation.
    return false;
  }
}

async function readAudit($) {
  const keys = (await $.store.keys()).filter(key => KEY.test(key)).slice(-RETENTION);
  const records = [];
  for (const key of keys) records.push(metadata(await $.store.get(key)));
  const actions = { allow: 0, rewrite: 0, deny: 0, observe: 0 };
  for (const record of records) actions[record.action] += 1;
  return { records, actions, retentionLimit: RETENTION, completeLedger: false, persistence: 'native_plugin_store' };
}

export function register(on, options = {}) {
  const observingEvents = new WeakSet();
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: 'agent-policy-status', description: 'Show local policy status or metadata audit', argumentHint: '[audit]' });
    } catch {
      // A display command must never interrupt a session's startup.
    }
    return next(e);
  });

  on('command.run', { command: 'agent-policy-status' }, async ($, e) => {
    try {
      const policy = await readPolicy($, options);
      const audit = await readAudit($);
      if (e.args?.trim() === 'audit') return { text: JSON.stringify({ schemaVersion: 1, client: 'claude', ...audit }) };
      return { text: JSON.stringify({
        schemaVersion: 1, client: 'claude', mode: policy.mode,
        defaultProfile: ['code', 'light'].includes(policy.clients.claude.defaultProfile) ? policy.clients.claude.defaultProfile : 'custom',
        capabilities: {
          spawnModel: true, spawnEffort: false, forks: 'deny_in_enforce',
          resume: false, perStep: false, mainTurnModified: false,
        },
        audit: { ...audit, records: audit.records.length },
      }) };
    } catch {
      return { text: JSON.stringify({ schemaVersion: 1, client: 'claude', status: 'unavailable', reason: 'policy_or_audit_unavailable' }) };
    }
  });

  on('agent.spawn', async ($, e, next) => {
    let policy;
    let decision;
    try {
      policy = await readPolicy($, options);
      decision = evaluate(policy, { client: 'claude', role: e.subagentType, model: e.model });
      // No effort exists on agent.spawn. Classify this model-only decision
      // without implying that the policy's effort value was enforced.
      if (decision.action === 'rewrite' && e.model === decision.model) {
        decision = { ...decision, action: 'allow', reason: 'profile_allowed' };
      }
      if (e.fork === true) decision = { ...decision, action: 'deny', reason: 'fork_model_unprovable' };
      else if ((e.model !== undefined && typeof e.model !== 'string')
        || typeof e.fork !== 'boolean' || typeof e.subagentType !== 'string') {
        decision = { action: 'deny', reason: 'malformed_spawn', profile: null };
      }
    } catch {
      await appendAudit($, { action: 'deny', reason: 'invalid_policy', requestedModel: e.model, source: 'requested' });
      return { deny: DENIAL };
    }

    const observing = policy.mode === 'observe';
    if (observing) observingEvents.add(e);
    const record = {
      action: observing ? 'observe' : decision.action,
      reason: decision.reason, profile: decision.profile,
      requestedModel: e.model, reportedModel: null, source: 'requested',
    };
    if (!observing && !['allow', 'rewrite'].includes(decision.action)) {
      await appendAudit($, record);
      return { deny: DENIAL };
    }

    // Observer mode must preserve the exact downstream call and its errors.
    if (observing) {
      try {
        const result = await next(e);
        await appendAudit($, { ...record, reportedModel: result.model, source: result.model ? 'client_reported' : 'requested' });
        return result;
      } catch (error) {
        await appendAudit($, { ...record, reason: 'spawn_failed', source: 'unavailable' });
        throw error;
      }
    }
    try {
      const result = await next(decision.action === 'rewrite' ? { ...e, model: decision.model } : e);
      await appendAudit($, { ...record, reportedModel: result.model, source: result.model ? 'client_reported' : 'requested' });
      return result;
    } catch {
      await appendAudit($, { ...record, action: 'deny', reason: 'spawn_failed', source: 'unavailable' });
      return { deny: DENIAL };
    }
  }).catch(async ($, e, next) => {
    if (observingEvents.has(e)) return next(e);
    try {
      // Native .catch also covers time budgets and invalid hook returns. Its
      // next is replay-safe: an observing failure cannot spawn a second agent.
      const policy = await readPolicy($, options);
      if (policy.mode === 'observe') return next(e);
    } catch {
      // An unreadable policy cannot establish a trustworthy observe mode.
    }
    return { deny: DENIAL };
  });
}
