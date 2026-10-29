import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { constants } from 'node:fs';
import { validatePolicy } from './policy.mjs';
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
function tomlSettings(client,preferences,maxConcurrent) {
  if(client==='codex')return [[['agents','max_concurrent_threads_per_session'],maxConcurrent],[['agents','default_subagent_model'],preferences.code.model],[['agents','default_subagent_reasoning_effort'],preferences.code.effort]];
  if(client!=='kimi')return [];
  const selected=[...new Map([preferences.code,preferences.light].map(v=>[v.model,v])).values()];
  return [[['secondary_model','default_model'],preferences.code.model],...selected.map(v=>[['secondary_model','models',v.model],v.model===preferences.code.model?'Implementation and difficult analysis; apk-worker and apk-reviewer.':'Search and mechanical tasks; apk-explorer and apk-routine.']),...selected.map(v=>[['models',v.model,'overrides','default_effort'],v.effort])];
}
function validPriorLiteral(raw,type) {
  if(raw===null)return true;
  if(typeof raw!=='string')return false;
  try { const parsed=parseToml(`value = ${raw}\n`);return Object.keys(parsed).length===1&&typeof parsed.value===type&& (type!=='number'||Number.isSafeInteger(parsed.value)); } catch { return false; }
}
function validateReceipt(r,plan) {
  if(object(r)&&(r.schemaVersion===1||own(r,'packageRoot')||own(r,'nodePath')||own(r,'mode')||(Array.isArray(r.files)&&r.files.some(f=>object(f)&&(['owned','hook'].includes(f.type)||(Array.isArray(f.ops)&&f.ops.some(op=>object(op)&&['hook','entry'].includes(op.kind))))))))fail('LEGACY_RUNTIME_RECEIPT');
  const l=locations(plan.client,plan.home,plan.stateDir),allowed=nativeTargets(l);
  if(!object(r)||r.schemaVersion!==2||r.kind!=='native-config'||r.client!==plan.client||r.home!==plan.home||r.stateDir!==plan.stateDir||!Array.isArray(r.files)||r.files.length!==allowed.length||!r.files.every(f=>object(f)&&allowed.includes(f.path))||new Set(r.files.map(f=>f.path)).size!==allowed.length||!/^[a-f0-9]{64}$/.test(r.policyHash))fail('INVALID_RECEIPT');
  try { validatePolicy({schemaVersion:1,maxConcurrent:r.maxConcurrent,clients:{[plan.client]:r.preferences}}); }catch {fail('INVALID_RECEIPT');}
  if(!equal(r.warnings,nativeWarnings(plan.client)))fail('INVALID_RECEIPT');
  const roles=nativeRoles(plan.client,r.preferences),block=instructionBlock(plan.client,r.preferences,r.maxConcurrent);
  for(const f of r.files) {
    if(typeof f.existed!=='boolean')fail('INVALID_RECEIPT');
    if(l.roles.includes(f.path)) {
      if(f.type!=='role'||f.existed||f.afterHash!==digest(roles[l.roles.indexOf(f.path)]))fail('INVALID_RECEIPT');
    } else if(f.path===l.instructions) {
      if(f.type!=='instructions'||f.block!==block||!['','\n','\n\n'].includes(f.prefix))fail('INVALID_RECEIPT');
    } else if(plan.client==='claude') {
      if(f.type!=='json'||!Array.isArray(f.ops)||f.ops.length!==2||!Array.isArray(f.created)||f.created.length>1||!f.created.every(p=>equal(p,['env'])))fail('INVALID_RECEIPT');
      for(const [i,key]of ['CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS','CLAUDE_CODE_SUBAGENT_MODEL'].entries()) {
        const op=f.ops[i],after=i===0?String(r.maxConcurrent):r.preferences.code.model;
        if(!object(op)||op.kind!=='value'||!equal(op.path,['env',key])||typeof op.existed!=='boolean'||op.after!==after||(op.existed?typeof op.before!=='string':op.before!==null))fail('INVALID_RECEIPT');
      }
    } else {
      const expected=tomlSettings(plan.client,r.preferences,r.maxConcurrent);
      if(f.type!=='toml'||!Array.isArray(f.ops)||!f.ops.every(object))fail('INVALID_RECEIPT');
      const removed=f.ops.filter(op=>op.kind==='removed');
      if(removed.length!==(plan.client==='kimi'?1:0)||(removed.length&&f.ops[0]!==removed[0])||f.ops.length!==expected.length+removed.length)fail('INVALID_RECEIPT');
      const scalars=f.ops.filter(op=>op.kind==='scalar');
      for(const [i,[keys,value]]of expected.entries()) {
        const op=scalars[i];
        if(!object(op)||!equal(op.path,keys)||op.after!==JSON.stringify(value)||!validPriorLiteral(op.before,typeof value)||(op.addedTable&&!equal(op.addedTable,keys.slice(0,-1))))fail('INVALID_RECEIPT');
      }
      if(scalars.length!==expected.length)fail('INVALID_RECEIPT');
      for(const op of removed)if(!equal(op.path,['secondary_model','default_effort'])||!validPriorLiteral(op.before,'string'))fail('INVALID_RECEIPT');
    }
  }
  return r;
}
async function undoFiles(plan,r,verifyOnly=false) {
  for(const file of r.files) {
    const before=await readDependency(plan,file.path,plan.home);if(before.text===null)fail('OWNED_DRIFT');let after;
    if(file.type==='json')after=undoJson(before.text,file);
    else if(file.type==='toml') { after=before.text;for(const op of file.ops.toReversed())after=restoreTomlValue(after,op);if(!file.existed&&!after.trim())after=null; }
    else if(file.type==='instructions') {
      const owned=file.prefix+file.block;
      if(before.text.split(BEGIN).length!==2||before.text.split(END).length!==2||!before.text.includes(owned))fail('OWNED_DRIFT');
      after=before.text.replace(owned,'');if(!file.existed&&!after)after=null;
    } else {if(digest(before.text)!==file.afterHash)fail('OWNED_DRIFT');after=null;}
    if(!verifyOnly)change(plan,file.path,before,after,before.mode);
  }
}
function prerequisite(plan,warning) {return {...plan,status:'prerequisite',warnings:[warning],changes:[]};}
function kimiPrerequisite(native,preferences) {
  if(native.thinking?.enabled===false)return 'kimi-thinking-disabled';
  for(const selected of [preferences.code,preferences.light]) {
    const model=native.models?.[selected.model];
    if(!object(model)||typeof model.provider!=='string'||typeof model.model!=='string'||!Number.isSafeInteger(model.max_context_size)||model.max_context_size<1||!object(native.providers?.[model.provider]))return 'kimi-provisioned-models-required';
    const effective={...model,...model.overrides};
    if(!Array.isArray(effective.support_efforts)||!effective.support_efforts.includes(selected.effort))return 'kimi-supported-effort-required';
    const globalEffort=native.thinking?.effort;
    const mainEffortPinned=['low','medium','high','xhigh','max'].includes(globalEffort)&&effective.support_efforts.includes(globalEffort);
    if(selected.model===native.default_model&&effective.default_effort!==selected.effort&&!mainEffortPinned)return 'kimi-main-effort-conflict';
  }
  return null;
}
export async function planInstall(options) {
  const {result:plan,l,receipt}=await context(options);plan.kind='install';
  // Refuse experimental runtime receipts before reading or rewriting configuration.
  let record=null;
  if(receipt.text!==null)record=validateReceipt(parseJson(receipt.text,'INVALID_RECEIPT'),plan);
  plan.policyPath=absolute(options.policyPath);
  const source=await readDependency(plan,plan.policyPath,path.dirname(plan.policyPath));if(source.text===null)fail('INVALID_POLICY');
  const policy=parseJson(source.text,'INVALID_POLICY');try {validatePolicy(policy);}catch {fail('INVALID_POLICY');}
  if(!own(policy.clients,plan.client))fail('INVALID_POLICY');
  const selected=policy.clients[plan.client],maxConcurrent=policy.maxConcurrent,policyHash=digest(json(canonical(policy)));
  const policyBefore=await readDependency(plan,l.policy,plan.stateDir);
  if(record) {
    if(record.policyHash!==policyHash)fail('INSTALLATION_CONFLICT');
    await undoFiles(plan,record,true);
    if(policyBefore.text===null||!equal(parseJson(policyBefore.text,'OWNED_DRIFT'),policy))fail('OWNED_DRIFT');
    return {...plan,status:'unchanged',warnings:record.warnings};
  }
  if(policyBefore.text!==null&&!equal(parseJson(policyBefore.text,'POLICY_CONFLICT'),policy))fail('POLICY_CONFLICT');
  const config=l.config?await readDependency(plan,l.config,plan.home):null;
  let native;
  if(plan.client==='claude') {
    native=configJson(config.text);
    if(native.env!==undefined&&!object(native.env))fail('UNSUPPORTED_CONFIG');
    if(native.env?.CLAUDE_CODE_SUBAGENT_MODEL_FORCE==='1')return prerequisite(plan,'claude-force-model-conflict');
  } else if(config) {
    native=parseToml(config.text??'');
    if(plan.client==='kimi'){const required=kimiPrerequisite(native,selected);if(required)return prerequisite(plan,required);if(native.secondary_model?.default_effort!==undefined&&typeof native.secondary_model.default_effort!=='string')fail('UNSUPPORTED_CONFIG');}
    if(plan.client==='codex') {
      if(native.agents&&own(native.agents,'max_threads'))fail('CODEX_CAP_ALIAS_CONFLICT');
      const cap=native.agents?.max_concurrent_threads_per_session;
      if(cap!==undefined&&(!Number.isSafeInteger(cap)||cap<1))fail('UNSUPPORTED_CONFIG');
    }
  }
  const files=[];plan.warnings=nativeWarnings(plan.client);
  if(plan.client==='claude') {
    const edited=jsonInstall(config.text,maxConcurrent,selected.code.model);change(plan,l.config,config,edited.text,config.mode);
    files.push({path:l.config,type:'json',existed:config.text!==null,ops:edited.ops,created:edited.created});
  } else if(config) {
    let text=config.text??'';const ops=[];
    if(plan.client==='kimi') {const edit=removeTomlValue(text,['secondary_model','default_effort']);text=edit.text;if(edit.ownership)ops.push(edit.ownership);}
    for(const[keys,value]of tomlSettings(plan.client,selected,maxConcurrent)) {
      const previous=keys.reduce((at,key)=>at?.[key],native);
      if(previous!==undefined&&typeof previous!==typeof value)fail('UNSUPPORTED_CONFIG');
      const edit=setTomlValue(text,keys,value);text=edit.text;ops.push(edit.ownership);
    }
    change(plan,l.config,config,text,config.mode);files.push({path:l.config,type:'toml',existed:config.text!==null,ops});
  }
  const roles=nativeRoles(plan.client,selected);
  for(const[i,target]of l.roles.entries()) {
    const before=await readDependency(plan,target,plan.home);if(before.text!==null)fail('OWNERSHIP_CONFLICT');
    change(plan,target,before,roles[i]);files.push({path:target,type:'role',existed:false,afterHash:digest(roles[i])});
  }
  const before=await readDependency(plan,l.instructions,plan.home),text=before.text??'';
  if(text.includes(BEGIN)||text.includes(END))fail('OWNERSHIP_CONFLICT');
  const prefix=!text||text.endsWith('\n\n')?'':text.endsWith('\n')?'\n':'\n\n';
  const block=instructionBlock(plan.client,selected,maxConcurrent);
  change(plan,l.instructions,before,text+prefix+block,before.mode);
  files.push({path:l.instructions,type:'instructions',existed:before.text!==null,prefix,block});
  change(plan,l.policy,policyBefore,policyBefore.text??json(policy),0o600);
  const r={schemaVersion:2,kind:'native-config',client:plan.client,home:plan.home,stateDir:plan.stateDir,maxConcurrent,preferences:selected,policyHash,warnings:plan.warnings,files};
  change(plan,l.receipt,receipt,json(r),0o600);
  return {...plan,status:'planned'};
}

export function summarizePlan(plan) {
  const relative = file => within(plan.home,file) ? '~/' + path.relative(plan.home,file).split(path.sep).join('/') : '<state-dir>/' + path.relative(plan.stateDir,file).split(path.sep).join('/');
  return {client:plan.client,kind:plan.kind,status:plan.status,files:plan.changes.map(c => ({path:relative(c.path),action:c.after === null ? 'remove' : c.before === null ? 'create' : 'update'})),warnings:[...plan.warnings]};
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
  if (plan.status === 'prerequisite') return {status:'prerequisite',client:plan.client,changedFiles:0,warnings:[...plan.warnings]};
  await safePath(plan.home,path.parse(plan.home).root);
  await safePath(plan.stateDir,path.parse(plan.stateDir).root);
  if (!plan.changes.length) {
    await recoveryRequired(plan.stateDir);
    await verifyDependencies(plan);
    return {status:'unchanged',client:plan.client,changedFiles:0,warnings:[...plan.warnings]};
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
    return {status:'applied',client:plan.client,changedFiles:plan.changes.length,warnings:[...plan.warnings]};
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
  if (receipt.text === null) { plan.status = 'unchanged'; return options.apply ? applyInstall(plan) : plan; }
  const record = validateReceipt(parseJson(receipt.text,'INVALID_RECEIPT'),plan);
  plan.warnings = record.warnings ?? [];
  await undoFiles(plan,record);
  change(plan,l.receipt,receipt,null,0o600);
  // Shared preferences and private transaction backups are retained for later configuration/removal.
  plan.status = 'planned';
  return options.apply ? applyInstall(plan) : plan;
}
