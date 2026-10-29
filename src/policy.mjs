import catalog from '../models/catalog.json' with {type:'json'};
export const CLIENTS = Object.freeze(['codex', 'claude', 'kimi', 'agy']);
export const ROLES = Object.freeze({worker:'code', reviewer:'code', explorer:'light', routine:'light'});
export const rolePreference=(config,role)=>config.roles?.[role]??config[ROLES[role]];
export const NATIVE_EFFORTS=Object.freeze(Object.fromEntries(CLIENTS.map(client=>[client,Object.freeze([...catalog.clients[client].efforts])])));
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
    object(config,['code','light','roles','avoidModels']);
    if(config.roles!==undefined)object(config.roles,Object.keys(ROLES));
    for (const selected of [config.code,config.light,...Object.values(config.roles??{})]) {
      object(selected,['model','effort']); model(selected.model);
      if (client === 'kimi' && selected.model === 'primary') invalid();
      if(client==='agy'&&!['pro','flash','flash_lite','inherit'].includes(selected.model))invalid();
      if(selected.effort!==null){
        if(!NATIVE_EFFORTS[client].includes(selected.effort))invalid();
        const known=catalog.clients[client].models.find(model=>model.id===selected.model);
        if(known&&!known.efforts.includes(selected.effort))invalid();
      }
    }
    if (!Array.isArray(config.avoidModels) || config.avoidModels.length > 32 || new Set(config.avoidModels).size !== config.avoidModels.length) invalid();
    config.avoidModels.forEach(model);
    const effective=Object.keys(ROLES).map(role=>rolePreference(config,role));
    if (effective.some(selected=>config.avoidModels.includes(selected.model))) invalid();
    const pinned=effective.filter(value=>value.effort!==null);
    if (client==='kimi'&&new Set(pinned.map(v=>v.model+'\0'+v.effort)).size!==new Set(pinned.map(v=>v.model)).size) invalid();
  }
  return freeze(JSON.parse(JSON.stringify(value)));
}
