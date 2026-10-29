export const CLIENTS = Object.freeze(['codex', 'claude', 'kimi', 'agy']);
const EFFORTS = Object.freeze(['low', 'medium', 'high']);
const identifier = /^[A-Za-z0-9][A-Za-z0-9._:/\[\]-]{0,127}$/;

function invalid() {
  const error = new Error('Invalid policy. Check the policy schema.');
  error.code = 'invalid_policy';
  throw error;
}
function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!allowed.includes(key) || descriptor.get || descriptor.set) invalid();
  }
}
function text(value) { if (typeof value !== 'string' || !identifier.test(value)) invalid(); }
function list(value) {
  if (!Array.isArray(value) || value.length > 64 || new Set(value).size !== value.length) invalid();
  value.forEach(text);
}
function freeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return Object.freeze(value);
}
export function validatePolicy(value) {
  object(value, ['schemaVersion', 'mode', 'clients']);
  if (value.schemaVersion !== 1 || !['enforce', 'observe'].includes(value.mode)) invalid();
  object(value.clients, CLIENTS);
  if (!Object.keys(value.clients).length) invalid();
  for (const config of Object.values(value.clients)) {
    object(config, ['defaultProfile', 'maxConcurrent', 'profiles', 'deniedModels', 'observedModels']);
    text(config.defaultProfile);
    if (!Number.isInteger(config.maxConcurrent) || config.maxConcurrent < 1 || config.maxConcurrent > 32) invalid();
    object(config.profiles, Object.keys(config.profiles ?? {}).filter(key => identifier.test(key)
      && !['__proto__', 'constructor', 'prototype'].includes(key)));
    const profiles = Object.entries(config.profiles);
    if (!profiles.length || profiles.length > 16 || !Object.hasOwn(config.profiles, config.defaultProfile)) invalid();
    list(config.deniedModels); list(config.observedModels);
    const models = new Set(); const roles = new Set();
    for (const [, profile] of profiles) {
      object(profile, ['model', 'effort', 'roles', 'providerModel']);
      text(profile.model); list(profile.roles);
      if (profile.providerModel !== undefined) text(profile.providerModel);
      if (profile.effort !== null && !EFFORTS.includes(profile.effort)) invalid();
      if (models.has(profile.model) || config.deniedModels.includes(profile.model)) invalid();
      models.add(profile.model);
      for (const role of profile.roles) {
        if (roles.has(role)) invalid();
        roles.add(role);
      }
    }
  }
  return freeze(JSON.parse(JSON.stringify(value)));
}

export function publicModels(policy, client) {
  const config = policy.clients[client];
  if (!config) return [];
  return [...new Set([...Object.values(config.profiles).flatMap(p => [p.model, p.providerModel].filter(Boolean)),
    ...config.deniedModels, ...config.observedModels])];
}
function result(action, reason, profile = null, binding = null) {
  return { action, reason, profile, model: binding?.model ?? null, effort: binding?.effort ?? null };
}
function modelProfile(client, model, config) {
  return Object.entries(config.profiles).find(([, profile]) => profile.model === model
    || (client === 'claude' && config.observedModels.includes(model)
      && model.startsWith(`claude-${profile.model}-`)));
}
export function evaluate(policy, request) {
  if (!request || typeof request !== 'object' || !CLIENTS.includes(request.client)) {
    return result('unsupported', 'unsupported_client');
  }
  const config = policy.clients[request.client];
  if (!config) return result('unsupported', 'unsupported_client');
  if (request.client === 'agy') return result('unsupported', 'tier_not_model');
  const suppliedModel = request.model !== undefined && request.model !== null;
  const suppliedEffort = request.effort !== undefined && request.effort !== null;
  const explicit = suppliedModel && typeof request.model === 'string'
    ? modelProfile(request.client, request.model, config) : null;
  if (suppliedModel && !explicit) return result('deny', 'model_not_allowed');
  if (suppliedEffort && !EFFORTS.includes(request.effort)) return result('deny', 'effort_not_allowed');
  const role = typeof request.role === 'string' ? request.role.split(':').at(-1) : null;
  const bound = Object.entries(config.profiles).find(([, profile]) => profile.roles.includes(role));
  const [name, binding] = bound ?? explicit ?? [config.defaultProfile, config.profiles[config.defaultProfile]];
  if (request.model === binding.model && request.effort === binding.effort) {
    return result('allow', 'profile_allowed', name, binding);
  }
  return result('rewrite', 'pin_profile', name, binding);
}
