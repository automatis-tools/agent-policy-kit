import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { constants } from 'node:fs';
import { validatePolicy } from './policy.mjs';
import { parseToml, setTomlValue, restoreTomlValue, appendTomlHook, removeTomlHook } from './toml.mjs';

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
function locations(client, home, stateDir) {
  return {receipt:path.join(stateDir, 'installations', client + '.json'),policy:path.join(stateDir, 'policy.json'),
    config:path.join(home, client === 'codex' ? '.codex/config.toml' : client === 'claude' ? '.claude/settings.json' : '.kimi-code/config.toml'),
    hooks:path.join(home, '.codex/hooks.json'),launcher:path.join(stateDir, 'bin/kimi-policy')};
}
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
function shell(value) { return "'" + value.replaceAll("'", "'\"'\"'") + "'"; }
function command({nodePath, packageRoot, client, stateDir, home}) {
  return [nodePath,path.join(packageRoot,'bin/agent-policy.mjs'),'hook','--client',client,'--policy',path.join(stateDir,'policy.json'),'--state-dir',stateDir,'--home',home].map(shell).join(' ');
}
function ensureObject(parent, key) {
  if (!own(parent,key)) parent[key] = {};
  if (!object(parent[key])) fail('UNSUPPORTED_CONFIG');
  return parent[key];
}
function jsonInstall(text, client, cmd, maxConcurrent, defaultModel) {
  const value = configJson(text), ops = [], created = [];
  if (!own(value,'hooks')) created.push(['hooks']);
  const hooks = ensureObject(value,'hooks');
  for (const [event, matcher] of [['PreToolUse',client === 'codex' ? '^(spawn_agent|Agent)$' : '^Agent$'], ['SubagentStart',null], ['SubagentStop',null]]) {
    if (!own(hooks,event)) { hooks[event] = []; created.push(['hooks',event]); }
    if (!Array.isArray(hooks[event]) || hooks[event].some(e => !object(e))) fail('UNSUPPORTED_CONFIG');
    const entry = {...(matcher ? {matcher} : {}),hooks:[{type:'command',command:cmd,timeout:10}]};
    if (hooks[event].some(e => equal(e,entry))) fail('OWNERSHIP_CONFLICT');
    hooks[event].push(entry);
    ops.push({kind:'entry',path:['hooks',event],entry});
  }
  if (client === 'claude') {
    if (!own(value,'env')) created.push(['env']);
    const env = ensureObject(value,'env');
    for (const [key, after] of [['CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS',String(maxConcurrent)],['CLAUDE_CODE_SUBAGENT_MODEL',defaultModel]]) {
      if (own(env,key) && typeof env[key] !== 'string') fail('UNSUPPORTED_CONFIG');
      ops.push({kind:'value',path:['env',key],existed:own(env,key),before:env[key] ?? null,after});
      env[key] = after;
    }
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
    if (op.kind === 'entry') {
      if (!Array.isArray(parent[key])) fail('OWNED_DRIFT');
      const matches = parent[key].flatMap((v,i) => equal(v,op.entry) ? [i] : []);
      if (matches.length !== 1) fail('OWNED_DRIFT');
      parent[key].splice(matches[0],1);
    } else {
      if (!equal(parent[key],op.after)) fail('OWNED_DRIFT');
      if (op.existed) parent[key] = op.before; else delete parent[key];
    }
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
function validateReceipt(r, plan) {
  const l = locations(plan.client,plan.home,plan.stateDir);
  const allowed = plan.client === 'codex' ? [l.config,l.hooks] : plan.client === 'claude' ? [l.config] : [l.config,l.launcher];
  if (!object(r) || r.schemaVersion !== 1 || r.client !== plan.client || r.home !== plan.home || r.stateDir !== plan.stateDir || !Array.isArray(r.files) || r.files.length !== allowed.length || !r.files.every(f => object(f) && allowed.includes(f.path)) || new Set(r.files.map(f=>f.path)).size !== allowed.length) fail('INVALID_RECEIPT');
  if (absolute(r.packageRoot) !== r.packageRoot || absolute(r.nodePath) !== r.nodePath || !Number.isInteger(r.maxConcurrent) || r.maxConcurrent < 1 || r.maxConcurrent > 32 || typeof r.defaultModel !== 'string' || !Array.isArray(r.warnings) || !r.warnings.every(w => ['codex-hook-trust-required','kimi-native-pool-unverified','kimi-swarm-cap-launcher-only','kimi-ordinary-agent-concurrency-unsupported'].includes(w))) fail('INVALID_RECEIPT');
  const cmd = command({...plan,packageRoot:r.packageRoot,nodePath:r.nodePath});
  for (const f of r.files) {
    if (typeof f.existed !== 'boolean') fail('INVALID_RECEIPT');
    if (f.type === 'owned') { if (f.path !== l.launcher || typeof f.afterHash !== 'string') fail('INVALID_RECEIPT'); }
    else if (f.type === 'json') {
      if (f.path !== (plan.client === 'codex' ? l.hooks : l.config) || !Array.isArray(f.ops) || !Array.isArray(f.created)) fail('INVALID_RECEIPT');
      if (!f.ops.every(object)) fail('INVALID_RECEIPT');
      const expectedPaths = [['hooks','PreToolUse'],['hooks','SubagentStart'],['hooks','SubagentStop'],...(plan.client === 'claude' ? [['env','CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS'],['env','CLAUDE_CODE_SUBAGENT_MODEL']] : [])];
      if (f.ops.length !== expectedPaths.length || !expectedPaths.every(p => f.ops.filter(op => equal(op.path,p)).length === 1)) fail('INVALID_RECEIPT');
      for (const op of f.ops) {
        if (!object(op) || !Array.isArray(op.path) || op.path.length !== 2) fail('INVALID_RECEIPT');
        if (op.kind === 'entry') {
          if (op.path[0] !== 'hooks' || !['PreToolUse','SubagentStart','SubagentStop'].includes(op.path[1]) || !object(op.entry)) fail('INVALID_RECEIPT');
          const matcher = op.path[1] === 'PreToolUse' ? (plan.client === 'codex' ? '^(spawn_agent|Agent)$' : '^Agent$') : null;
          if (!equal(op.entry,{...(matcher ? {matcher} : {}),hooks:[{type:'command',command:cmd,timeout:10}]})) fail('INVALID_RECEIPT');
        } else if (op.kind !== 'value' || plan.client !== 'claude' || op.path[0] !== 'env' || !['CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS','CLAUDE_CODE_SUBAGENT_MODEL'].includes(op.path[1]) || typeof op.existed !== 'boolean' || op.after !== (op.path[1] === 'CLAUDE_CODE_SUBAGENT_MODEL' ? r.defaultModel : String(r.maxConcurrent)) || (op.existed && typeof op.before !== 'string')) fail('INVALID_RECEIPT');
      }
      if (!f.created.every(k => equal(k,['hooks']) || equal(k,['env']) || (Array.isArray(k) && k.length === 2 && k[0] === 'hooks' && ['PreToolUse','SubagentStart','SubagentStop'].includes(k[1])))) fail('INVALID_RECEIPT');
    } else if (f.type === 'toml') {
      if (f.path !== l.config || !Array.isArray(f.ops)) fail('INVALID_RECEIPT');
      if (!f.ops.every(object)) fail('INVALID_RECEIPT');
      for (const op of f.ops) {
        if (plan.client === 'codex') {
          if (op.kind !== 'scalar' || ![['features','hooks'],['agents','max_concurrent_threads_per_session']].some(p => equal(p,op.path)) || (op.before !== null && typeof op.before !== 'string')) fail('INVALID_RECEIPT');
          if (op.after !== (op.path[0] === 'features' ? 'true' : String(r.maxConcurrent)) || (op.addedTable && !equal(op.addedTable,op.path.slice(0,-1)))) fail('INVALID_RECEIPT');
          if (op.before !== null) {
            let previous;
            try { previous = parseToml(`value = ${op.before}\n`); } catch { fail('INVALID_RECEIPT'); }
            if (Object.keys(previous).length !== 1 || (op.path[0] === 'features' ? typeof previous.value !== 'boolean' : !Number.isSafeInteger(previous.value))) fail('INVALID_RECEIPT');
          }
        } else if (op.kind !== 'hook' || !equal(op.entry,{event:'PreToolUse',matcher:'^(Agent|AgentSwarm)$',command:cmd,timeout:10})) fail('INVALID_RECEIPT');
      }
      if (plan.client === 'codex' ? (f.ops.length !== 2 || new Set(f.ops.map(o=>o.path.join('.'))).size !== 2) : f.ops.length !== 1) fail('INVALID_RECEIPT');
    } else fail('INVALID_RECEIPT');
  }
  return r;
}
async function undoFiles(plan,r,verifyOnly=false) {
  const base = allowedBases(plan);
  for (const file of r.files) {
    const before = await readDependency(plan,file.path,base(file.path));
    if (before.text === null) fail('OWNED_DRIFT');
    let after;
    if (file.type === 'json') after = undoJson(before.text,file);
    else if (file.type === 'toml') {
      after = before.text;
      for (const op of file.ops.toReversed()) after = op.kind === 'hook' ? removeTomlHook(after,op) : restoreTomlValue(after,op);
      if (!file.existed && !after.trim()) after = null;
    } else { if (digest(before.text) !== file.afterHash) fail('OWNED_DRIFT'); after = null; }
    if (!verifyOnly) change(plan,file.path,before,after,before.mode);
  }
}
function kimiPoolMatches(native,config) {
  const pool = native.secondary_model;
  if (!object(pool?.models) || typeof pool.default_model !== 'string' || !own(pool.models,pool.default_model) || native.thinking?.enabled === false || pool.default_effort !== undefined) return false;
  return Object.values(config?.profiles ?? {}).every(profile => {
    const model = native.models?.[profile.model];
    const effective = model && {...model,...(model.overrides ?? {})};
    return typeof pool.models[profile.model] === 'string' && object(model)
      && typeof model.provider === 'string' && model.model === profile.providerModel
      && Number.isSafeInteger(effective.max_context_size) && effective.max_context_size > 0
      && Array.isArray(effective.support_efforts) && effective.support_efforts.includes(profile.effort)
      && effective.default_effort === profile.effort;
  });
}

export async function planInstall(options) {
  const {result:plan,l,receipt} = await context(options);
  plan.kind = 'install';
  if (plan.client === 'agy') return {...plan,status:'unsupported',warnings:['agy-exact-model-enforcement-unsupported']};
  plan.packageRoot = absolute(options.packageRoot); plan.nodePath = absolute(options.nodePath);
  plan.policyPath = absolute(options.policyPath);
  const policySource = await readDependency(plan,plan.policyPath,path.dirname(plan.policyPath));
  if (policySource.text === null) fail('INVALID_POLICY');
  const policy = parseJson(policySource.text,'INVALID_POLICY');
  try { validatePolicy(policy); } catch { fail('INVALID_POLICY'); }
  if (!own(policy.clients,plan.client)) fail('INVALID_POLICY');
  const selected = policy.clients[plan.client], maxConcurrent = selected.maxConcurrent;
  const defaultModel = selected.profiles[selected.defaultProfile].model;
  const policyText = json(policy);
  const policyHash = digest(json(canonical(policy)));
  const policyBefore = await readDependency(plan,l.policy,plan.stateDir);
  if (receipt.text !== null) {
    const r = validateReceipt(parseJson(receipt.text,'INVALID_RECEIPT'),plan);
    if (r.packageRoot !== plan.packageRoot || r.nodePath !== plan.nodePath || r.policyHash !== policyHash) fail('INSTALLATION_CONFLICT');
    await undoFiles(plan,r,true);
    if (policyBefore.text === null || !equal(parseJson(policyBefore.text,'OWNED_DRIFT'),policy)) fail('OWNED_DRIFT');
    return {...plan,status:'unchanged',warnings:r.warnings ?? []};
  }
  if (policyBefore.text !== null && !equal(parseJson(policyBefore.text,'POLICY_CONFLICT'),policy)) fail('POLICY_CONFLICT');
  const cmd = command(plan), files = [];
  const config = await readDependency(plan,l.config,plan.home);
  if (plan.client === 'claude' || plan.client === 'codex') {
    const target = plan.client === 'codex' ? l.hooks : l.config;
    const before = plan.client === 'codex' ? await readDependency(plan,target,plan.home) : config;
    const edited = jsonInstall(before.text,plan.client,cmd,maxConcurrent,defaultModel);
    change(plan,target,before,edited.text,before.mode);
    files.push({path:target,type:'json',existed:before.text !== null,ops:edited.ops,created:edited.created});
  }
  if (plan.client === 'codex') {
    let text = config.text ?? '';
    const native = parseToml(text);
    if (native.agents && own(native.agents,'max_threads')) fail('CODEX_CAP_ALIAS_CONFLICT');
    const priorCap = native.agents?.max_concurrent_threads_per_session;
    if ((priorCap !== undefined && (!Number.isSafeInteger(priorCap) || priorCap < 1)) || (native.features?.hooks !== undefined && typeof native.features.hooks !== 'boolean')) fail('UNSUPPORTED_CONFIG');
    const ops = [];
    for (const [keys,v] of [[['agents','max_concurrent_threads_per_session'],maxConcurrent],[['features','hooks'],true]]) {
      const edit = setTomlValue(text,keys,v); text = edit.text; ops.push(edit.ownership);
    }
    change(plan,l.config,config,text,config.mode);
    files.push({path:l.config,type:'toml',existed:config.text !== null,ops});
    plan.warnings.push('codex-hook-trust-required');
  } else if (plan.client === 'kimi') {
    const text = config.text ?? '', native = parseToml(text);
    if (!kimiPoolMatches(native,policy.clients.kimi)) plan.warnings.push('kimi-native-pool-unverified');
    plan.warnings.push('kimi-swarm-cap-launcher-only','kimi-ordinary-agent-concurrency-unsupported');
    const edit = appendTomlHook(text,{event:'PreToolUse',matcher:'^(Agent|AgentSwarm)$',command:cmd,timeout:10});
    change(plan,l.config,config,edit.text,config.mode);
    files.push({path:l.config,type:'toml',existed:config.text !== null,ops:[edit.ownership]});
    const launcher = await readDependency(plan,l.launcher,plan.stateDir);
    if (launcher.text !== null) fail('OWNERSHIP_CONFLICT');
    const launch = [plan.nodePath,path.join(plan.packageRoot,'bin/agent-policy.mjs'),'run','--client','kimi','--home',plan.home,'--policy',l.policy,'--state-dir',plan.stateDir,'--'].map(shell).join(' ');
    const launcherText = `#!/bin/sh\n# Owned by agent-policy-kit\nexec ${launch} "$@"\n`;
    change(plan,l.launcher,launcher,launcherText,0o700);
    files.push({path:l.launcher,type:'owned',existed:false,afterHash:digest(launcherText)});
  }
  change(plan,l.policy,policyBefore,policyBefore.text ?? policyText,0o600);
  const record = {schemaVersion:1,client:plan.client,home:plan.home,stateDir:plan.stateDir,packageRoot:plan.packageRoot,nodePath:plan.nodePath,maxConcurrent,defaultModel,policyHash,warnings:plan.warnings,files};
  change(plan,l.receipt,receipt,json(record),0o600);
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
  const l = locations(plan.client,plan.home,plan.stateDir), allowed = [l.config,l.policy,l.receipt,...(plan.client === 'codex' ? [l.hooks] : []),...(plan.client === 'kimi' ? [l.launcher] : [])];
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
  if (plan.status === 'unsupported') return {status:'unsupported',client:plan.client,changedFiles:0,warnings:[...plan.warnings]};
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
  // Shared policy, private backups and audit records are intentionally retained.
  plan.status = 'planned';
  return options.apply ? applyInstall(plan) : plan;
}
