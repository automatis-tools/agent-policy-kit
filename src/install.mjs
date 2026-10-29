import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { constants } from 'node:fs';
import { validatePolicy, ROLES, rolePreference } from './policy.mjs';
import { PACKAGE_VERSION } from './release.mjs';
import catalog from '../models/catalog.json' with {type:'json'};
import { parseToml, setTomlValue, restoreTomlValue, removeTomlValue } from './toml.mjs';
import { nativeLocations, nativeRoles, instructionBlock, nativeWarnings, BEGIN, END } from './native.mjs';

const CLIENTS = ['codex', 'claude', 'kimi', 'agy'];
const LIMIT = 1024 * 1024;
const digest = value => value === null ? null : createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const equal = isDeepStrictEqual;
const own = (o, k) => Object.hasOwn(o, k);
const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k,canonical(value[k])])) : value;
function fail(code) { throw Object.assign(new Error(code), {code}); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function absolute(value) { if (typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0')) fail('UNSAFE_PATH'); return path.resolve(value); }
function within(base, target) { const relative = path.relative(base, target); return !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative); }
function locations(client,home,stateDir) {
  return {...nativeLocations(client,home),receipt:path.join(stateDir,'installations',client+'.json'),policy:path.join(stateDir,'policy.json')};
}
function nativeTargets(l) { return [...(l.config?[l.config]:[]),l.instructions,...l.roles]; }
async function statOrNull(file) { try { return await fs.lstat(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
async function safePath(file, base) {
  if (!within(base, file)) fail('UNSAFE_PATH');
  const root = await statOrNull(base);
  if (root && (!root.isDirectory() || root.isSymbolicLink())) fail('UNSAFE_PATH');
  let at = base;
  for (const part of path.relative(base, file).split(path.sep).filter(Boolean)) {
    at = path.join(at, part);
    const s = await statOrNull(at);
    if (s && (s.isSymbolicLink() || (at !== file && !s.isDirectory()) || (at === file && !s.isFile() && !s.isDirectory()))) fail('UNSAFE_PATH');
  }
}
async function read(file, base) {
  await safePath(file, base);
  const s = await statOrNull(file);
  if (!s) return {text:null,mode:0o600};
  if (!s.isFile() || s.size > LIMIT) fail('UNSAFE_FILE');
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const actual = await handle.stat();
    if (!actual.isFile() || actual.ino !== s.ino || actual.dev !== s.dev || actual.size > LIMIT) fail('UNSAFE_FILE');
    const text = await handle.readFile('utf8');
    if (Buffer.byteLength(text) > LIMIT) fail('UNSAFE_FILE');
    return {text,mode:s.mode & 0o777};
  } finally { await handle.close(); }
}
async function readDependency(plan, file, base) {
  const before = await read(file,base);
  const snapshot = {path:file,base,beforeHash:digest(before.text),beforeMode:before.mode};
  const earlier = plan.dependencies.find(d => d.path === file);
  if (earlier && (earlier.beforeHash !== snapshot.beforeHash || earlier.beforeMode !== snapshot.beforeMode)) fail('STALE_PLAN');
  if (!earlier) plan.dependencies.push(snapshot);
  return before;
}
// JSON.parse validates grammar; this token pass additionally refuses duplicate object keys.
function parseJson(text, code = 'INVALID_JSON') {
  try {
    if (typeof text !== 'string' || Buffer.byteLength(text) > LIMIT) fail(code);
    const result = JSON.parse(text);
    const stack = [];
    for (const token of text.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],:]/g)) {
      const t = token[0];
      if (t === '{') stack.push({keys:new Set(),key:true});
      else if (t === '[') stack.push(null);
      else if (t === '}' || t === ']') stack.pop();
      else if (t === ',') { if (stack.at(-1)) stack.at(-1).key = true; }
      else if (t === ':') { if (stack.at(-1)) stack.at(-1).key = false; }
      else if (stack.at(-1)?.key) {
        const value = JSON.parse(t);
        if (stack.at(-1).keys.has(value)) fail(code);
        stack.at(-1).keys.add(value);
      }
    }
    return result;
  } catch { fail(code); }
}
function configJson(text) { const value = text === null ? {} : parseJson(text); if (!object(value)) fail('UNSUPPORTED_CONFIG'); return value; }
function ensureObject(parent,key) {
  if(!own(parent,key))parent[key]={};
  if(!object(parent[key]))fail('UNSUPPORTED_CONFIG');
  return parent[key];
}
function jsonInstall(text,maxConcurrent,defaultModel) {
  const value=configJson(text),ops=[],created=[];
  if(!own(value,'env'))created.push(['env']);
  const env=ensureObject(value,'env');
  for(const [key,after] of [['CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS',String(maxConcurrent)],['CLAUDE_CODE_SUBAGENT_MODEL',defaultModel]]) {
    if(own(env,key)&&typeof env[key]!=='string')fail('UNSUPPORTED_CONFIG');
    ops.push({kind:'value',path:['env',key],existed:own(env,key),before:env[key]??null,after});env[key]=after;
  }
  return {text:json(value),ops,created};
}
function atPath(value, keys) {
  for (const key of keys) { if (!object(value) || !own(value,key)) fail('OWNED_DRIFT'); value = value[key]; }
  return value;
}
function undoJson(text, file) {
  const value = configJson(text);
  for (const op of file.ops.toReversed()) {
    const parent = atPath(value,op.path.slice(0,-1)), key = op.path.at(-1);
    if (!equal(parent[key],op.after)) fail('OWNED_DRIFT');
    if (op.existed) parent[key] = op.before; else delete parent[key];
  }
  for (const keys of file.created.toReversed()) {
    const parent = atPath(value,keys.slice(0,-1)), key = keys.at(-1);
    if ((object(parent[key]) && Object.keys(parent[key]).length === 0) || (Array.isArray(parent[key]) && parent[key].length === 0)) delete parent[key];
  }
  return !file.existed && Object.keys(value).length === 0 ? null : json(value);
}
function allowedBases(plan) { return target => within(plan.stateDir,target) ? plan.stateDir : plan.home; }
async function recoveryRequired(stateDir) {
  const pending = path.join(stateDir,'pending.json');
  await safePath(pending,stateDir);
  if (await statOrNull(pending)) fail('RECOVERY_REQUIRED');
  const lock = await read(path.join(stateDir,'.install.lock'),stateDir);
  if (lock.text !== null && /^[a-f0-9-]{36}$/.test(lock.text)) {
    const index = path.join(stateDir,'backups',lock.text,'index.json');
    await safePath(index,stateDir);
    if (await statOrNull(index)) fail('RECOVERY_REQUIRED');
  }
}
async function context({client,home,stateDir}) {
  if (!CLIENTS.includes(client)) fail('INVALID_CLIENT');
  home = absolute(home); stateDir = absolute(stateDir);
  if (home === stateDir || within(stateDir,home)) fail('UNSAFE_PATH');
  await safePath(home,path.parse(home).root);
  await safePath(stateDir,path.parse(stateDir).root);
  const homeStat = await statOrNull(home);
  if (!homeStat?.isDirectory() || homeStat.isSymbolicLink()) fail('UNSAFE_PATH');
  // Existing ancestors of the state root are checked before creating any private tree.
  let anchor = within(home,stateDir) ? home : path.dirname(stateDir);
  while (!(await statOrNull(anchor))) anchor = path.dirname(anchor);
  await safePath(stateDir,anchor);
  const result = {schemaVersion:1,client,home,stateDir,warnings:[],changes:[],dependencies:[]};
  const l = locations(client,home,stateDir);
  await recoveryRequired(stateDir);
  const receipt = await readDependency(result,l.receipt,stateDir);
  return {result,l,receipt};
}
function change(plan,target,before,after,mode=0o600) {
  if (before.text !== after) plan.changes.push({path:target,before:before.text,after,beforeHash:digest(before.text),afterHash:digest(after),mode,beforeMode:before.mode});
}
function effectiveRoles(preferences) {return Object.keys(ROLES).map(role=>({role,...rolePreference(preferences,role)}));}
function selectedAliases(preferences) {
  const aliases=new Map();
  for(const selected of effectiveRoles(preferences))if(!aliases.has(selected.model)||selected.effort!==null)aliases.set(selected.model,selected);
  return [...aliases.values()];
}
function tomlSettings(client,preferences,maxConcurrent) {
  const worker=rolePreference(preferences,'worker');
  if(client==='codex')return [[['agents','max_concurrent_threads_per_session'],maxConcurrent],[['agents','default_subagent_model'],worker.model],...(worker.effort===null?[]:[[['agents','default_subagent_reasoning_effort'],worker.effort]])];
  if(client!=='kimi')return [];
  const selected=selectedAliases(preferences),roles=effectiveRoles(preferences);
  return [[['secondary_model','default_model'],worker.model],...selected.map(value=>[['secondary_model','models',value.model],'Use for '+roles.filter(role=>role.model===value.model).map(role=>'apk-'+role.role).join(', ')+'.']),...selected.filter(value=>value.effort!==null).map(value=>[['models',value.model,'overrides','default_effort'],value.effort])];
}
const HASH=/^[a-f0-9]{64}$/;
const validHash=value=>typeof value==='string'&&HASH.test(value);
const VERSION=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const SOURCES=['release','custom','saved'];
const validPreset=value=>value===null||(typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value));
function version(value) {return typeof value==='string'&&value.length<=128&&VERSION.test(value);}
function fields(value,allowed) {if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail('INVALID_RECEIPT');}
function literalValue(raw,type,nullable=false) {
  if(raw===null&&nullable)return null;
  if(typeof raw!=='string'||raw.length>8192)fail('INVALID_RECEIPT');
  let value;
  try {const parsed=parseToml(`value = ${raw}\n`);if(Object.keys(parsed).length!==1)fail('INVALID_RECEIPT');value=parsed.value;}catch {fail('INVALID_RECEIPT');}
  if(typeof value!==type||(type==='number'&&!Number.isSafeInteger(value))||(type==='string'&&value.length>4096))fail('INVALID_RECEIPT');
  return value;
}
function alias(value) {return typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/\[\]-]{0,127}$/.test(value);}
function scalar(op,target,type) {
  fields(op,['kind','path','before','after','addedTable']);
  if(op.kind!=='scalar'||!equal(op.path,target)||(op.addedTable&&!equal(op.addedTable,target.slice(0,-1))))fail('INVALID_RECEIPT');
  literalValue(op.before,type,true);
  return literalValue(op.after,type);
}
function validateTomlSnapshot(file,client,schemaVersion) {
  if(!Array.isArray(file.ops)||!file.ops.every(op=>object(op)&&Array.isArray(op.path)&&op.path.every(key=>typeof key==='string')&&op.path.length<=4))fail('INVALID_RECEIPT');
  if(client==='codex') {
    if(!(schemaVersion===2?[3]:[2,3]).includes(file.ops.length))fail('INVALID_RECEIPT');
    const cap=scalar(file.ops[0],['agents','max_concurrent_threads_per_session'],'number');
    if(cap<1||cap>32)fail('INVALID_RECEIPT');
    scalar(file.ops[1],['agents','default_subagent_model'],'string');if(file.ops.length===3)scalar(file.ops[2],['agents','default_subagent_reasoning_effort'],'string');
    return;
  }
  if(client!=='kimi')fail('INVALID_RECEIPT');
  if(schemaVersion===2) {
    if(![4,6].includes(file.ops.length))fail('INVALID_RECEIPT');
    const removed=file.ops[0];fields(removed,['kind','path','before']);
    if(removed.kind!=='removed'||!equal(removed.path,['secondary_model','default_effort']))fail('INVALID_RECEIPT');
    literalValue(removed.before,'string',true);
    const defaultAlias=scalar(file.ops[1],['secondary_model','default_model'],'string');
    const count=(file.ops.length-2)/2,aliases=[];
    for(let i=0;i<count;i++) {
      const op=file.ops[2+i],name=op.path?.[2];
      if(!alias(name)||aliases.includes(name))fail('INVALID_RECEIPT');aliases.push(name);scalar(op,['secondary_model','models',name],'string');
    }
    if(!aliases.includes(defaultAlias))fail('INVALID_RECEIPT');
    for(let i=0;i<count;i++)scalar(file.ops[2+count+i],['models',aliases[i],'overrides','default_effort'],'string');
    return;
  }
  if(file.ops.length<2||file.ops.length>10)fail('INVALID_RECEIPT');
  let at=0;
  if(file.ops[0].kind==='removed') {
    const removed=file.ops[at++];fields(removed,['kind','path','before']);
    if(!equal(removed.path,['secondary_model','default_effort']))fail('INVALID_RECEIPT');literalValue(removed.before,'string',true);
  }
  const defaultAlias=scalar(file.ops[at++],['secondary_model','default_model'],'string'),aliases=[];
  while(at<file.ops.length&&equal(file.ops[at].path?.slice(0,2),['secondary_model','models'])) {
    const op=file.ops[at++],name=op.path[2];
    if(!alias(name)||aliases.includes(name)||aliases.length===4)fail('INVALID_RECEIPT');aliases.push(name);scalar(op,['secondary_model','models',name],'string');
  }
  if(!aliases.length||!aliases.includes(defaultAlias))fail('INVALID_RECEIPT');
  const pinned=new Set();
  while(at<file.ops.length) {
    const op=file.ops[at++],name=op.path?.[1];
    if(!aliases.includes(name)||pinned.has(name))fail('INVALID_RECEIPT');pinned.add(name);scalar(op,['models',name,'overrides','default_effort'],'string');
  }
}
function validateJsonSnapshot(file) {
  if(!Array.isArray(file.ops)||file.ops.length!==2||!Array.isArray(file.created)||file.created.length>1||!file.created.every(keys=>equal(keys,['env'])))fail('INVALID_RECEIPT');
  for(const[i,key]of ['CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS','CLAUDE_CODE_SUBAGENT_MODEL'].entries()) {
    const op=file.ops[i];fields(op,['kind','path','existed','before','after']);
    if(op.kind!=='value'||!equal(op.path,['env',key])||typeof op.existed!=='boolean'||typeof op.after!=='string'||op.after.length>4096||(op.existed?typeof op.before!=='string'||op.before.length>4096:op.before!==null))fail('INVALID_RECEIPT');
    if(i===0&&(!/^[1-9]\d?$/.test(op.after)||Number(op.after)>32))fail('INVALID_RECEIPT');
  }
}
function validateReceipt(r,plan) {
  if(object(r)&&(r.schemaVersion===1||own(r,'packageRoot')||own(r,'nodePath')||own(r,'mode')||(Array.isArray(r.files)&&r.files.some(file=>object(file)&&(['owned','hook'].includes(file.type)||(Array.isArray(file.ops)&&file.ops.some(op=>object(op)&&['hook','entry'].includes(op.kind))))))))fail('LEGACY_RUNTIME_RECEIPT');
  fields(r,['schemaVersion','kind','client','home','stateDir','policyHash','warnings','files',...(r?.schemaVersion===2?['maxConcurrent','preferences']:['releaseVersion','source','preset'])]);
  const l=locations(plan.client,plan.home,plan.stateDir),allowed=nativeTargets(l);
  if(![2,3].includes(r.schemaVersion)||r.kind!=='native-config'||r.client!==plan.client||r.home!==plan.home||r.stateDir!==plan.stateDir||!validHash(r.policyHash)||!Array.isArray(r.warnings)||r.warnings.length>32||!r.warnings.every(w=>typeof w==='string'&&/^[a-z][a-z0-9-]{0,127}$/.test(w))||!Array.isArray(r.files)||r.files.length!==allowed.length||!r.files.every(file=>object(file)&&allowed.includes(file.path))||new Set(r.files.map(file=>file.path)).size!==allowed.length)fail('INVALID_RECEIPT');
  if(r.schemaVersion===3) {if(!version(r.releaseVersion)||!SOURCES.includes(r.source)||(own(r,'preset')&&!validPreset(r.preset)))fail('INVALID_RECEIPT');}
  else if(!object(r.preferences)||!Number.isInteger(r.maxConcurrent)||r.maxConcurrent<1||r.maxConcurrent>32)fail('INVALID_RECEIPT');
  for(const file of r.files) {
    if(typeof file.existed!=='boolean')fail('INVALID_RECEIPT');
    if(l.roles.includes(file.path)) {
      fields(file,['path','type','existed','afterHash']);
      if(file.type!=='role'||file.existed||!validHash(file.afterHash))fail('INVALID_RECEIPT');
    } else if(file.path===l.instructions) {
      fields(file,['path','type','existed','prefix','block']);
      if(file.type!=='instructions'||!['','\n','\n\n'].includes(file.prefix)||typeof file.block!=='string'||file.block.length>65536||!file.block.startsWith(BEGIN+'\n')||!file.block.endsWith(END+'\n')||file.block.split(BEGIN).length!==2||file.block.split(END).length!==2)fail('INVALID_RECEIPT');
    } else if(plan.client==='claude') {
      fields(file,['path','type','existed','ops','created']);if(file.type!=='json')fail('INVALID_RECEIPT');validateJsonSnapshot(file);
    } else {
      fields(file,['path','type','existed','ops']);if(file.type!=='toml')fail('INVALID_RECEIPT');validateTomlSnapshot(file,plan.client,r.schemaVersion);
    }
  }
  return r;
}
function appliedRecord(r) {return r?{version:r.schemaVersion===3?r.releaseVersion:null,source:r.schemaVersion===3?r.source:'unknown',preset:r.schemaVersion===3?r.preset??null:null}:{version:null,source:null,preset:null};}
function releaseMetadata(plan,completed=false) {
  return {targetReleaseVersion:plan.targetReleaseVersion??null,targetSource:plan.targetSource??null,previousReleaseVersion:plan.previousReleaseVersion??null,previousSource:plan.previousSource??null,appliedReleaseVersion:completed?(plan.kind==='uninstall'?null:plan.targetReleaseVersion??null):plan.appliedReleaseVersion??null,appliedSource:completed?(plan.kind==='uninstall'?null:plan.targetSource??null):plan.appliedSource??null,targetPreset:plan.targetPreset??null,previousPreset:plan.previousPreset??null,appliedPreset:completed?(plan.kind==='uninstall'?null:plan.targetPreset??null):plan.appliedPreset??null};
}
function recordMetadata(plan,r) {
  const previous=appliedRecord(r);
  Object.assign(plan,{previousReleaseVersion:previous.version,previousSource:previous.source,appliedReleaseVersion:previous.version,appliedSource:previous.source,previousPreset:previous.preset,appliedPreset:previous.preset});
}
async function undoFiles(plan,r,writeChanges=true) {
  const baselines=new Map();
  for(const file of r.files) {
    const before=await readDependency(plan,file.path,plan.home);if(before.text===null)fail('OWNED_DRIFT');let after;
    if(file.type==='json')after=undoJson(before.text,file);
    else if(file.type==='toml') {after=before.text;for(const op of file.ops.toReversed())after=restoreTomlValue(after,op);if(!file.existed&&!after.trim())after=null;}
    else if(file.type==='instructions') {
      const owned=file.prefix+file.block;
      if(before.text.split(BEGIN).length!==2||before.text.split(END).length!==2||!before.text.includes(owned))fail('OWNED_DRIFT');
      after=before.text.replace(owned,'');if(!file.existed&&!after)after=null;
    } else {if(digest(before.text)!==file.afterHash)fail('OWNED_DRIFT');after=null;}
    baselines.set(file.path,{text:after,mode:before.mode,actual:before});
    if(writeChanges)change(plan,file.path,before,after,before.mode);
  }
  return baselines;
}
export async function inspectConfiguration(options) {
  const {result:plan,receipt}=await context(options);
  if(receipt.text===null)return {status:'not_configured',releaseVersion:null,source:null,preset:null,warnings:[]};
  const record=validateReceipt(parseJson(receipt.text,'INVALID_RECEIPT'),plan);
  await undoFiles(plan,record,false);await verifyDependencies(plan);
  const applied=appliedRecord(record);
  return {status:'verified',releaseVersion:applied.version,source:applied.source,preset:applied.preset,warnings:[...record.warnings]};
}
function prerequisite(plan,warning) {return {...plan,status:'prerequisite',warnings:[warning],changes:[]};}
function resolveKimiAliases(native,preferences) {
  const roles={},pins=new Map();let changed=false;
  for(const selected of effectiveRoles(preferences)) {
    let actual=selected.model;
    if(!object(native.models)||!own(native.models,actual)) {
      const known=catalog.clients.kimi.models.find(value=>value.id===actual&&typeof value.upstreamModelId==='string');
      if(!known)return {prerequisite:'kimi-provisioned-models-required'};
      const matches=Object.entries(object(native.models)?native.models:{}).filter(([,entry])=>object(entry)&&entry.model===known.upstreamModelId);
      if(matches.length!==1)return {prerequisite:matches.length?'kimi-catalog-alias-ambiguous':'kimi-provisioned-models-required'};
      actual=matches[0][0];changed=true;
    }
    if(!alias(actual)||actual==='primary')return {prerequisite:'kimi-provisioned-models-required'};
    if(preferences.avoidModels.includes(actual))return {prerequisite:'kimi-resolved-model-avoided'};
    if(selected.effort!==null) {
      if(pins.has(actual)&&pins.get(actual)!==selected.effort)return {prerequisite:'kimi-resolved-effort-conflict'};
      pins.set(actual,selected.effort);
    }
    roles[selected.role]={model:actual,effort:selected.effort};
  }
  return {preferences:changed?{...preferences,roles}:preferences,changed};
}
function kimiPrerequisite(native,preferences) {
  const selected=selectedAliases(preferences),pinned=selected.filter(value=>value.effort!==null);
  for(const value of selected) {
    const model=native.models?.[value.model];
    if(!object(model)||typeof model.provider!=='string'||typeof model.model!=='string'||!Number.isSafeInteger(model.max_context_size)||model.max_context_size<1||!object(native.providers?.[model.provider]))return 'kimi-provisioned-models-required';
  }
  if(!pinned.length)return null;
  if(pinned.length<selected.length&&native.secondary_model?.default_effort!==undefined)return 'kimi-mixed-native-default-effort';
  if(native.thinking?.enabled===false)return 'kimi-thinking-disabled';
  for(const value of pinned) {
    const model=native.models[value.model],effective={...model,...model.overrides};
    if(!Array.isArray(effective.support_efforts)||!effective.support_efforts.includes(value.effort))return 'kimi-supported-effort-required';
    const globalEffort=native.thinking?.effort;
    const mainEffortPinned=['low','medium','high','xhigh','max'].includes(globalEffort)&&effective.support_efforts.includes(globalEffort);
    if(value.model===native.default_model&&effective.default_effort!==value.effort&&!mainEffortPinned)return 'kimi-main-effort-conflict';
  }
  return null;
}
export async function planInstall(options) {
  const {releaseVersion=PACKAGE_VERSION,replace=false,source='release',preset=null}=options;
  if(!validPreset(preset))fail('INVALID_PRESET');
  if(!version(releaseVersion)||typeof replace!=='boolean'||!SOURCES.includes(source))fail('INVALID_RELEASE');
  const {result:plan,l,receipt}=await context(options);plan.kind='install';
  plan.targetReleaseVersion=releaseVersion;plan.targetSource=source;plan.targetPreset=preset;
  let record=null;
  if(receipt.text!==null)record=validateReceipt(parseJson(receipt.text,'INVALID_RECEIPT'),plan);
  recordMetadata(plan,record);
  plan.policyPath=absolute(options.policyPath);
  const input=await readDependency(plan,plan.policyPath,path.dirname(plan.policyPath));if(input.text===null)fail('INVALID_POLICY');
  const policy=parseJson(input.text,'INVALID_POLICY');try {validatePolicy(policy);}catch {fail('INVALID_POLICY');}
  if(!own(policy.clients,plan.client))fail('INVALID_POLICY');
  let selected=policy.clients[plan.client],resolvedAliases=false;
  const maxConcurrent=policy.maxConcurrent,policyHash=digest(json(canonical(policy)));
  const policyBefore=await readDependency(plan,l.policy,plan.stateDir);
  const baselines=record?await undoFiles(plan,record,false):new Map();
  if(record&&!replace) {
    if(record.policyHash!==policyHash)fail('INSTALLATION_CONFLICT');
    if(policyBefore.text===null||!equal(parseJson(policyBefore.text,'OWNED_DRIFT'),policy))fail('OWNED_DRIFT');
    return {...plan,status:'unchanged',warnings:[...record.warnings]};
  }
  if(!replace&&policyBefore.text!==null&&!equal(parseJson(policyBefore.text,'POLICY_CONFLICT'),policy))fail('POLICY_CONFLICT');
  const baseline=async target=>baselines.get(target)??await readDependency(plan,target,plan.home);
  const nativeChange=(target,before,after,mode=before.mode)=>change(plan,target,before.actual??before,after,mode);
  const config=l.config?await baseline(l.config):null;
  let native;
  if(plan.client==='claude') {
    native=configJson(config.text);
    if(native.env!==undefined&&!object(native.env))fail('UNSUPPORTED_CONFIG');
    if(native.env?.CLAUDE_CODE_SUBAGENT_MODEL_FORCE==='1')return prerequisite(plan,'claude-force-model-conflict');
  } else if(config) {
    native=parseToml(config.text??'');
    if(plan.client==='kimi') {
      const resolved=resolveKimiAliases(native,selected);if(resolved.prerequisite)return prerequisite(plan,resolved.prerequisite);
      selected=resolved.preferences;resolvedAliases=resolved.changed;
      const required=kimiPrerequisite(native,selected);if(required)return prerequisite(plan,required);
      if(selectedAliases(selected).some(value=>value.effort!==null)&&native.secondary_model?.default_effort!==undefined&&typeof native.secondary_model.default_effort!=='string')fail('UNSUPPORTED_CONFIG');
    }
    if(plan.client==='codex') {
      if(native.agents&&own(native.agents,'max_threads'))fail('CODEX_CAP_ALIAS_CONFLICT');
      const cap=native.agents?.max_concurrent_threads_per_session;
      if(cap!==undefined&&(!Number.isSafeInteger(cap)||cap<1))fail('UNSUPPORTED_CONFIG');
    }
  }
  const files=[];plan.warnings=[...nativeWarnings(plan.client),...(resolvedAliases?['kimi-catalog-alias-resolved']:[])];
  if(plan.client==='claude') {
    const edited=jsonInstall(config.text,maxConcurrent,rolePreference(selected,'worker').model);nativeChange(l.config,config,edited.text);
    files.push({path:l.config,type:'json',existed:config.text!==null,ops:edited.ops,created:edited.created});
  } else if(config) {
    let text=config.text??'';const ops=[];
    if(plan.client==='kimi'&&selectedAliases(selected).some(value=>value.effort!==null)) {const edit=removeTomlValue(text,['secondary_model','default_effort']);text=edit.text;ops.push(edit.ownership);}
    for(const[keys,value]of tomlSettings(plan.client,selected,maxConcurrent)) {
      const previous=keys.reduce((at,key)=>at?.[key],native);
      if(previous!==undefined&&typeof previous!==typeof value)fail('UNSUPPORTED_CONFIG');
      const edit=setTomlValue(text,keys,value);text=edit.text;ops.push(edit.ownership);
    }
    nativeChange(l.config,config,text);files.push({path:l.config,type:'toml',existed:config.text!==null,ops});
  }
  const roles=nativeRoles(plan.client,selected);
  for(const[i,target]of l.roles.entries()) {
    const before=await baseline(target);if(before.text!==null)fail('OWNERSHIP_CONFLICT');
    nativeChange(target,before,roles[i],0o600);files.push({path:target,type:'role',existed:false,afterHash:digest(roles[i])});
  }
  const before=await baseline(l.instructions),text=before.text??'';
  if(text.includes(BEGIN)||text.includes(END))fail('OWNERSHIP_CONFLICT');
  const prefix=!text||text.endsWith('\n\n')?'':text.endsWith('\n')?'\n':'\n\n',block=instructionBlock(plan.client,selected,maxConcurrent);
  nativeChange(l.instructions,before,text+prefix+block);
  files.push({path:l.instructions,type:'instructions',existed:before.text!==null,prefix,block});
  const r={schemaVersion:3,kind:'native-config',client:plan.client,home:plan.home,stateDir:plan.stateDir,releaseVersion,source,...(preset===null?{}:{preset}),policyHash,warnings:plan.warnings,files};
  validateReceipt(r,plan);
  let canonicalText=policyBefore.text;
  if(canonicalText===null||replace) {
    let matches=false;try {matches=canonicalText!==null&&equal(parseJson(canonicalText),policy);}catch {}
    if(!matches)canonicalText=json(policy);
  }
  change(plan,l.policy,policyBefore,canonicalText,0o600);
  change(plan,l.receipt,receipt,json(r),0o600);
  return {...plan,status:'planned'};
}

export function summarizePlan(plan) {
  const relative = file => within(plan.home,file) ? '~/' + path.relative(plan.home,file).split(path.sep).join('/') : '<state-dir>/' + path.relative(plan.stateDir,file).split(path.sep).join('/');
  return {client:plan.client,kind:plan.kind,status:plan.status,files:plan.changes.map(c => ({path:relative(c.path),action:c.after === null ? 'remove' : c.before === null ? 'create' : 'update'})),warnings:[...plan.warnings],...releaseMetadata(plan)};
}

async function privateDir(dir,base) {
  await safePath(dir,base);
  await fs.mkdir(dir,{recursive:true,mode:0o700});
  await fs.chmod(dir,0o700);
}
async function durableWrite(file,text,mode) {
  const handle = await fs.open(file,'wx',mode);
  try { await handle.chmod(mode); await handle.writeFile(text,'utf8'); await handle.sync(); } finally { await handle.close(); }
}
async function syncDir(dir) {
  const handle = await fs.open(dir,constants.O_RDONLY);
  try { await handle.sync(); } finally { await handle.close(); }
}
async function verifyDependencies(plan, committed = []) {
  for (const dependency of plan.dependencies) {
    const postimage = committed.find(c => c.path === dependency.path);
    const current = await read(dependency.path,dependency.base);
    const hash = postimage ? postimage.afterHash : dependency.beforeHash;
    const mode = postimage ? postimage.mode : dependency.beforeMode;
    if (digest(current.text) !== hash || (current.text !== null && current.mode !== mode)) fail('STALE_PLAN');
  }
}
function validPlan(plan) {
  if (!object(plan) || plan.schemaVersion !== 1 || !CLIENTS.includes(plan.client) || !['install','uninstall'].includes(plan.kind) || !Array.isArray(plan.changes) || !Array.isArray(plan.dependencies)) fail('INVALID_PLAN');
  absolute(plan.home); absolute(plan.stateDir);
  const l = locations(plan.client,plan.home,plan.stateDir), allowed = [...nativeTargets(l),l.policy,l.receipt];
  if (plan.policyPath !== undefined) absolute(plan.policyPath);
  if (new Set(plan.dependencies.map(d=>d.path)).size !== plan.dependencies.length) fail('INVALID_PLAN');
  for (const d of plan.dependencies) {
    const source = d.path === plan.policyPath;
    if ((!allowed.includes(d.path) && !source) || (d.base !== allowedBases(plan)(d.path) && !(source && d.base === path.dirname(d.path))) || !(d.beforeHash === null || /^[a-f0-9]{64}$/.test(d.beforeHash)) || !Number.isInteger(d.beforeMode)) fail('INVALID_PLAN');
  }
  if (new Set(plan.changes.map(c=>c.path)).size !== plan.changes.length) fail('INVALID_PLAN');
  for (const c of plan.changes) {
    if (!allowed.includes(c.path) || !(c.before === null || typeof c.before === 'string') || !(c.after === null || typeof c.after === 'string') || digest(c.before) !== c.beforeHash || digest(c.after) !== c.afterHash || !Number.isInteger(c.mode) || (c.mode & ~0o777) || !Number.isInteger(c.beforeMode)) fail('INVALID_PLAN');
    if (!plan.dependencies.some(d => d.path === c.path && d.beforeHash === c.beforeHash && d.beforeMode === c.beforeMode)) fail('INVALID_PLAN');
  }
}
export async function applyInstall(plan) {
  validPlan(plan);
  if (plan.status === 'prerequisite') return {status:'prerequisite',client:plan.client,changedFiles:0,warnings:[...plan.warnings],...releaseMetadata(plan)};
  await safePath(plan.home,path.parse(plan.home).root);
  await safePath(plan.stateDir,path.parse(plan.stateDir).root);
  if (!plan.changes.length) {
    await recoveryRequired(plan.stateDir);
    await verifyDependencies(plan);
    return {status:'unchanged',client:plan.client,changedFiles:0,warnings:[...plan.warnings],...releaseMetadata(plan)};
  }
  if (process.platform === 'win32') fail('PLATFORM_UNSUPPORTED');
  // Lock creation is the first mutation. All target preimages were collected in plan-only mode.
  await privateDir(plan.stateDir,within(plan.home,plan.stateDir) ? plan.home : path.dirname(plan.stateDir));
  const lock = path.join(plan.stateDir,'.install.lock'), id = randomUUID();
  await safePath(lock,plan.stateDir);
  let held;
  try { held = await fs.open(lock,'wx',0o600); } catch (e) { if (e.code === 'EEXIST') fail('INSTALL_LOCKED'); throw e; }
  const pending = path.join(plan.stateDir,'pending.json'), staged = [], committed = [];
  let journalCreated = false, rollbackConflict = false, journalText = null, retainLock = false;
  try {
    await held.writeFile(id); await held.sync();
    await safePath(pending,plan.stateDir);
    if (await statOrNull(pending)) fail('RECOVERY_REQUIRED');
    await verifyDependencies(plan);
    const backupDir = path.join(plan.stateDir,'backups',id);
    await privateDir(path.dirname(backupDir),plan.stateDir);
    await privateDir(backupDir,plan.stateDir);
    for (const [i,c] of plan.changes.entries()) {
      if (c.before !== null) await durableWrite(path.join(backupDir,`${i}.before`),c.before,0o600);
      await safePath(c.path,allowedBases(plan)(c.path));
      await fs.mkdir(path.dirname(c.path),{recursive:true,mode:0o700});
      if (c.after !== null) {
        const stage = path.join(path.dirname(c.path),`.agent-policy-${id}-${i}.tmp`);
        staged.push(stage);
        await durableWrite(stage,c.after,c.mode);
      }
    }
    const journal = {schemaVersion:1,id,client:plan.client,kind:plan.kind,backupDir,changes:plan.changes.map((c,i)=>({path:c.path,beforeHash:c.beforeHash,afterHash:c.afterHash,backup:c.before === null ? null : `${i}.before`,beforeMode:c.beforeMode}))};
    journalText = json(journal);
    await durableWrite(path.join(backupDir,'index.json'),journalText,0o600);
    await syncDir(backupDir);
    await syncDir(path.dirname(backupDir));
    await durableWrite(pending,journalText,0o600); journalCreated = true;
    await syncDir(plan.stateDir);
    for (const [i,c] of plan.changes.entries()) {
      await verifyDependencies(plan,committed);
      if (c.after === null) await fs.unlink(c.path);
      else await fs.rename(path.join(path.dirname(c.path),`.agent-policy-${id}-${i}.tmp`),c.path);
      committed.push(c);
      await syncDir(path.dirname(c.path));
    }
    await verifyDependencies(plan,committed);
    await fs.unlink(pending);
    await syncDir(plan.stateDir);
    await verifyDependencies(plan,committed);
    journalCreated = false;
    return {status:'applied',client:plan.client,changedFiles:plan.changes.length,warnings:[...plan.warnings],...releaseMetadata(plan,true)};
  } catch (error) {
    if (journalCreated) retainLock = true;
    // Final directory sync can fail after unlink. Restore the recovery record before
    // any rollback that might conflict. The retained lock UUID also locates the
    // durable backup index if storage refuses recreation of pending.json.
    if (journalCreated && !(await statOrNull(pending))) {
      try { await durableWrite(pending,journalText,0o600); await syncDir(plan.stateDir); }
      catch { retainLock = true; fail('RECOVERY_REQUIRED'); }
    }
    for (const c of committed.toReversed()) {
      try {
        const current = await read(c.path,allowedBases(plan)(c.path));
        if (digest(current.text) !== c.afterHash || (current.text !== null && current.mode !== c.mode)) { rollbackConflict = true; continue; }
        if (c.before === null) await fs.unlink(c.path);
        else {
          const rollback = path.join(path.dirname(c.path),`.agent-policy-${id}-rollback.tmp`);
          staged.push(rollback);
          await durableWrite(rollback,c.before,c.beforeMode);
          await fs.rename(rollback,c.path);
        }
      } catch { rollbackConflict = true; }
    }
    if (journalCreated && !rollbackConflict) { try { await fs.unlink(pending); } catch { rollbackConflict = true; } }
    if (rollbackConflict) { retainLock = true; fail('ROLLBACK_CONFLICT'); }
    retainLock = false;
    if (typeof error.code === 'string' && ['STALE_PLAN','RECOVERY_REQUIRED','UNSAFE_PATH','UNSAFE_FILE'].includes(error.code)) throw error;
    fail('INSTALL_FAILED');
  } finally {
    for (const stage of staged) { try { await fs.unlink(stage); } catch {} }
    await held.close();
    try { if (!retainLock && (await fs.readFile(lock,'utf8')) === id) await fs.unlink(lock); } catch {}
  }
}

export async function uninstall(options) {
  const {result:plan,l,receipt} = await context(options);
  plan.kind = 'uninstall';
  plan.targetReleaseVersion=null;plan.targetSource=null;plan.targetPreset=null;recordMetadata(plan,null);
  if (receipt.text === null) { plan.status = 'unchanged'; return options.apply ? applyInstall(plan) : plan; }
  const record = validateReceipt(parseJson(receipt.text,'INVALID_RECEIPT'),plan);
  recordMetadata(plan,record);
  plan.warnings = record.warnings ?? [];
  await undoFiles(plan,record);
  change(plan,l.receipt,receipt,null,0o600);
  // Shared preferences and private transaction backups are retained for later configuration/removal.
  plan.status = 'planned';
  return options.apply ? applyInstall(plan) : plan;
}
