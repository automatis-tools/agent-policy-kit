// Pure command codec, also embedded in the offline configuration page.
export const TOOL_FLAGS=Object.freeze({codex:'codex',claude:'claude',kimi:'kimi',antigravity:'agy'});
export const EXPLICIT_FIELDS=Object.freeze(['roles','max-concurrent',...Object.keys(TOOL_FLAGS),...Object.keys(TOOL_FLAGS).map(flag=>'avoid-'+flag)]);
const EXPLICIT_MODEL=/^[A-Za-z0-9][A-Za-z0-9._:@/\[\]-]{0,127}$/;
const EXPLICIT_EFFORTS=['none','minimal','low','medium','high','xhigh','max'];
function invalidExplicit(){throw Object.assign(new Error('Invalid explicit configuration.'),{code:'INVALID_EXPLICIT_CONFIG'});}
function explicitList(value,limit){
 if(typeof value!=='string'||!value.length)invalidExplicit();
 const list=value.split(',').map(value=>value.trim());
 if(!list.length||list.length>limit||list.some(value=>!value)||new Set(list).size!==list.length)invalidExplicit();
 return list;
}

export function parseExplicitOptions(options,roleIds){
 if(!options||typeof options!=='object'||Array.isArray(options))invalidExplicit();
 const fields=Object.getOwnPropertyDescriptors(options);
 if(Object.entries(fields).some(([key,value])=>!EXPLICIT_FIELDS.includes(key)||value.get||value.set||typeof value.value!=='string'))invalidExplicit();
 options=Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,value.value]));
 if(Object.values(fields).reduce((size,value)=>size+value.value.length,0)>65536)invalidExplicit();
 const requested=explicitList(options.roles,roleIds.length);
 if(requested.some(role=>!roleIds.includes(role)))invalidExplicit();
 const roles=roleIds.filter(role=>requested.includes(role)),maxConcurrent=Number(options['max-concurrent']);
 if(!/^[1-9]\d*$/.test(options['max-concurrent'])||!Number.isInteger(maxConcurrent)||maxConcurrent>32)invalidExplicit();
 for(const flag of Object.keys(TOOL_FLAGS))if(options['avoid-'+flag]!==undefined&&options[flag]===undefined)invalidExplicit();
 const clients={};
 for(const flag of Object.keys(options).filter(flag=>Object.hasOwn(TOOL_FLAGS,flag))){
  const client=TOOL_FLAGS[flag],choices={};
  for(const entry of explicitList(options[flag],roles.length)){
   const at=entry.indexOf('='),role=entry.slice(0,at).trim(),value=entry.slice(at+1).trim();
   if(at<1||!roles.includes(role)||Object.hasOwn(choices,role))invalidExplicit();
   let model=value,effort=null;
   if(client==='agy'){if(!['pro','flash','flash_lite','inherit'].includes(model))invalidExplicit();}
   else{
    const colon=value.lastIndexOf(':');if(colon<1)invalidExplicit();
    model=value.slice(0,colon);const level=value.slice(colon+1);
    if(level!=='native'&&!EXPLICIT_EFFORTS.includes(level))invalidExplicit();effort=level==='native'?null:level;
   }
   if(!EXPLICIT_MODEL.test(model))invalidExplicit();choices[role]={model,effort};
  }
  if(Object.keys(choices).length!==roles.length)invalidExplicit();
  const avoidModels=options['avoid-'+flag]===undefined?[]:explicitList(options['avoid-'+flag],32);
  if(avoidModels.some(model=>!EXPLICIT_MODEL.test(model)))invalidExplicit();
  const first=choices[roles[0]];
  clients[client]={code:{...first},light:{...first},roles:Object.fromEntries(roles.map(role=>[role,choices[role]])),avoidModels};
 }
 if(!Object.keys(clients).length)invalidExplicit();
 return {schemaVersion:1,maxConcurrent,...(roles.length===roleIds.length?{}:{selectedRoles:roles}),clients};
}

export function explicitOptions(config,roleIds){
 if(!config||config.schemaVersion!==1||!config.clients||typeof config.clients!=='object'||Array.isArray(config.clients))invalidExplicit();
 const selected=config.selectedRoles??roleIds;
 if(!Array.isArray(selected)||!selected.length||new Set(selected).size!==selected.length||selected.some(role=>!roleIds.includes(role)))invalidExplicit();
 const roles=roleIds.filter(role=>selected.includes(role));
 const options={roles:roles.join(','),'max-concurrent':String(config.maxConcurrent)};
 for(const [client,preferences]of Object.entries(config.clients)){
  const flag=Object.keys(TOOL_FLAGS).find(flag=>TOOL_FLAGS[flag]===client);if(!flag||!preferences)invalidExplicit();
  options[flag]=roles.map(role=>{
   const selected=preferences.roles?.[role]??preferences[role==='worker'||role==='reviewer'?'code':'light'];
   if(!selected||typeof selected.model!=='string'||!EXPLICIT_MODEL.test(selected.model)||(selected.effort!==null&&!EXPLICIT_EFFORTS.includes(selected.effort)))invalidExplicit();
   if(client==='agy'&&selected.effort!==null)invalidExplicit();
   return `${role}=${selected.model}${client==='agy'?'':':'+(selected.effort??'native')}`;
  }).join(',');
  if(!Array.isArray(preferences.avoidModels)||preferences.avoidModels.some(model=>typeof model!=='string'||!EXPLICIT_MODEL.test(model)))invalidExplicit();
  if(preferences.avoidModels.length)options['avoid-'+flag]=preferences.avoidModels.join(',');
 }
 parseExplicitOptions(options,roleIds);
 return options;
}

export function formatExplicitCommand(config,version,roleIds){
 if(typeof version!=='string'||!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))throw new Error('Invalid release version.');
 const options=explicitOptions(config,roleIds),quote=value=>"'"+value.replaceAll("'","'\"'\"'")+"'";
 const lines=[`npx --yes --ignore-scripts --package agent-policy-kit@${version} agent-policy setup`];
 for(const [name,value]of Object.entries(options))lines.push(`--${name} ${name==='max-concurrent'?value:quote(value)}`);
 lines.push('--apply');return lines.join(' \\\n  ');
}
