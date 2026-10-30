// Pure URL state codec, also embedded in the offline configuration page.
const SHARE_BYTES=65536,SHARE_TOKEN=87384;
const SHARE_VERSION=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SHARE_UNSAFE=new Set(['__proto__','constructor','prototype']);
function invalidShare(){throw Object.assign(new Error('Invalid shared configuration link.'),{code:'INVALID_SHARE_LINK'});}

// Inspect descriptors before reading any user-supplied value. UI-only cached data is
// allowed, but accessors, exotic prototypes, sparse arrays and hidden fields are not.
function shareData(value,depth=0,budget={left:100000}){
 if(--budget.left<0||depth>32)invalidShare();
 if(value===null||value===undefined||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'){if(!Number.isFinite(value))invalidShare();return;}
 if(typeof value!=='object')invalidShare();
 const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
 if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)invalidShare();
 const fields=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(fields);
 if(array&&(keys.length!==value.length+1||value.length>100000))invalidShare();
 for(const key of keys){
  if(typeof key!=='string'||SHARE_UNSAFE.has(key))invalidShare();
  const field=fields[key];
  if(!Object.hasOwn(field,'value')||(!field.enumerable&&!(array&&key==='length')))invalidShare();
  if(array&&key!=='length'&&!/^(0|[1-9]\d*)$/.test(key))invalidShare();
  if(key!=='length'||!array)shareData(field.value,depth+1,budget);
 }
}
function shareRecord(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value))invalidShare();
 if(keys&&(Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key))))invalidShare();
 return value;
}
function shareList(value,known){
 if(!Array.isArray(value)||value.length>known.length||new Set(value).size!==value.length||value.some(id=>typeof id!=='string'||!known.includes(id)))invalidShare();
 return [...value];
}
function shareRelease(release){
 shareData(release);shareRecord(release);
 if(typeof release.version!=='string'||!SHARE_VERSION.test(release.version))invalidShare();
 const preferences=shareRecord(release.preferences),clients=Object.keys(shareRecord(preferences.clients));
 const catalog=shareRecord(shareRecord(release.catalog).clients);
 if(!clients.length||clients.some(id=>!Object.hasOwn(catalog,id)||!Array.isArray(catalog[id].efforts)||catalog[id].efforts.some(level=>typeof level!=='string')))invalidShare();
 if(!Array.isArray(release.roles)||!release.roles.length||!Array.isArray(release.presets)||!release.presets.length)invalidShare();
 const roles=new Map(),presets=new Map();
 for(const role of release.roles){
  shareRecord(role);if(typeof role.id!=='string'||!role.id||SHARE_UNSAFE.has(role.id)||roles.has(role.id)||!['code','light'].includes(role.kind))invalidShare();
  roles.set(role.id,role);
 }
 for(const preset of release.presets){
  shareRecord(preset);if(typeof preset.id!=='string'||!preset.id||preset.id==='custom'||SHARE_UNSAFE.has(preset.id)||presets.has(preset.id))invalidShare();
  shareRecord(shareRecord(preset.preferences).clients);presets.set(preset.id,preset);
 }
 if(!presets.has(release.preset))invalidShare();
 return {clients,roles,presets,catalog};
}
function shareChoice(choice,id,metadata){
 shareRecord(choice,['model','effort']);
 if(typeof choice.model!=='string'||choice.model.length>128||(choice.effort!==null&&(id==='agy'||!metadata.catalog[id].efforts.includes(choice.effort))))invalidShare();
 return {model:choice.model,effort:choice.effort};
}
function sharePayload(payload,release,metadata){
 shareRecord(payload,['v','release','roles','tools','scope','maxConcurrent']);
 if(payload.v!==1||typeof payload.release!=='string'||!SHARE_VERSION.test(payload.release))invalidShare();
 if(payload.release!==release.version)throw Object.assign(new Error('This link uses a different release.'),{code:'SHARE_RELEASE_MISMATCH'});
 if(!Number.isInteger(payload.maxConcurrent)||payload.maxConcurrent<1||payload.maxConcurrent>32)invalidShare();
 const roles=shareList(payload.roles,[...metadata.roles.keys()]);
 if(!Array.isArray(payload.tools)||payload.tools.length>metadata.clients.length)invalidShare();
 const selected=[];
 const tools=payload.tools.map(tool=>{
  shareRecord(tool,['id','mode','base','choices']);
  const {id,mode,base}=tool;
  if(!metadata.clients.includes(id)||selected.includes(id)||!metadata.presets.has(base)||(mode!==null&&mode!=='custom'&&!metadata.presets.has(mode)))invalidShare();
  selected.push(id);shareRecord(tool.choices,roles);
  const choices=Object.fromEntries(roles.map(role=>[role,shareChoice(tool.choices[role],id,metadata)]));
  if(mode!==null&&mode!=='custom'){
   if(mode!==base)invalidShare();
   const clients=metadata.presets.get(mode).preferences.clients;
   if(!Object.hasOwn(clients,id))invalidShare();
   const preferences=shareRecord(clients[id]);
   for(const role of roles){
    const expected=preferences.roles&&Object.hasOwn(preferences.roles,role)?preferences.roles[role]:preferences[metadata.roles.get(role).kind];
    const choice=shareChoice(expected,id,metadata);
    if(choice.model!==choices[role].model||choice.effort!==choices[role].effort)invalidShare();
   }
  }
  return {id,mode,base,choices};
 });
 const scope=payload.scope;
 if(scope!==null&&(typeof scope!=='string'||(scope==='all'?tools.length<2:!selected.includes(scope))))invalidShare();
 return {v:1,release:payload.release,roles,tools,scope,maxConcurrent:payload.maxConcurrent};
}
function shareBase64(bytes){return btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function shareJson(text){
 const payload=JSON.parse(text),stack=[];
 // JSON.parse validates syntax; this small token pass preserves duplicate-key
 // evidence that JSON.parse would otherwise discard, including escaped names.
 const tokens=text.match(/"(?:[^"\\]|\\.)*"|[{}\[\]:,]/g)??[];
 for(let at=0;at<tokens.length;at++){
  const token=tokens[at];
  if(token==='{')stack.push(new Set());
  else if(token==='[')stack.push(null);
  else if(token==='}'||token===']')stack.pop();
  else if(token[0]==='"'&&tokens[at+1]===':'){
   const key=JSON.parse(token),keys=stack.at(-1);
   if(!keys||keys.has(key)||SHARE_UNSAFE.has(key))invalidShare();keys.add(key);
  }
 }
 return payload;
}

export function encodeFormState(snapshot,release){
 try{
  shareData(snapshot);shareRecord(snapshot);
  const metadata=shareRelease(release),state=shareRecord(snapshot.state),profiles=shareRecord(state.profiles),jobs=shareRecord(state.jobs);
  const roles=shareList(snapshot.helpers,[...metadata.roles.keys()]),selected=shareList(snapshot.pickedTools,metadata.clients);
  const tools=selected.map(id=>{
   if(!Object.hasOwn(profiles,id)||!Object.hasOwn(jobs,id))invalidShare();
   const profile=shareRecord(profiles[id]),choices=shareRecord(jobs[id]);
   if(typeof profile.custom!=='boolean'||(profile.modeSelected!==undefined&&typeof profile.modeSelected!=='boolean'))invalidShare();
   return {id,mode:profile.modeSelected===false?null:profile.custom?'custom':profile.presetId,base:profile.presetId,choices:Object.fromEntries(roles.map(role=>{
    if(!Object.hasOwn(choices,role))invalidShare();return [role,shareChoice(choices[role],id,metadata)];
   }))};
  });
  const payload=sharePayload({v:1,release:release.version,roles,tools,scope:snapshot.selectedScope,maxConcurrent:state.maxConcurrent},release,metadata);
  if(!roles.length&&!tools.length)return '';
  const bytes=new TextEncoder().encode(JSON.stringify(payload));if(bytes.length>SHARE_BYTES)invalidShare();
  const token=shareBase64(bytes);if(token.length>SHARE_TOKEN)invalidShare();return '#setup='+token;
 }catch(error){if(error?.code==='INVALID_SHARE_LINK'||error?.code==='SHARE_RELEASE_MISMATCH')throw error;invalidShare();}
}

export function decodeFormState(fragment,release){
 try{
  if(typeof fragment!=='string')invalidShare();
  if(!fragment.startsWith('#setup='))return null;
  const token=fragment.slice(7);
  if(!token.length||token.length>SHARE_TOKEN||!/^[A-Za-z0-9_-]+$/.test(token)||token.length%4===1)invalidShare();
  const binary=atob(token.replaceAll('-','+').replaceAll('_','/'));
  if(binary.length>SHARE_BYTES)invalidShare();
  const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));if(shareBase64(bytes)!==token)invalidShare();
  const payload=shareJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes));shareData(payload);
  return sharePayload(payload,release,shareRelease(release));
 }catch(error){if(error?.code==='INVALID_SHARE_LINK'||error?.code==='SHARE_RELEASE_MISMATCH')throw error;invalidShare();}
}
