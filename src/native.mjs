import path from 'node:path';
import { ROLES, rolePreference } from './policy.mjs';
import {ROLE_DEFINITIONS,ROLE_IDS} from './roles.mjs';

export const BEGIN = '<!-- BEGIN agent-policy-kit -->';
export const END = '<!-- END agent-policy-kit -->';
const directory = {codex:'.codex',claude:'.claude',kimi:'.kimi-code',agy:'.gemini'};
export function nativeHomeConflict(client,home,env) {
  const variable={codex:'CODEX_HOME',claude:'CLAUDE_CONFIG_DIR',kimi:'KIMI_CODE_HOME'}[client];
  const active=variable&&env[variable];
  return typeof active==='string'&&active.length>0&&path.resolve(active)!==path.resolve(home,directory[client]);
}
export function nativeLocations(client,home) {
  const root=path.join(home,directory[client]);
  return {
    config:client==='agy'?null:path.join(root,client==='claude'?'settings.json':'config.toml'),
    instructions:path.join(root,client==='claude'?'CLAUDE.md':'AGENTS.md'),
    roles:Object.keys(ROLES).map(role=>path.join(root,client==='agy'?'config/agents':'agents',`apk-${role}.${client==='codex'?'toml':'md'}`))
  };
}
export function nativeRoles(client,config,selectedRoles=ROLE_IDS) {
  return selectedRoles.map(role=>{
    const selected=rolePreference(config,role),name='apk-'+role;
    const {description,prompt}=ROLE_DEFINITIONS.find(value=>value.id===role);
    if(client==='codex') return Object.entries({name,description,model:selected.model,...(selected.effort===null?{}:{model_reasoning_effort:selected.effort}),developer_instructions:prompt}).map(([k,v])=>`${k} = ${JSON.stringify(v)}\n`).join('');
    const fields=[`name: ${name}`,`description: ${JSON.stringify(description)}`];
    if(client==='kimi') {
      if(['reviewer','explorer'].includes(role))fields.push('tools: [Read, Grep, Glob]');
    } else {
      fields.push(`model: ${JSON.stringify(selected.model)}`);
      if(client==='claude') {
        if(selected.effort!==null)fields.push(`effort: ${selected.effort}`);
        if(['reviewer','explorer'].includes(role))fields.push('tools: Read, Grep, Glob');
      } else fields.push('subagent: true');
    }
    const routing=client==='kimi'?`\nThe parent must select configured pool alias ${selected.model} for this role; Markdown frontmatter does not select a model. Requested effort: ${selected.effort??'native default'}.\n`:'';
    return `---\n${fields.join('\n')}\n---\n\n${prompt}\n${routing}`;
  });
}
export function instructionBlock(client,config,maxConcurrent,selectedRoles=ROLE_IDS) {
  const routing=ROLE_DEFINITIONS.filter(role=>selectedRoles.includes(role.id)).map(role=>`apk-${role.id} for ${role.assignment}`).join(', ');
  const text=[BEGIN,'These preferences apply only if you choose to delegate to subagents. They do not require delegation or change how you handle work directly.',`When delegating, use ${routing}.`,`When delegating, run at most ${maxConcurrent} subagents concurrently in this session. Give each agent one concrete result and explicit file ownership. Preserve other agents' work. Child agents must return further delegation to the parent.`];
  if(client==='kimi') {
    for(const role of selectedRoles) {const selected=rolePreference(config,role);text.push(`For apk-${role}, select pool alias ${selected.model} (effort ${selected.effort??'native default'}).`);}
    text.push('Roles sharing an alias share its native effort default; an explicit effort pin for that alias also affects its native-default roles.');
    text.push("Use the Agent tool's model selection when spawning; the role file alone does not select a model. The concurrency limit is guidance; no native Agent cap is configured.");
  } else if(client==='agy') {
    for(const role of selectedRoles)text.push(`When delegating to apk-${role}, use model tier ${rolePreference(config,role).model}.`);
    text.push('Per-role effort and a hard concurrency cap are not supported by the documented native agent settings.');
  }
  else if(client==='claude')text.push('Use the named role definitions for model and effort selection. Session, project, managed settings, environment overrides and some spawn paths can supersede these user defaults; the native cap applies to ordinary Agent-tool spawns with documented exceptions.');
  else text.push('Use the named role definitions for model and effort selection. Explicit spawn settings and higher-priority instructions can supersede user defaults.');
  if(client==='codex'||client==='claude')text.push('An omitted role effort uses the native client default; it does not pin a level.');
  if(config.avoidModels.length)text.push(`Avoid these models when delegating: ${config.avoidModels.join(', ')}. This is routing guidance.`);
  text.push(END);
  return text.join('\n')+'\n';
}
export function nativeWarnings(client) {
  return client==='kimi'?['kimi-concurrency-guidance-only','kimi-model-pool-routing-guidance']:client==='agy'?['agy-concurrency-guidance-only','agy-per-role-effort-unsupported']:client==='claude'?['claude-native-precedence-limits']:['codex-native-precedence-limits'];
}
