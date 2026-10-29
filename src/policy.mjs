export const CLIENTS = Object.freeze(['codex', 'claude', 'kimi', 'agy']);
export const ROLES = Object.freeze({worker:'code', reviewer:'code', explorer:'light', routine:'light'});
const identifier = /^[A-Za-z0-9][A-Za-z0-9._:/\[\]-]{0,127}$/;
function invalid() { throw Object.assign(new Error('Invalid shared preferences.'), {code:'INVALID_POLICY'}); }
function object(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) invalid();
  for (const [key,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!fields.includes(key) || descriptor.get || descriptor.set) invalid();
  }
}
function model(value) { if (typeof value !== 'string' || !identifier.test(value)) invalid(); }
function freeze(value) { for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child); return Object.freeze(value); }
export function validatePolicy(value) {
  object(value,['schemaVersion','maxConcurrent','clients']);
  if (value.schemaVersion !== 1 || !Number.isInteger(value.maxConcurrent) || value.maxConcurrent < 1 || value.maxConcurrent > 32) invalid();
  object(value.clients,CLIENTS);
  if (!Object.keys(value.clients).length) invalid();
  for (const [client,config] of Object.entries(value.clients)) {
    object(config,['code','light','avoidModels']);
    for (const kind of ['code','light']) {
      object(config[kind],['model','effort']); model(config[kind].model);
      if (client === 'kimi' && config[kind].model === 'primary') invalid();
      if (client === 'agy' ? (config[kind].effort !== null || !['pro','flash','inherit'].includes(config[kind].model)) : !['low','medium','high'].includes(config[kind].effort)) invalid();
    }
    if (!Array.isArray(config.avoidModels) || config.avoidModels.length > 32 || new Set(config.avoidModels).size !== config.avoidModels.length) invalid();
    config.avoidModels.forEach(model);
    if (config.avoidModels.includes(config.code.model) || config.avoidModels.includes(config.light.model)) invalid();
    if (client === 'kimi' && config.code.model === config.light.model && config.code.effort !== config.light.effort) invalid();
  }
  return freeze(JSON.parse(JSON.stringify(value)));
}
