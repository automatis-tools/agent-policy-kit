import {PRESETS} from './release.mjs';
const LABELS={chatgpt:'ChatGPT',claude:'Claude',kimi:'Kimi',gemini:'Gemini',grok:'Grok'};
const label=client=>LABELS[client]??'Tool';
const code=value=>typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(value)?value:'OPERATION_FAILED';
const PRESET_LABELS=Object.fromEntries(PRESETS.map(entry=>[entry.id,entry.label]));
const preset=value=>Object.hasOwn(PRESET_LABELS,value)?' · '+PRESET_LABELS[value]:'';
const NOTES={
 'chatgpt-native-precedence-limits':'Project and explicit client settings can override these defaults.',
 'claude-native-precedence-limits':'Project and explicit client settings can override these defaults.',
 'kimi-concurrency-guidance-only':'Kimi: the concurrency limit is guidance.',
 'kimi-model-pool-routing-guidance':'Kimi: the parent selects the model alias for each role.',
 'gemini-concurrency-guidance-only':'Gemini: the concurrency limit is guidance.',
 'gemini-per-role-effort-unsupported':'Gemini: native tiers do not support per-role effort.',
 'grok-effort-model-dependent':'Grok: a role effort applies only when its model supports effort; a role without one uses its model default.',
 // Receipts written by 0.4.0 still carry this code; it is shown with the corrected text.
 'grok-per-role-effort-unsupported':'Grok: a role effort applies only when its model supports effort; a role without one uses its model default.',
 'grok-native-precedence-limits':'Project and explicit client settings can override these defaults.',
 'kimi-catalog-alias-resolved':'Kimi: an existing matching model alias was selected.',
 'claude-auto-compact-overridden':'Claude: CLAUDE_CODE_AUTO_COMPACT_WINDOW or a per-model /autocompact value outranks the configured auto-compact window.',
};
const REASONS={
 OWNED_DRIFT:'Local edits prevent an update',
 'kimi-provisioned-models-required':'Required model aliases are missing',
 'native-home-override-unsupported':'The active client profile uses a nonstandard location',
 'client-not-selected':'This tool is not selected in the configuration',
 'claude-force-model-conflict':'A forced model conflicts with the selected roles',
 'kimi-supported-effort-required':'A selected alias does not declare the required effort support',
 'kimi-main-effort-conflict':'The requested effort would change the main model defaults',
 'kimi-thinking-disabled':'Thinking is disabled for a model that requires it',
 'kimi-mixed-native-default-effort':'A shared effort override conflicts with native-default roles',
 'kimi-catalog-alias-ambiguous':'More than one existing model alias matches',
 'kimi-resolved-model-avoided':'The matching alias is on the avoid list',
 'kimi-resolved-effort-conflict':'Roles sharing an alias request conflicting effort levels',
 INSTALLATION_CONFLICT:'Installed preferences differ from this request',
 POLICY_CONFLICT:'Saved preferences differ from this request',
 RECOVERY_REQUIRED:'An interrupted transaction requires recovery',
 INSTALL_LOCKED:'Another configuration operation holds the lock',
};
export const useJsonOutput=({isTTY,json=false}={})=>json||!isTTY;
function reason(value){const id=code(value);return (REASONS[id]??'Configuration could not be completed')+` (${id})`;}
function row(client,text,mark='✓'){return `${mark} ${label(client).padEnd(14)} ${text}`;}
function setup(result,{apply}){
 const results=result.results??[],failed=results.some(r=>['error','prerequisite','invalid','timeout'].includes(r.status));
 const changed=results.filter(r=>r.status==='configured');
 const heading=failed?'Setup incomplete':result.status==='no_clients'?'No supported selected tools found':!apply?'Preview · no files changed':changed.length?'Configuration applied':'Already up to date';
 const lines=[heading,''],missing=[],notes=new Set();
 for(const r of results){
  if(r.status==='not_selected')continue;
  if(r.status==='not_found'){missing.push(label(r.client));continue;}
  const warnings=r.warnings??r.plan?.warnings??[];
  let text,mark='✓';
  if(r.status==='configured')text='Configuration applied'+preset(r.appliedPreset);
  else if(r.status==='unchanged'||r.status==='planned'&&r.plan?.files?.length===0)text='Already up to date'+preset(r.appliedPreset);
  else if(r.status==='planned'){text='Would configure'+preset(r.targetPreset);mark='·';}
  else if(r.status==='invalid'){text='Client executable identity could not be verified';mark='!';}
  else if(r.status==='timeout'){text='Client detection timed out';mark='!';}
  else {text=reason(r.error??warnings[0]);mark='!';}
  lines.push(row(r.client,text,mark));
  if(r.status==='prerequisite'&&r.appliedReleaseVersion&&/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(r.appliedReleaseVersion))lines.push(`  Existing configuration retained · ${r.appliedReleaseVersion}${preset(r.appliedPreset)}`);
  if(['configured','unchanged','planned'].includes(r.status))for(const warning of warnings)notes.add(NOTES[warning]??`Client note: ${code(warning)}`);
 }
 if(missing.length)lines.push(`Skipped: ${missing.join(', ')} — not installed.`);
 if(changed.length)lines.push('',`Open a new session in ${changed.map(r=>label(r.client)).join(', ')} to load the changes.`);
 if(results.some(r=>r.error==='OWNED_DRIFT'))lines.push('Review local edits before retrying; APK will not overwrite them.');
 if(results.some(r=>(r.warnings??r.plan?.warnings??[]).includes('kimi-provisioned-models-required')))lines.push('Configure the selected model aliases in Kimi, then run the same command again.');
 if(notes.size)lines.push('',...notes);
 lines.push('Native configuration only; model execution was not checked.');
 return lines;
}
function uninstall(result,{apply}){
 const results=result.results??(result.client?[result]:[]);
 const lines=[!apply?'Preview · no files changed':result.status==='partial'?'Removal incomplete':result.status==='not_installed'?'Nothing to remove':'Configuration removal',''];
 for(const r of results){const bad=r.status==='error';lines.push(row(r.client,bad?reason(r.error):r.status==='unchanged'||r.files?.length===0?'Nothing to remove':apply?'Configuration removed':'Would remove',bad?'!':apply?'✓':'·'));}
 return lines;
}
const setting=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9 _.:@/\[\]-]{0,127}$/.test(value)?value:'native default';
function show(result){
 const lines=['User configuration · subagents',''];
 for(const[id,c]of Object.entries(result.clients??{})){
  lines.push(`${label(id)}${c.status==='attention'?' · incomplete read':c.status==='not_configured'?' · no explicit subagent settings':''}`);
  if(c.status!=='not_configured'){
   if(c.defaults.enabled===false)lines.push('  Subagents explicitly disabled.');
   lines.push(`  Default model: ${setting(c.defaults.model)} · effort: ${setting(c.defaults.effort)}`);
   lines.push(`  Max concurrent: ${Number.isSafeInteger(c.concurrency.value)?c.concurrency.value:'not explicitly set'}${c.concurrency.kind==='guidance'?' (guidance)':' (native setting)'}`);
   if(Number.isSafeInteger(c.autoCompactWindow))lines.push(`  Auto-compact window: ${c.autoCompactWindow} (native setting)`);
   for(const role of c.roles)lines.push(`  ${setting(role.name).padEnd(22)} ${setting(role.model)} · ${setting(role.effort)}${role.modelSelection==='guidance'?' (routing guidance)':role.modelSelection==='parent'?' (parent selects model)':''}${role.enabled===false?' (delegation disabled)':''}`);
   for(const entry of c.pool)lines.push(`  Pool: ${setting(entry.alias)} · ${setting(entry.effort)}${entry.configured?'':' · alias not provisioned'}`);
   for(const[field,value]of Object.entries(c.overrides??{}))lines.push(`  Override ${field}: ${typeof value==='boolean'?String(value):typeof value==='number'?value:setting(value)}`);
  }
  if(c.apk.status==='modified')lines.push('  APK-managed files have local edits; the values above come from current files.');
  for(const warning of c.warnings)lines.push(`  ! ${code(warning)}`);
  lines.push('');
 }
 lines.push('User-level files only; project, managed and session settings may override them.','Native configuration only; model execution was not checked.');
 return lines;
}
export function formatResult(command,result,{version='',apply=false}={}){
 let lines;
 if(result.error)lines=[`Operation failed (${code(result.error)})`];
 else if(command==='setup'||command==='install')lines=setup(result,{apply});
 else if(command==='uninstall')lines=uninstall(result,{apply});
 else if(command==='show')lines=show(result);
 else if(command==='init')lines=['Preferences created.'];
 else if(command==='detect')lines=result.map(r=>row(r.client,r.status==='detected'?`Detected${typeof r.version==='string'&&/^[0-9A-Za-z.+-]{1,128}$/.test(r.version)?' · '+r.version:''}`:r.status==='not_found'?'Not installed':r.status==='timeout'?'Detection timed out':'Identity unverified',r.status==='detected'?'✓':r.status==='not_found'?'·':'!'));
 else if(command==='doctor'){
  lines=['Configuration check',''];
  for(const[client,r]of Object.entries(result.clients??{})){const c=r.configuration;lines.push(row(client,c.status==='verified'?`Verified${preset(c.preset)}`:c.status==='not_configured'?'Not configured':reason(c.reason),c.status==='attention'?'!':c.status==='verified'?'✓':'·'));}
  lines.push('Native configuration only; model execution was not checked.');
 }else if(command==='release')lines=[`Configuration release ${/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(result.version)?result.version:''}${preset(result.preset)}`,'','Use setup --release to preview; add --apply to configure.'];
 else lines=['Operation completed.'];
 return [`Agent Policy Kit${/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(version)?' · '+version:''}`,'',...lines].join('\n')+'\n';
}
