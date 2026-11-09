import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {parseToml} from './toml.mjs';
import {CLIENTS,NATIVE_EFFORTS} from './policy.mjs';
import {inspectConfiguration} from './install.mjs';
import {claudeSubagentCacheOverride} from './native.mjs';

const ROOTS={chatgpt:'.codex',claude:'.claude',kimi:'.kimi-code',gemini:'.gemini',grok:'.grok'};
const ENV_ROOTS={chatgpt:'CODEX_HOME',claude:'CLAUDE_CONFIG_DIR',kimi:'KIMI_CODE_HOME',grok:'GROK_HOME'};
const MAX_FILE=1024*1024,MAX_TOTAL=4*MAX_FILE,MAX_ENTRIES=256;
const identifier=/^[A-Za-z0-9][A-Za-z0-9._:@/\[\]-]{0,127}$/;
const namePattern=/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,79}$/;
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const failure=code=>Object.assign(new Error(code),{code});
function safeString(value,pattern=identifier){
 if(typeof value!=='string'||!pattern.test(value)||/^(?:sk-|ghp_|github_pat_)/.test(value)||/\/(?:Users|home)\//.test(value))throw failure('UNSUPPORTED_NATIVE_SETTING');
 return value;
}
async function safePath(target){
 let current=path.parse(target).root;
 for(const part of path.relative(current,target).split(path.sep).filter(Boolean)){
  current=path.join(current,part);
  try{if((await fs.lstat(current)).isSymbolicLink())throw failure('UNSAFE_FILE');}
  catch(error){if(error.code==='ENOENT')return;throw error;}
 }
}
async function readFile(file,budget){
 await safePath(file);
 let handle;
 try{
  handle=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const before=await handle.stat();
  if(!before.isFile())throw failure('UNSAFE_FILE');
  if(before.size>MAX_FILE||budget.bytes+before.size>MAX_TOTAL)throw failure('INSPECTION_LIMIT');
  const buffer=Buffer.alloc(MAX_FILE+1);let size=0;
  while(size<buffer.length){const chunk=await handle.read(buffer,size,buffer.length-size,null);if(!chunk.bytesRead)break;size+=chunk.bytesRead;}
  const after=await handle.stat();
  budget.bytes+=size;
  if(size>MAX_FILE||budget.bytes>MAX_TOTAL)throw failure('INSPECTION_LIMIT');
  if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||size!==after.size)throw failure('CONFIG_CHANGED_DURING_READ');
  return buffer.subarray(0,size).toString('utf8');
 }catch(error){if(error.code==='ENOENT')return null;throw error;}
 finally{await handle?.close();}
}
function warning(client,error){
 const allowed=['UNSAFE_FILE','INSPECTION_LIMIT','CONFIG_CHANGED_DURING_READ','UNSUPPORTED_NATIVE_SETTING','UNSUPPORTED_ROLE_FORMAT','UNSUPPORTED_ROLE_EFFORT','UNSUPPORTED_ROLE_CAPABILITY','INVALID_TOML','INVALID_JSON','EACCES','EPERM','NATIVE_CAP_CONFLICT','EXTERNAL_ROLE_REFERENCES_NOT_READ'];
 const code=allowed.includes(error?.code)?error.code:'NATIVE_READ_FAILED';
 if(!client.warnings.includes(code))client.warnings.push(code);
 client.status='attention';
}
function scalar(value){
 const text=value.trim();
 if(text.startsWith('"')){const match=text.match(/^("(?:[^"\\]|\\.)*")\s*(?:#.*)?$/);if(!match)throw failure('UNSUPPORTED_ROLE_FORMAT');try{return JSON.parse(match[1]);}catch{throw failure('UNSUPPORTED_ROLE_FORMAT');}}
 if(text.startsWith("'")){const match=text.match(/^'((?:[^']|'')*)'\s*(?:#.*)?$/);if(!match)throw failure('UNSUPPORTED_ROLE_FORMAT');return match[1].replaceAll("''", "'");}
 const match=text.match(/^([A-Za-z0-9][A-Za-z0-9._:@/\[\]-]*)(?:\s+#.*)?$/);
 if(!match)throw failure('UNSUPPORTED_ROLE_FORMAT');
 return match[1];
}
// Values that Grok Build 1.0.70 accepts for capabilityMode (serde kebab-case names and aliases of SubagentCapabilityMode).
const GROK_CAPABILITY_MODES=['read-only','readonly','readOnly','read_only','ReadOnly','read-write','readwrite','readWrite','read_write','ReadWrite','execute','Execute','EXECUTE','all','All','ALL'];
function frontmatter(text,id){
 const match=text.replace(/^\uFEFF/,'').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
 if(!match)throw failure('UNSUPPORTED_ROLE_FORMAT');
 const fields={};
 let experimental=false;
 for(const line of match[1].split(/\r?\n/)){
  // YAML merges, quoted keys and flow mappings can supply model fields that
  // this deliberately small scalar reader cannot resolve safely.
  if(/^(?:<<\s*:|["'{\[])/.test(line))throw failure('UNSUPPORTED_ROLE_FORMAT');
  if(id==='claude'){
   // The only nested value this reader takes. Other maps stay unread.
   if(/^\S/.test(line))experimental=/^experimental[ \t]*:\s*(?:#.*)?$/.test(line);
   const nested=experimental?line.match(/^[ \t]+cacheTtl[ \t]*:\s*(.*)$/):null;
   if(nested){
    if(Object.hasOwn(fields,'cacheTtl'))throw failure('UNSUPPORTED_ROLE_FORMAT');
    const value=scalar(nested[1]);if(['5m','1h'].includes(value))fields.cacheTtl=value;
    continue;
   }
  }
  const field=line.match(id==='grok'?/^(name|model|effort|subagent|capabilityMode)[ \t]*:\s*(.*)$/:/^(name|model|effort|subagent)[ \t]*:\s*(.*)$/);
  if(!field)continue;
  if(Object.hasOwn(fields,field[1]))throw failure('UNSUPPORTED_ROLE_FORMAT');
  if(field[1]==='subagent'){
   const boolean=field[2].trim().match(/^(true|false)(?:\s+#.*)?$/);
   if(!boolean)throw failure('UNSUPPORTED_ROLE_FORMAT');
   fields.subagent=boolean[1]==='true';
  }else if(field[1]==='capabilityMode'){
   // Keep a value Grok Build would reject without echoing it; it only selects a warning.
   const raw=field[2].trim().replace(/\s+#.*$/,''),quoted=raw.match(/^(["'])(.*)\1$/),value=quoted?quoted[2]:raw;
   fields.capabilityMode=GROK_CAPABILITY_MODES.includes(value)?value:null;
  }else fields[field[1]]=scalar(field[2]);
 }
 if(!fields.name)throw failure('UNSUPPORTED_ROLE_FORMAT');
 return fields;
}
function cap(value){if(!Number.isSafeInteger(value)||value<1)throw failure('UNSUPPORTED_NATIVE_SETTING');return value;}
function optionalString(value,pattern){return value===undefined?null:safeString(value,pattern);}
function extractSettings(client,id,native,env,models){
 if(!record(native))throw failure('UNSUPPORTED_NATIVE_SETTING');
 if(id==='grok'){
  const subagents=native.subagents??{};if(!record(subagents))throw failure('UNSUPPORTED_NATIVE_SETTING');
  const configured=subagents.models??{};if(!record(configured)||Object.keys(configured).length>MAX_ENTRIES)throw failure(record(configured)?'INSPECTION_LIMIT':'UNSUPPORTED_NATIVE_SETTING');
  for(const[name,model]of Object.entries(configured))models.set(safeString(name,namePattern),safeString(model));
  client.defaults.model=models.get('general-purpose')??null;
  if(subagents.max_concurrent!==undefined)client.concurrency.value=cap(subagents.max_concurrent);
  return;
 }
 if(id==='chatgpt'){
  const agents=native.agents??{};if(!record(agents))throw failure('UNSUPPORTED_NATIVE_SETTING');
  client.defaults.model=optionalString(agents.default_subagent_model);
  client.defaults.effort=optionalString(agents.default_subagent_reasoning_effort);
  if(agents.enabled!==undefined){if(typeof agents.enabled!=='boolean')throw failure('UNSUPPORTED_NATIVE_SETTING');client.defaults.enabled=agents.enabled;}
  const current=agents.max_concurrent_threads_per_session,legacy=agents.max_threads;
  if(current!==undefined&&legacy!==undefined&&current!==legacy)throw failure('NATIVE_CAP_CONFLICT');
  if(current!==undefined||legacy!==undefined)client.concurrency.value=cap(current??legacy);
  if(Object.values(agents).some(value=>record(value)&&value.config_file!==undefined))warning(client,failure('EXTERNAL_ROLE_REFERENCES_NOT_READ'));
 }else if(id==='claude'){
  const stored=native.env??{};if(!record(stored))throw failure('UNSUPPORTED_NATIVE_SETTING');
  client.defaults.model=optionalString(stored.CLAUDE_CODE_SUBAGENT_MODEL);
  client.defaults.effort=optionalString(stored.CLAUDE_CODE_SUBAGENT_EFFORT);
  const count=stored.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS;
  if(count!==undefined){if(typeof count!=='string'||!/^\d{1,9}$/.test(count))throw failure('UNSUPPORTED_NATIVE_SETTING');client.concurrency.value=cap(Number(count));}
  client.overrides={};
  for(const[key,field]of [['CLAUDE_CODE_SUBAGENT_MODEL','model'],['CLAUDE_CODE_SUBAGENT_EFFORT','subagentEffort'],['CLAUDE_CODE_EFFORT_LEVEL','effort']]){
   const value=env[key]??(field==='effort'?stored[key]:undefined);
   if(value!==undefined)client.overrides[field]=safeString(value);
  }
  if((env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE??stored.CLAUDE_CODE_SUBAGENT_MODEL_FORCE)==='1')client.overrides.forceModel=true;
  const subagentCacheTtl=claudeSubagentCacheOverride(native,env);if(subagentCacheTtl!==null)client.overrides.subagentCacheTtl=subagentCacheTtl;
  if(env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS!==undefined){if(!/^\d{1,9}$/.test(env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS))throw failure('UNSUPPORTED_NATIVE_SETTING');client.overrides.maxConcurrent=cap(Number(env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS));}
 }else if(id==='kimi'){
  const secondary=native.secondary_model??{};if(!record(secondary))throw failure('UNSUPPORTED_NATIVE_SETTING');
  client.defaults.model=optionalString(secondary.default_model);
  client.defaults.effort=optionalString(secondary.default_effort);
  const pool=secondary.models??{};if(!record(pool)||Object.keys(pool).length>MAX_ENTRIES)throw failure('INSPECTION_LIMIT');
  const aliases=new Set([...Object.keys(pool),...(client.defaults.model?[client.defaults.model]:[])]);
  for(const alias of aliases){
   const entry=native.models?.[alias];
   client.pool.push({alias:safeString(alias),effort:optionalString(secondary.default_effort??entry?.overrides?.default_effort??entry?.default_effort),configured:record(entry)});
  }
 }
}
async function rolesIn(directory,client,id,budget,models,depth=0){
 await safePath(directory);
 let directoryHandle;
 try{directoryHandle=await fs.opendir(directory);}catch(error){if(error.code==='ENOENT')return;throw error;}
 const entries=[];
 for await(const entry of directoryHandle){if(++budget.entries>MAX_ENTRIES)throw failure('INSPECTION_LIMIT');entries.push(entry);}
 for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name,'en'))){
  const file=path.join(directory,entry.name);
  try{
   if(entry.isSymbolicLink())throw failure('UNSAFE_FILE');
   if(entry.isDirectory()){
    if(id==='chatgpt')continue;
    if(depth>=4)throw failure('INSPECTION_LIMIT');
    await rolesIn(file,client,id,budget,models,depth+1);continue;
   }
   if(!entry.name.endsWith(id==='chatgpt'?'.toml':'.md'))continue;
   const body=await readFile(file,budget);if(body===null)throw failure('CONFIG_CHANGED_DURING_READ');
   const fields=id==='chatgpt'?parseToml(body):frontmatter(body,id);
   const role={name:safeString(fields.name,namePattern),model:optionalString(fields.model),effort:optionalString(id==='chatgpt'?fields.model_reasoning_effort:fields.effort)};
   if(id==='claude'&&fields.cacheTtl!==undefined)role.cacheTtl=fields.cacheTtl;
   if(id==='kimi'){
    // APK's Markdown role files contain explicit routing guidance, not a
    // native model binding. Other prose is never interpreted as configuration.
    role.model=null;role.effort=null;role.modelSelection='parent';
    if(role.name.startsWith('apk-')){
     const routing=body.match(/^The parent must select configured pool alias ([A-Za-z0-9][A-Za-z0-9._:@/\[\]-]{0,127}) for this role; Markdown frontmatter does not select a model\. Requested effort: (native default|[A-Za-z0-9_-]+)\.$/m);
     if(routing){role.model=safeString(routing[1]);role.effort=routing[2]==='native default'?null:safeString(routing[2]);role.modelSelection='guidance';}
    }
   }
   if(id==='grok'){
    // The native per-subagent model override lives in config.toml, not in the agent file; the effort lives in the agent frontmatter.
    role.model=models.get(role.name)??role.model;
    // Grok Build drops an agent whose frontmatter effort is not a level it accepts.
    if(role.effort!==null&&!NATIVE_EFFORTS.grok.includes(role.effort))warning(client,failure('UNSUPPORTED_ROLE_EFFORT'));
    // It also drops an agent whose capabilityMode is not a mode it accepts. The snake_case key is not a Grok field.
    if(fields.capabilityMode===null)warning(client,failure('UNSUPPORTED_ROLE_CAPABILITY'));
   }
   if(id==='gemini'){
    if(role.model!==null&&!['pro','flash','flash_lite','inherit'].includes(role.model))throw failure('UNSUPPORTED_NATIVE_SETTING');
    role.enabled=fields.subagent??null;
    if(fields.effort!==undefined){role.effort=null;warning(client,failure('UNSUPPORTED_ROLE_EFFORT'));}
   }
   if(client.roles.some(r=>r.name===role.name))throw failure('UNSUPPORTED_ROLE_FORMAT');
   client.roles.push(role);
  }catch(error){warning(client,error);}
 }
}
async function readGuidance(root,client,budget){
 const text=await readFile(path.join(root,'AGENTS.md'),budget);
 if(text===null)return;
 const blocks=[...text.matchAll(/<!-- BEGIN agent-policy-kit -->\r?\n([\s\S]*?)<!-- END agent-policy-kit -->/g)];
 if(!blocks.length)return;
 if(blocks.length!==1)throw failure('UNSUPPORTED_NATIVE_SETTING');
 const counts=[...blocks[0][1].matchAll(/^When delegating, run at most (\d+) subagents concurrently in this session\./gm)];
 if(counts.length!==1)throw failure('UNSUPPORTED_NATIVE_SETTING');
 client.concurrency.value=cap(Number(counts[0][1]));
}
export async function readConfiguration({client=null,home,env=process.env,explicitHome=false,stateDir=path.join(home,'.agent-policy-kit')}={}){
 if(!path.isAbsolute(home)||client!==null&&!CLIENTS.includes(client))throw failure('INVALID_CLIENT');
 const report={schemaVersion:1,scope:'user',modelExecution:'not_checked',clients:{}};
 for(const id of client?[client]:CLIENTS){
  const root=path.resolve(!explicitHome&&env[ENV_ROOTS[id]]?env[ENV_ROOTS[id]]:path.join(home,ROOTS[id]));
  const c={status:'not_configured',defaults:{model:null,effort:null,enabled:null},concurrency:{value:null,kind:['chatgpt','claude','grok'].includes(id)?'native_setting':'guidance'},roles:[],pool:[],warnings:[],apk:{status:'not_checked'}};
  report.clients[id]=c;const budget={bytes:0,entries:0},models=new Map();
  try{
   await safePath(root);
   if(id!=='gemini'){
    try{
     const text=await readFile(path.join(root,id==='claude'?'settings.json':'config.toml'),budget);
     if(text!==null){let native;if(id==='claude'){try{native=JSON.parse(text);}catch{throw failure('INVALID_JSON');}}else native=parseToml(text);extractSettings(c,id,native,env,models);}
     else if(id==='claude')extractSettings(c,id,{},env,models);
    }catch(error){warning(c,error);}
   }
   await rolesIn(path.join(root,id==='gemini'?'config/agents':'agents'),c,id,budget,models);
   if(id==='kimi'||id==='gemini'){try{await readGuidance(root,c,budget);}catch(error){warning(c,error);}}
   if(c.status!=='attention'&&(c.roles.length||c.pool.length||c.defaults.model!==null||c.defaults.effort!==null||c.defaults.enabled!==null||c.concurrency.value!==null||Object.keys(c.overrides??{}).length))c.status='configured';
   if(root===path.resolve(home,ROOTS[id])){
    try{const installed=await inspectConfiguration({client:id,home,stateDir});c.apk.status=installed.status;if(installed.status==='verified'){c.apk.releaseVersion=installed.releaseVersion;c.apk.preset=installed.preset;}}
    catch(error){c.apk.status=error.code==='OWNED_DRIFT'?'modified':'attention';warning(c,error);}
   }
  }catch(error){warning(c,error);}
 }
 return report;
}
