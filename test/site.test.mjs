import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validatePolicy,rolePreference} from '../src/policy.mjs';
import {ROLE_IDS,ROLE_DEFINITIONS} from '../src/roles.mjs';
import {EXPLICIT_FIELDS,parseExplicitOptions} from '../src/explicit.mjs';

const template = fs.readFileSync(new URL('../site/template.html', import.meta.url), 'utf8');
const preferences = JSON.parse(fs.readFileSync(new URL('../policies/balanced.json', import.meta.url), 'utf8'));
// Behavior tests use fallback-only preferences; real recommendations have separate coverage.
for(const [id,client]of Object.entries(preferences.clients)){delete client.roles;if(!['gemini','grok'].includes(id))client.code.effort='high';}
const release = {version: '0.1.0', roles:ROLE_DEFINITIONS, preferences, notes: 'A release.', unreleased: true};
const codec=fs.readFileSync(new URL('../src/explicit.mjs',import.meta.url),'utf8').replace(/^export /gm,'');
const shareCodec=fs.readFileSync(new URL('../src/share.mjs',import.meta.url),'utf8').replace(/^export /gm,'');
const script = template.match(/<script>([\s\S]*?)<\/script>/)[1].replace('__APK_RELEASE_DATA__',()=>JSON.stringify(release)).replace('__APK_EXPLICIT_CODEC__',()=>codec).replace('__APK_SHARE_CODEC__',()=>shareCodec);
const context = vm.createContext({TextEncoder, btoa});
vm.runInContext(script, context);
const api = context.APKConfigurator;
const plain = value => JSON.parse(JSON.stringify(value));

test('empty form waits for an explicit mode selection before generating a command',()=>{
 const state=api.initialState(preferences,'balanced',{empty:true});assert.deepEqual(plain(state.selected),[]);assert.equal(state.active,null);assert.equal(api.modeFor(state),null);
 state.selected=['chatgpt'];state.active='chatgpt';state.selectedRoles=['worker'];assert.equal(api.modeFor(state),null);assert.equal(api.buildConfig(state,preferences).config,null);
 const chosen=api.applyPreset(state,{id:'balanced',preferences},()=>{throw new Error('first mode selection must not warn');});
 assert.equal(chosen.profiles.chatgpt.modeSelected,true);assert.equal(api.modeFor(chosen),'balanced');assert.ok(api.buildConfig(chosen,preferences).config);
});

test('fresh form preselects every role in catalog order while tools stay unselected',()=>{
 const state=api.initialState(preferences,'balanced',{empty:true});
 assert.deepEqual(plain(state.selectedRoles),ROLE_IDS);assert.deepEqual(plain(state.selected),[]);
 assert.equal(api.buildConfig(state,preferences).config,null,'no command before a tool is chosen');
 state.selectedRoles.pop();assert.deepEqual(plain(api.initialState(preferences,'balanced',{empty:true}).selectedRoles),ROLE_IDS);
});

test('page starts and resets with every role selected and an independent role list',()=>{
 assert.match(template,/let helpers=\[\.\.\.state\.selectedRoles\],pickedTools=\[\];/);
 const freshForm=template.slice(template.indexOf(' function freshForm('),template.indexOf(' function loadAddress('));
 const context=vm.createContext({A:api,initial:{preferences,id:'balanced'},toolModeLabels:new Map()});
 vm.runInContext(`let state=null,helpers=['reviewer'],pickedTools=['chatgpt'],selectedScope='chatgpt',lastCopiedCommand='old',commandRevision=0;${freshForm};freshForm();globalThis.result={helpers,pickedTools,selectedScope,stateRoles:state.selectedRoles};`,context);
 const {result}=context;assert.deepEqual(plain(result.helpers),ROLE_IDS);assert.deepEqual(plain(result.pickedTools),[]);assert.equal(result.selectedScope,null);assert.notEqual(result.helpers,result.stateRoles);
});

const TOP={chatgpt:{model:'gpt-6-astra',effort:'high'},claude:{model:'claude-opus-5-5',effort:'xhigh'},kimi:{model:'kimi-code/k3.1-pro',effort:'high'}};
function topTier(){const quality=JSON.parse(fs.readFileSync(new URL('../policies/quality.json',import.meta.url),'utf8'));return {quality,preset:{id:'quality',label:'Top-tier',preferences:quality,topModels:TOP}};}

test('the Top-tier top-model switch changes only code roles of the chosen tool and keeps the mode',()=>{
 const {quality,preset}=topTier();
 let state=api.initialState(preferences,'balanced',{empty:true});state.selected=['chatgpt','claude','gemini'];state.active='all';
 state=api.applyPreset(state,preset);assert.equal(api.modeFor(state),'quality');
 for(const client of ['chatgpt','claude'])assert.equal(api.topModelsOn(state,client),false,client);
 assert.deepEqual(plain(api.topModelRoles(state,'gemini')),[]);assert.deepEqual(plain(api.topModelRoles(state,'claude')),['worker','reviewer','tester']);
 api.setTopModels(state,['claude'],true);
 assert.equal(api.topModelsOn(state,'claude'),true);assert.equal(api.topModelsOn(state,'chatgpt'),false);
 for(const role of ['worker','reviewer','tester'])assert.deepEqual(plain(state.jobs.claude[role]),TOP.claude);
 for(const role of ['explorer','writer','routine'])assert.deepEqual(plain(state.jobs.claude[role]),rolePreference(quality.clients.claude,role));
 assert.equal(api.modeFor(state,'claude'),'quality');assert.equal(api.modeFor(state),'quality');
 const catalog=JSON.parse(fs.readFileSync(new URL('../models/catalog.json',import.meta.url),'utf8'));
 assert.deepEqual(plain(rolePreference(api.buildConfig(state,preferences,catalog).config.clients.claude,'worker')),TOP.claude);
 const standard=api.applyPreset(state,{id:'balanced',preferences},()=>{throw new Error('top models belong to Top-tier, not to edits');});
 assert.equal(api.modeFor(standard),'balanced');
 const again=api.applyPreset(state,preset,()=>true);assert.equal(api.topModelsOn(again,'claude'),false);
 api.setTopModels(state,['claude'],false);assert.deepEqual(plain(state.jobs.claude.worker),rolePreference(quality.clients.claude,'worker'));
 state.profiles.chatgpt.custom=true;assert.deepEqual(plain(api.topModelRoles(state,'chatgpt')),[]);
});

test('the page shows one top-model switch under Top-tier and wires it to the selected scope',()=>{
 assert.match(template,/<button type="button" role="switch" id="top-models-toggle" aria-checked="false">/);
 assert.match(template,/renderModeNotice\(\);renderTopModels\(\);/);
 assert.match(template,/A\.setTopModels\(state,topTargets\(\),event\.currentTarget\.getAttribute\('aria-checked'\)!=='true'\)/);
 assert.match(template,/if\(A\.modeFor\(state\)!=='quality'\)return \[\];/);
});

test('restoring a Top-tier link with top models applies them to every code role',()=>{
 const {preset}=topTier(),data={v:2,release:'0.1.0',roles:['reviewer'],tools:[{id:'claude',mode:'quality',base:'quality',maxConcurrent:2,choices:{reviewer:TOP.claude}}],scope:'claude'};
 const state=api.restoreState(data,preferences,[preset],'balanced');
 assert.equal(api.modeFor(state,'claude'),'quality');assert.equal(api.topModelsOn(state,'claude'),true);
 for(const role of ['worker','reviewer','tester'])assert.deepEqual(plain(state.jobs.claude[role]),TOP.claude);
});

test('a Top-tier link with the base Coder effort on the top model does not turn the top choice on',()=>{
 // Claude's top choice is the base model at a higher effort, so restoring compares model and effort.
 const {quality,preset}=topTier(),base=rolePreference(quality.clients.claude,'reviewer');assert.equal(base.model,TOP.claude.model);assert.notEqual(base.effort,TOP.claude.effort);
 const state=api.restoreState({v:2,release:'0.1.0',roles:['reviewer'],tools:[{id:'claude',mode:'quality',base:'quality',maxConcurrent:2,choices:{reviewer:base}}],scope:'claude'},preferences,[preset],'balanced');
 assert.equal(api.topModelsOn(state,'claude'),false);assert.deepEqual(plain(state.jobs.claude.worker),rolePreference(quality.clients.claude,'worker'));
});

test('every step explains itself briefly and the page does not repeat vendor documentation',()=>{
 const source=template.match(/const stepInfo=(\{[\s\S]*?\});/);assert.ok(source,'stepInfo');
 const entries=Object.entries(vm.runInNewContext('('+source[1]+')'));
 assert.deepEqual(entries.map(([id])=>id),['helpers-heading','tools-heading','mode-heading','setup-heading']);
 for(const [id,text]of entries){assert.match(template,new RegExp(`<h2 id="${id}"`));assert.ok(text.length>0&&text.length<=180,id);}
 assert.match(template,/heading\.after\(infoButton\(/);
 assert.doesNotMatch(template,/usage credits|requires Claude Code/);
});

test('on-screen text stays minimal and only tool-specific facts are shown',()=>{
 for(const id of ['top-models-note','concurrency-hint','step-hint-1','step-hint-2','step-hint-3'])assert.doesNotMatch(template,new RegExp(`id="${id}"`),id);
 assert.doesNotMatch(template,/Writes native config, then exits|Only installed tools are configured|Click a mode to select it|You can add more|All available roles added|Click a coding tool to configure|They use limits much faster|How many subagents one session/);
 assert.doesNotMatch(template,/\$\('top-models'\)\.append\(|concurrency-title/);
 assert.match(template,/\$\('concurrency-label'\)\.textContent=\['kimi','gemini'\]\.includes\(client\)\?'Max per session \(advisory\)':'Max per session';/);
});

test('the header links to the repository instead of showing the release version',()=>{
 const header=template.match(/<header>[\s\S]*?<\/header>/)[0];
 assert.match(header,/<a class="repo-link" href="__APK_REPOSITORY_URL__" target="_blank" rel="noopener noreferrer" aria-label="Agent Policy Kit on GitHub">/);
 assert.doesNotMatch(template,/release-version/);
 const page=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 assert.match(page,/<a class="repo-link" href="https:\/\/github\.com\/automatis-tools\/agent-policy-kit"/);
});

test('the footer offers a quiet copy button for the read-only show command',()=>{
 assert.doesNotMatch(template,/class="show-command"/);
 const footer=template.match(/<footer>[\s\S]*?<\/footer>/)[0];
 assert.match(footer,/<span class="show-settings">Check current settings <button type="button" class="quiet-button" id="copy-show" aria-label="Copy the command that shows current settings">Copy<\/button><code id="show-command" hidden><\/code><\/span>/);
 assert.match(template,/const showCommand=`npx --yes --ignore-scripts --package \$\{RELEASE\.packageSpec\} agent-policy show`;/);
 assert.match(template,/navigator\.clipboard\.writeText\(showCommand\)/);
 assert.match(template,/\$\('copy-show'\)\.before\(infoButton\('current settings',button=>showTip\(button,el\('strong',\{\},'Check current settings'\),el\('p',\{\},'[^']+'\),el\('pre',\{\},showCommand\)\)\)\);/);
 assert.doesNotMatch(template,/copy-show'\)\.title=/);
});

test('Reset form sits with the form result, not in the site header',()=>{
 const header=template.match(/<header>[\s\S]*?<\/header>/)[0];
 assert.doesNotMatch(header,/reset-form/);
 assert.match(template,/<div class="setup-footer"><p class="release-status" id="release-status"><\/p><button type="button" class="reset-form" id="reset-form">Reset form<\/button><\/div><\/section>/);
});

test('tools whose presets share models get an honest mode note instead of the generic description',()=>{
 const presets=['fast','balanced','quality'].map(id=>({id,preferences:JSON.parse(fs.readFileSync(new URL(`../policies/${id}.json`,import.meta.url),'utf8'))}));
 for(const client of ['chatgpt','claude','kimi','gemini','grok'])assert.deepEqual(plain(api.presetModelSummary(presets,client)),{same:false,model:null},client);
 const one={code:{model:'one-model',effort:null},light:{model:'one-model',effort:null},avoidModels:[]},shared=['a','b'].map(id=>({id,preferences:{clients:{solo:one}}}));
 assert.deepEqual(plain(api.presetModelSummary(shared,'solo')),{same:true,model:'one-model'});
 assert.deepEqual(plain(api.presetModelSummary([],'grok')),{same:false,model:null});
 assert.match(template,/Modes change only how many subagents run at once\./);
});

test('empty role and tool fields share one empty-field appearance',()=>{
 const declarations=selector=>{const body=template.match(new RegExp(`(?:^|[}\\n])${selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\{([^}]*)\\}`))?.[1];assert.ok(body,selector);return Object.fromEntries(body.split(';').filter(Boolean).map(item=>{const at=item.indexOf(':');return [item.slice(0,at),item.slice(at+1)];}));};
 const field=declarations('.tag-box'),emptyTools=declarations('.tool-group.is-empty');
 for(const property of ['min-height','padding','background'])assert.equal(emptyTools[property],field[property],property);
 assert.equal(declarations('.tool-group.is-empty .empty').padding,declarations('.empty').padding);
 assert.match(template,/box\.classList\.toggle\('is-empty',!chosen\.length\)/);
 assert.match(template,/'Add roles from below'/);assert.match(template,/'Add AI assistants from below'/);
});

test('a partially selected global mode warns before replacing existing choices',()=>{
 let state=api.initialState(preferences,'balanced',{empty:true});state.selected=['chatgpt','claude'];state.selectedRoles=['reviewer'];state.active='chatgpt';
 state=api.applyPreset(state,{id:'balanced',preferences});state.active='all';assert.equal(api.modeFor(state),null);assert.equal(api.buildConfig(state,preferences).config,null);
 const fast=JSON.parse(fs.readFileSync(new URL('../policies/fast.json',import.meta.url),'utf8'));
 assert.equal(api.applyPreset(state,{id:'fast',preferences:fast}),state);
 const next=api.applyPreset(state,{id:'fast',preferences:fast},()=>true);assert.equal(api.modeFor(next),'fast');assert.ok(api.buildConfig(next,preferences).config);
});

test('manual effort selection chooses Custom for that tool',()=>{
 const state=api.initialState(preferences,'balanced',{empty:true});state.selected=['chatgpt'];state.active='chatgpt';state.selectedRoles=['worker'];
 api.updateEffort(state,'chatgpt','worker','high');assert.equal(state.profiles.chatgpt.modeSelected,true);assert.equal(api.modeFor(state),'custom');
});

test('switching All to Custom alone does not create a destructive preset change',()=>{
 const state=api.initialState(preferences);for(const client of state.selected)state.profiles[client].custom=true;
 const quality=JSON.parse(fs.readFileSync(new URL('../policies/quality.json',import.meta.url),'utf8'));
 const next=api.applyPreset(state,{id:'quality',preferences:quality},()=>{throw new Error('No edited settings to overwrite');});
 assert.equal(api.modeFor(next),'quality');
});

test('All still protects real model edits and mixed bases',()=>{
 const quality=JSON.parse(fs.readFileSync(new URL('../policies/quality.json',import.meta.url),'utf8'));
 for(const change of [state=>{state.jobs.chatgpt.worker.effort='low';},state=>{state.profiles.claude.presetId='quality';}]){
  const state=api.initialState(preferences);for(const client of state.selected)state.profiles[client].custom=true;change(state);
  assert.equal(api.applyPreset(state,{id:'quality',preferences:quality}),state);
 }
});
function decodedCommand(command){
 const pattern=new RegExp('--('+EXPLICIT_FIELDS.join('|')+")\\s+(?:'([^']*)'|([^\\s]+))",'g');
 const pairs=[...command.matchAll(pattern)].map(match=>[match[1],match[2]??match[3]]);
 assert.equal(new Set(pairs.map(([name])=>name)).size,pairs.length);
 return validatePolicy(parseExplicitOptions(Object.fromEntries(pairs),ROLE_IDS));
}
function equivalent(decoded,expected){
 assert.equal(decoded.maxConcurrent,expected.maxConcurrent);
 assert.deepEqual(decoded.selectedRoles??ROLE_IDS,expected.selectedRoles??ROLE_IDS);
 assert.deepEqual(Object.keys(decoded.clients),Object.keys(expected.clients));
 for(const client of Object.keys(expected.clients)){
  assert.deepEqual(decoded.clients[client].avoidModels,expected.clients[client].avoidModels);
  assert.equal(decoded.clients[client].maxConcurrent??decoded.maxConcurrent,expected.clients[client].maxConcurrent??expected.maxConcurrent);
  for(const role of expected.selectedRoles??ROLE_IDS)assert.deepEqual(rolePreference(decoded.clients[client],role),expected.clients[client].roles?.[role]??expected.clients[client][ROLE_DEFINITIONS.find(r=>r.id===role).kind]);
 }
}


test('selected role and tool choices reach a valid explicit installer policy',()=>{
 const state=api.initialState(preferences);state.selected=['chatgpt'];state.selectedRoles=['reviewer'];
 state.jobs.chatgpt.worker={model:'unused invalid model',effort:'invalid'};
 state.jobs.chatgpt.reviewer={model:'custom/review',effort:'high'};
 const {config,errors}=plain(api.buildConfig(state,preferences));assert.deepEqual(errors,[]);
 assert.deepEqual(config.selectedRoles,['reviewer']);assert.deepEqual(Object.keys(config.clients),['chatgpt']);
 assert.deepEqual(config.clients.chatgpt.roles,{reviewer:{model:'custom/review',effort:'high'}});validatePolicy(config);
 const command=api.buildCommand(config,release);assert.doesNotMatch(command,/--config|--preset|--release/);equivalent(decodedCommand(command),config);
});

test('incomplete role selections cannot produce an installer configuration',()=>{
 for(const selectedRoles of [[],['invented'],['worker','worker']]){const state=api.initialState(preferences);state.selectedRoles=selectedRoles;assert.equal(api.buildConfig(state,preferences).config,null);}
});

test('unselected Kimi jobs do not introduce effort conflicts or required aliases',()=>{
 const state=api.initialState(preferences);state.selected=['kimi'];state.selectedRoles=['reviewer'];
 state.jobs.kimi.worker={...state.jobs.kimi.reviewer,effort:'low'};
 const result=plain(api.buildConfig(state,preferences));assert.deepEqual(result.errors,[]);validatePolicy(result.config);
});

test('All is the initial view without becoming a configuration client', () => {
  const state = api.initialState(preferences);
  assert.equal(state.active, 'all');
  assert.deepEqual(plain(api.buildConfig(state, preferences).config), preferences);
  assert.deepEqual(plain(state.selected), ['chatgpt', 'claude', 'kimi', 'gemini', 'grok']);
});

test('replacing custom settings requires confirmation and preserves the selected view', () => {
  const state = api.initialState(preferences);
  state.active = 'all'; state.profiles.chatgpt.custom = true;
  state.jobs.chatgpt.worker = {model: 'custom/code', effort: 'low'};
  const before = JSON.stringify(state);
  const fast = JSON.parse(fs.readFileSync(new URL('../policies/fast.json', import.meta.url), 'utf8'));
  const preset = {id: 'fast', label: 'Light', preferences: fast};
  assert.equal(api.applyPreset(state, preset), state, 'no implicit confirmation');
  assert.equal(api.applyPreset(state, preset, () => false), state);
  assert.equal(JSON.stringify(state), before, 'cancel preserves every custom choice');
  let confirmations = 0;
  const next = api.applyPreset(state, preset, () => {confirmations++; return true;});
  assert.equal(confirmations, 1);
  assert.equal(next.active, 'all'); assert.equal(api.modeFor(next), 'fast');
  assert.deepEqual(plain(api.buildConfig(next, fast).config), fast);
  assert.equal(JSON.stringify(state), before, 'replacement does not mutate the old state');
  const named = api.applyPreset(next, {id:'balanced',preferences}, () => {throw new Error('Named All preset needs no destructive-change confirmation');});
  assert.equal(named.active, 'all');
  assert.deepEqual(plain(api.buildConfig(named, preferences).config), preferences);
});

test('switching the only selected tool between presets asks only when edits would be lost',()=>{
 const fast=JSON.parse(fs.readFileSync(new URL('../policies/fast.json',import.meta.url),'utf8'));
 let state=api.initialState(preferences,'balanced',{empty:true});state.selected=['chatgpt'];state.active='chatgpt';
 state=api.applyPreset(state,{id:'balanced',preferences});assert.equal(api.modeFor(state,'chatgpt'),'balanced');
 const light=api.applyPreset(state,{id:'fast',label:'Light',preferences:fast},()=>{throw new Error('nothing to lose, no confirmation');});
 assert.equal(api.modeFor(light,'chatgpt'),'fast');
 state.jobs.chatgpt.worker={model:'custom/code',effort:'low'};let asked=0;
 assert.equal(api.applyPreset(state,{id:'fast',label:'Light',preferences:fast},()=>{asked++;return false;}),state);assert.equal(asked,1);
});

test('an individual preset changes only that tool and All reports mixed modes',()=>{
 const state=api.initialState(preferences);state.active='kimi';
 const quality=JSON.parse(fs.readFileSync(new URL('../policies/quality.json',import.meta.url),'utf8'));
 const preset={id:'quality',label:'Top-tier',preferences:quality},before=JSON.stringify(state);
 assert.equal(api.applyPreset(state,preset),state,'scope warning requires confirmation');
 assert.equal(api.applyPreset(state,preset,()=>false),state);assert.equal(JSON.stringify(state),before);
 let prompts=0;const next=api.applyPreset(state,preset,()=>{prompts++;return true;});assert.equal(prompts,1);
 assert.equal(next.active,'kimi');assert.equal(api.modeFor(next),'quality');assert.equal(api.modeFor(next,'all'),'custom');
 for(const client of ['chatgpt','claude','gemini']){assert.deepEqual(plain(next.jobs[client]),plain(state.jobs[client]));assert.deepEqual(plain(next.profiles[client]),plain(state.profiles[client]));assert.equal(api.modeFor(next,client),'balanced');}
 const config=plain(api.buildConfig(next,preferences).config);assert.deepEqual(config.clients.kimi,{...quality.clients.kimi,maxConcurrent:2});
 for(const client of ['chatgpt','claude','gemini'])assert.deepEqual(config.clients[client],preferences.clients[client]);
 assert.equal(next.maxConcurrent,state.maxConcurrent);assert.equal(JSON.stringify(state),before);
 next.active='all';const reset=api.applyPreset(next,{id:'balanced',preferences},()=>true);
 assert.equal(api.modeFor(reset),'balanced');for(const client of reset.selected)assert.equal(api.modeFor(reset,client),'balanced');
 assert.deepEqual(plain(api.buildConfig(reset,preferences).config),preferences);
});

test('manual effort edits mark only their tool Custom while other named modes remain',()=>{
 const state=api.initialState(preferences);api.updateEffort(state,'chatgpt','worker','low');
 assert.equal(api.modeFor(state,'chatgpt'),'custom');assert.equal(api.modeFor(state,'all'),'custom');
 for(const client of ['claude','kimi','gemini'])assert.equal(api.modeFor(state,client),'balanced');
 const named=api.applyPreset({...state,active:'chatgpt'},{id:'balanced',preferences},()=>true);
 assert.equal(api.modeFor(named,'all'),'balanced');assert.equal(named.jobs.chatgpt.worker.effort,preferences.clients.chatgpt.code.effort);
});

test('configuration template has a single release marker and no external assets or network calls', () => {
  assert.equal(template.split('__APK_RELEASE_DATA__').length, 2);
  assert.doesNotMatch(template, /<(?:script|img)[^>]+src=/i);
  assert.doesNotMatch(template, /<link[^>]+rel="(?:stylesheet|preload|modulepreload)"/i);
  assert.doesNotMatch(script, /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/);
  assert.doesNotMatch(template, /type="checkbox"|role="tablist"|id="effort-/);
  assert.match(template, /id="selected-tools"[^>]*role="group"/);
  assert.match(template, /id="setup-command" readonly/);
  assert.doesNotMatch(template,/savedDesign|Design prototype|installer not connected/);
});

test('recommendations expose six independent jobs and preserve native fallbacks', () => {
  const state = api.initialState(preferences);
  const {config, errors} = plain(api.buildConfig(state, preferences));
  assert.deepEqual(errors, []);
  assert.deepEqual(Object.keys(config.clients), ['chatgpt', 'claude', 'kimi', 'gemini', 'grok']);
  assert.deepEqual(config, preferences);
  assert.deepEqual(Object.keys(state.jobs.chatgpt), ROLE_IDS);
  assert.equal(config.clients.chatgpt.roles, undefined);
  assert.deepEqual(config.clients.chatgpt.code, preferences.clients.chatgpt.code);
  assert.deepEqual(config.clients.kimi.light, preferences.clients.kimi.light);
  assert.deepEqual(plain(state.jobs.gemini.worker), {model: 'pro', effort: null});
  state.jobs.chatgpt.reviewer.model = 'custom/review:1';
  assert.equal(state.jobs.chatgpt.worker.model, preferences.clients.chatgpt.code.model);
});

test('all five tools stay configured and only changed roles produce overrides', () => {
  const state = api.initialState(preferences);
  state.jobs.claude.reviewer = api.preferenceForModel(preferences.clients.claude, 'reviewer', 'opus');
  const {config, errors} = plain(api.buildConfig(state, preferences));
  assert.deepEqual(errors, []);
  assert.deepEqual(Object.keys(config.clients), ['chatgpt', 'claude', 'kimi', 'gemini', 'grok']);
  assert.equal(config.maxConcurrent, preferences.maxConcurrent);
  assert.deepEqual(config.clients.claude.roles, {reviewer: {model: 'opus', effort: preferences.clients.claude.code.effort}});
  assert.ok(!config.clients.claude.avoidModels.includes('opus'));
  assert.deepEqual(config.clients.claude.code, preferences.clients.claude.code);
  assert.equal(config.clients.chatgpt.roles, undefined);
});

test('model changes use known model effort and custom models keep the original task default', () => {
  const config = preferences.clients.kimi;
  assert.deepEqual(plain(api.preferenceForModel(config, 'routine', config.code.model)), config.code);
  assert.deepEqual(plain(api.preferenceForModel(config, 'worker', config.light.model)), config.light);
  assert.deepEqual(plain(api.preferenceForModel(config, 'routine', 'custom/alias')), {model: 'custom/alias', effort: config.light.effort});
  const state = api.initialState(preferences);
  state.jobs.kimi.routine = api.preferenceForModel(config, 'routine', config.code.model);
  assert.deepEqual(plain(api.buildConfig(state, preferences)).errors, []);
  assert.equal(api.buildConfig(state, preferences).config.clients.kimi.roles.routine.effort, config.code.effort);
});

test('sequential choices of one custom Kimi alias reuse its existing effort across all tasks', () => {
  const state = api.initialState(preferences);
  const config = preferences.clients.kimi;
  for (const role of ROLE_IDS) {
    state.jobs.kimi[role] = api.preferenceForModel(config, role, 'custom/shared-alias', state.jobs.kimi);
  }
  assert.equal(new Set(Object.values(state.jobs.kimi).map(choice => choice.effort)).size, 1);
  assert.deepEqual(plain(api.buildConfig(state, preferences)).errors, []);
  // Recommended aliases still use their release effort, rather than a custom alias's effort.
  assert.deepEqual(plain(api.preferenceForModel(config, 'routine', config.light.model, state.jobs.kimi)), config.light);
});

test('native role recommendations override code/light defaults', () => {
  const custom = structuredClone(preferences);
  custom.clients.chatgpt.roles = {reviewer: {model: 'review/custom', effort: 'medium'}};
  const state = api.initialState(custom);
  assert.equal(state.jobs.chatgpt.reviewer.model, 'review/custom');
  assert.equal(state.jobs.chatgpt.worker.model, custom.clients.chatgpt.code.model);
});

test('Kimi aliases require consistent effective effort but unused base defaults do not constrain them', () => {
  const state = api.initialState(preferences);
  for (const role of ROLE_IDS) state.jobs.kimi[role] = {model: 'kimi-code/k3', effort: 'low'};
  assert.deepEqual(plain(api.buildConfig(state, preferences)).errors, []);
  state.jobs.kimi.reviewer.effort = 'high';
  const invalid = plain(api.buildConfig(state, preferences));
  assert.equal(invalid.config, null);
  assert.match(invalid.errors.join(' '), /same effort/);
  state.jobs.kimi.reviewer = {model: 'primary', effort: 'low'};
  assert.match(plain(api.buildConfig(state, preferences)).errors.join(' '), /explicit model alias/);
});

test('bad input cannot leave a usable configuration', () => {
  for (const model of ['', 'bad model', 'x;echo', '$(id)', 'x`id`', 'é', '-bad', 'a'.repeat(129)]) {
    const state = api.initialState(preferences);
    state.jobs.chatgpt.worker.model = model;
    const invalid = api.buildConfig(state, preferences);
    assert.equal(invalid.config, null, model);
    assert.ok(invalid.errors.length, model);
  }
  for (const maxConcurrent of ['', '1.2', 'NaN', '0', '33']) {
    const state = api.initialState(preferences); state.profiles.chatgpt.maxConcurrent = maxConcurrent===''?'':Number(maxConcurrent);
    assert.equal(api.buildConfig(state, preferences).config, null, maxConcurrent);
  }
  for(const selected of [[],null,'chatgpt',{},['chatgpt','chatgpt'],['invented']]){
    const state=api.initialState(preferences);state.selected=selected;
    assert.equal(api.buildConfig(state,preferences).config,null);
  }
});

test('agy accepts native tiers without invented per-role effort', () => {
  const state = api.initialState(preferences);
  state.jobs.gemini.reviewer = {model: 'inherit', effort: null};
  assert.deepEqual(plain(api.buildConfig(state, preferences)).errors, []);
  state.jobs.gemini.reviewer.effort = 'high';
  assert.equal(api.buildConfig(state, preferences).config, null);
  state.jobs.gemini.reviewer = {model: 'custom-model', effort: null};
  assert.equal(api.buildConfig(state, preferences).config, null);
});

test('Grok Build accepts any model identifier and per-role effort only where the catalog lists it', () => {
  const catalog = JSON.parse(fs.readFileSync(new URL('../models/catalog.json', import.meta.url), 'utf8')),grok=catalog.clients.grok;
  const state = api.initialState(preferences);
  state.jobs.grok.reviewer = {model: 'grok-4.5', effort: null};
  state.jobs.grok.explorer = {model: 'custom-grok-model', effort: null};
  const built = plain(api.buildConfig(state, preferences, catalog));
  assert.deepEqual(built.errors, []);
  assert.deepEqual(built.config.clients.grok.roles.reviewer, {model: 'grok-4.5', effort: null});
  assert.deepEqual(plain(api.allowedEfforts(grok, 'grok-4.7')), [null, 'low', 'medium', 'high', 'xhigh']);
  assert.deepEqual(plain(api.allowedEfforts(grok, 'grok-build-0.1')), [null]);
  assert.deepEqual(plain(api.allowedEfforts(grok, 'custom-grok-model')), [null, 'low', 'medium', 'high', 'xhigh', 'max']);
  assert.equal(api.preferenceForModel(preferences.clients.grok, 'worker', 'grok-4.7', {}, grok).effort, 'high');
  state.jobs.grok.reviewer.effort = 'high';
  assert.equal(api.buildConfig(state, preferences, catalog).config, null);
  state.jobs.grok.reviewer = {model: 'grok-4.7', effort: 'max'};
  assert.equal(api.buildConfig(state, preferences, catalog).config, null);
  state.jobs.grok.reviewer = {model: 'grok-4.7', effort: 'xhigh'};
  state.jobs.grok.explorer = {model: 'custom-grok-model', effort: 'max'};
  state.jobs.grok.routine = {model: 'grok-build-0.1', effort: null};
  state.selected = ['grok'];state.active = 'grok';
  const config = plain(api.buildConfig(state, preferences, catalog).config);
  assert.ok(config);assert.deepEqual(config.clients.grok.roles.reviewer, {model: 'grok-4.7', effort: 'xhigh'});
  const command = api.buildCommand(config, release);
  assert.match(command, /--grok '[^']*reviewer=grok-4\.7:xhigh[^']*'/);
  assert.match(command, /--grok '[^']*explorer=custom-grok-model:max[^']*'/);
  assert.match(command, /--grok '[^']*routine=grok-build-0\.1(?:,|')/);
  assert.doesNotMatch(command, /:native/);
  equivalent(decodedCommand(command), config);
  assert.doesNotMatch(script, /main session effort/);
});

test('command is version pinned, fully explicit and shell safe', () => {
  const config = plain(api.buildConfig(api.initialState(preferences), preferences).config);
  const command = api.buildCommand(config, release);
  assert.match(command, /^npx --yes --ignore-scripts --package agent-policy-kit@0\.1\.0 agent-policy setup/);
  assert.doesNotMatch(command,/--config|--preset|--release/);
  for(const flag of ['chatgpt','claude','kimi','gemini','grok'])assert.ok(command.includes('--'+flag+" '"));
  equivalent(decodedCommand(command),config);
  assert.throws(() => api.buildCommand(config, {...release, version: '0.1.0;echo'}), /Invalid release/);
  assert.equal(Buffer.from(api.encodeConfig({note: 'Привіт'}), 'base64url').toString('utf8'), JSON.stringify({note: 'Привіт'}));
});

test('four-step builder keeps parallelism with roles and the copy action last', () => {
  assert.match(template, /Stop subagents from burning your plan limits\./);
  assert.match(template, /Four steps, one command\./);
  assert.match(template, /<div class="limits-chart">__APK_LIMITS_CHART__<\/div>/);
  assert.deepEqual([...template.matchAll(/class="step-number">(\d)<\/span>/g)].map(match=>match[1]),['1','2','3','4']);
  assert.match(script, /type:'radio',name:'mode'/);
  assert.match(script, /\['Role','Model','Effort'\]/);
  assert.match(script, /chatgpt: 'ChatGPT', claude: 'Claude', kimi: 'Kimi', gemini: 'Gemini', grok: 'Grok'/);
  assert.match(script, /Custom model…/);
});

test('catalog effort support includes native default and model-specific limits', () => {
  const catalog = {efforts: ['low', 'high', 'xhigh'], models: [
    {id: 'catalog/model-a', label: 'Model A', efforts: ['high', 'xhigh'], defaultEffort: 'high'},
    {id: 'catalog/model-b', label: 'Model B', efforts: [], defaultEffort: null}
  ]};
  assert.deepEqual(plain(api.allowedEfforts(catalog, 'catalog/model-a')), [null, 'high', 'xhigh']);
  assert.deepEqual(plain(api.allowedEfforts(catalog, 'catalog/model-b')), [null]);
  assert.deepEqual(plain(api.allowedEfforts(catalog, 'custom/model')), [null, 'low', 'high', 'xhigh']);
  const jobs = {worker: {model: 'old/model', effort: 'low'}};
  assert.deepEqual(plain(api.preferenceForModel(preferences.clients.chatgpt, 'worker', 'catalog/model-a', jobs, catalog)), {model: 'catalog/model-a', effort: 'high'});
  jobs.worker.effort = 'xhigh';
  assert.equal(api.preferenceForModel(preferences.clients.chatgpt, 'worker', 'catalog/model-a', jobs, catalog).effort, 'xhigh');
  assert.equal(api.preferenceForModel(preferences.clients.chatgpt, 'worker', 'catalog/model-b', jobs, catalog).effort, null);
});

test('Kimi effort edits synchronize jobs with the same model alias', () => {
  const state = api.initialState(preferences);
  state.jobs.kimi.reviewer = {...state.jobs.kimi.worker};
  api.updateEffort(state, 'kimi', 'worker', null);
  assert.equal(state.jobs.kimi.worker.effort, null);
  assert.equal(state.jobs.kimi.reviewer.effort, null);
  assert.equal(state.jobs.kimi.routine.effort, preferences.clients.kimi.light.effort);
  assert.deepEqual(plain(api.buildConfig(state, preferences)).errors, []);
});

test('presets and Custom both print every effective role value', () => {
  const config = plain(api.buildConfig(api.initialState(preferences), preferences).config);
  const withPresets = {...release, presets: [{id: 'balanced', label: 'Balanced', preferences}]};
  const command=api.buildCommand(config,withPresets);
  assert.equal(command,api.buildCommand(config,withPresets,{custom:true}));
  assert.doesNotMatch(command,/--config|--preset|--release/);equivalent(decodedCommand(command),config);
  config.clients.chatgpt.roles = {reviewer: {model: 'custom/reviewer', effort: 'high'}};
  const custom=api.buildCommand(config,withPresets);assert.ok(custom.includes('reviewer=custom/reviewer:high'));equivalent(decodedCommand(custom),config);
});

test('explicit tool argument order follows the selected tool order',()=>{
 const state=api.initialState(preferences);state.selected=['kimi','chatgpt'];state.selectedRoles=['reviewer'];
 const config=plain(api.buildConfig(state,preferences).config),command=api.buildCommand(config,release);
 assert.ok(command.indexOf('--kimi ')<command.indexOf('--chatgpt '));equivalent(decodedCommand(command),config);
});

test('catalog validation accepts native default and rejects a model-unsupported level', () => {
  const state = api.initialState(preferences);
  const catalog = {clients: {chatgpt: {label: 'Codex', efforts: ['low', 'high', 'xhigh'], models: [
    {id: preferences.clients.chatgpt.code.model, efforts: ['high', 'xhigh'], defaultEffort: 'high'},
    {id: preferences.clients.chatgpt.light.model, efforts: [], defaultEffort: null}
  ]}}};
  for(const choice of Object.values(state.jobs.chatgpt))choice.effort=null;
  state.jobs.chatgpt.worker.effort = 'xhigh';
  assert.deepEqual(plain(api.buildConfig(state, preferences, catalog)).errors, []);
  state.jobs.chatgpt.worker.effort = 'low';
  assert.equal(api.buildConfig(state, preferences, catalog).config, null);
  state.jobs.chatgpt.worker.effort = null;
  assert.deepEqual(plain(api.buildConfig(state, preferences, catalog)).errors, []);
});

test('Kimi model selection reuses its alias effort; independent client roles keep valid effort', () => {
  const catalog = {efforts: ['low', 'high'], models: [{id: 'catalog/shared', efforts: ['low', 'high'], defaultEffort: 'high'}]};
  const jobs = {worker: {model: 'catalog/shared', effort: 'high'}, routine: {model: 'other', effort: 'low'}};
  assert.equal(api.preferenceForModel(preferences.clients.kimi, 'routine', 'catalog/shared', jobs, catalog, true).effort, 'high');
  assert.equal(api.preferenceForModel(preferences.clients.chatgpt, 'routine', 'catalog/shared', jobs, catalog).effort, 'low');
});

test('all three real release presets are valid with the shipped native catalog', () => {
  const catalog = JSON.parse(fs.readFileSync(new URL('../models/catalog.json', import.meta.url), 'utf8'));
  for (const id of ['fast', 'balanced', 'quality']) {
    const preset = JSON.parse(fs.readFileSync(new URL(`../policies/${id}.json`, import.meta.url), 'utf8'));
    const result = plain(api.buildConfig(api.initialState(preset), preset, catalog));
    assert.deepEqual(result.errors, [], id);
    assert.deepEqual(result.config, preset, id);
  }
});

test('Kimi native default can share an alias with one explicit effort pin', () => {
  const state = api.initialState(preferences);
  state.jobs.kimi.reviewer.effort = null;
  assert.deepEqual(plain(api.buildConfig(state, preferences)).errors, []);
  state.jobs.kimi.explorer = {...state.jobs.kimi.worker, effort: 'low'};
  assert.equal(api.buildConfig(state, preferences).config, null);
});

test('the release catalog offers Fable and the page composes an independent Fable task',()=>{
 const catalog=JSON.parse(fs.readFileSync(new URL('../models/catalog.json',import.meta.url),'utf8')),state=api.initialState(preferences),claude=catalog.clients.claude;assert.ok(claude.models.some(model=>model.id==='fable'));state.jobs.claude.reviewer=api.preferenceForModel(preferences.clients.claude,'reviewer','fable',state.jobs.claude,claude);const result=plain(api.buildConfig(state,preferences,catalog));assert.deepEqual(result.errors,[]);assert.equal(result.config.clients.claude.roles.reviewer.model,'fable');assert.ok(!result.config.clients.claude.avoidModels.includes('fable'));
});
test('custom Google dated IDs and native effort stay visible in the command',()=>{
 const catalog=JSON.parse(fs.readFileSync(new URL('../models/catalog.json',import.meta.url),'utf8')),state=api.initialState(preferences),model='claude-sonnet-4-5@20250929';
 state.jobs.claude.worker={model,effort:null};const result=plain(api.buildConfig(state,preferences,catalog));assert.deepEqual(result.errors,[]);
 const command=api.buildCommand(result.config,release);assert.ok(command.includes('worker='+model+':native'));
 assert.deepEqual(decodedCommand(command).clients.claude.roles.worker,{model,effort:null});
});

test('parallel edits are preserved when preset replacement is canceled and reset only after confirmation',()=>{
 const state=api.initialState(preferences);api.updateConcurrency(state,'chatgpt','5');
 const quality=JSON.parse(fs.readFileSync(new URL('../policies/quality.json',import.meta.url),'utf8')),before=JSON.stringify(state);
 assert.equal(api.applyPreset(state,{id:'quality',preferences:quality}),state);assert.equal(JSON.stringify(state),before);
 const next=api.applyPreset(state,{id:'quality',preferences:quality},()=>true);for(const client of next.selected)assert.equal(next.profiles[client].maxConcurrent,quality.clients[client].maxConcurrent??quality.maxConcurrent,client);
 const decoded=decodedCommand(api.buildCommand(plain(api.buildConfig(next,preferences).config),release));
 for(const client of next.selected)assert.equal(decoded.clients[client].maxConcurrent??decoded.maxConcurrent,quality.clients[client].maxConcurrent??quality.maxConcurrent,client);
});
test('concurrency edits propagate boundary values to applicable commands and block invalid drafts',()=>{
 for(const value of [1,5,32]){const state=api.initialState(preferences);api.updateConcurrency(state,'chatgpt',String(value));const built=plain(api.buildConfig(state,preferences));assert.deepEqual(built.errors,[]);const decoded=decodedCommand(api.buildCommand(built.config,release));assert.equal(decoded.clients.chatgpt.maxConcurrent??decoded.maxConcurrent,value);}
 for(const value of ['', '0','33','1.5']){const state=api.initialState(preferences);api.updateConcurrency(state,'chatgpt',value);const built=plain(api.buildConfig(state,preferences));assert.equal(built.config,null);assert.match(built.errors[0],/whole number.*1.*32/);}
});

test('Add all fills missing roles and tools while preserving existing selection order',()=>{
 assert.deepEqual(plain(api.addAll(['reviewer'],ROLE_IDS)),['reviewer','worker','explorer','tester','writer','routine']);
 assert.deepEqual(plain(api.addAll(['claude'],['chatgpt','claude','kimi','gemini','grok'])),['claude','chatgpt','kimi','gemini','grok']);
 const selected=['claude','chatgpt'];assert.deepEqual(plain(api.addAll(selected,['chatgpt','claude','kimi','gemini','grok'])),['claude','chatgpt','kimi','gemini','grok']);assert.deepEqual(selected,['claude','chatgpt']);
 assert.deepEqual(plain(api.addAll(['chatgpt','claude','kimi','gemini','grok'],['chatgpt','claude','kimi','gemini','grok'])),['chatgpt','claude','kimi','gemini','grok']);
});
test('adding all selections keeps model edits and the chosen concurrency in the generated configuration',()=>{
 const state=api.initialState(preferences);state.selected=['chatgpt'];state.selectedRoles=['reviewer'];state.profiles.chatgpt.maxConcurrent=7;state.jobs.chatgpt.reviewer={model:'custom/reviewer',effort:'high'};
 state.selected=api.addAll(state.selected,['chatgpt','claude','kimi','gemini','grok']);state.selectedRoles=api.addAll(state.selectedRoles,ROLE_IDS);
 const result=plain(api.buildConfig(state,preferences));assert.deepEqual(result.errors,[]);assert.equal(result.config.clients.chatgpt.maxConcurrent??result.config.maxConcurrent,7);assert.equal(result.config.clients.chatgpt.roles.reviewer.model,'custom/reviewer');assert.deepEqual(Object.keys(result.config.clients),['chatgpt','claude','kimi','gemini','grok']);equivalent(decodedCommand(api.buildCommand(result.config,release)),result.config);
});

test('concurrency stepper changes one tool command at a time and respects both limits',()=>{
 const state=api.initialState(preferences);
 api.stepConcurrency(state,'chatgpt',1);const decoded=decodedCommand(api.buildCommand(plain(api.buildConfig(state,preferences).config),release));assert.equal(decoded.clients.chatgpt.maxConcurrent,4);
 api.stepConcurrency(state,'chatgpt',-1);assert.equal(state.profiles.chatgpt.maxConcurrent,3);
 state.profiles.chatgpt.maxConcurrent=1;api.stepConcurrency(state,'chatgpt',-1);assert.equal(state.profiles.chatgpt.maxConcurrent,1);
 state.profiles.chatgpt.maxConcurrent=32;api.stepConcurrency(state,'chatgpt',1);assert.equal(state.profiles.chatgpt.maxConcurrent,32);
 for(const draft of ['', '1.5','NaN']){api.updateConcurrency(state,'chatgpt',draft);api.stepConcurrency(state,'chatgpt',1);assert.equal(state.profiles.chatgpt.maxConcurrent,1);assert.ok(api.buildConfig(state,preferences).config);}
 assert.equal(state.profiles.claude.maxConcurrent,3);
});

test('a bad parallel limit or model blocks the command while role selection stays intact',()=>{
 const state=api.initialState(preferences);assert.ok(api.buildConfig(state,preferences).config);
 state.profiles.chatgpt.maxConcurrent='';assert.equal(api.buildConfig(state,preferences).config,null);assert.equal((state.selectedRoles??ROLE_IDS).length,ROLE_IDS.length);
 state.profiles.chatgpt.maxConcurrent=5;assert.ok(api.buildConfig(state,preferences).config);
 state.jobs.chatgpt.worker.model='invalid model';assert.equal(api.buildConfig(state,preferences).config,null);
});

test('step progress follows the generated command and parallel edits clear a stale link error',()=>{
 assert.equal(api.stepCompletion,undefined);
 assert.match(template,/const complete=\[helpers\.length>0,pickedTools\.length>0,!!currentCommand,copied\];/);
 assert.match(template,/function refreshConcurrency\(\)\{linkError='';/);
});

test('parallel limits belong to individual tool profiles and preset selection restores only that tool',()=>{
 const state=api.initialState(preferences);state.active='chatgpt';api.updateConcurrency(state,'chatgpt','5');assert.equal(state.profiles.chatgpt.maxConcurrent,5);assert.equal(state.profiles.claude.maxConcurrent,3);assert.equal(api.modeFor(state,'chatgpt'),'custom');
 const quality=JSON.parse(fs.readFileSync(new URL('../policies/quality.json',import.meta.url),'utf8'));const next=api.applyPreset(state,{id:'quality',preferences:quality},()=>true);assert.equal(next.profiles.chatgpt.maxConcurrent,2);assert.equal(next.profiles.claude.maxConcurrent,3);assert.equal(state.profiles.chatgpt.maxConcurrent,5);
});
test('mixed limits reach explicit commands and invalid limits on unselected tools do not block the setup',()=>{
 const state=api.initialState(preferences);state.selected=['chatgpt','claude'];api.updateConcurrency(state,'chatgpt','5');api.updateConcurrency(state,'claude','2');const result=plain(api.buildConfig(state,preferences));assert.deepEqual(result.errors,[]);const decoded=decodedCommand(api.buildCommand(result.config,release));assert.equal(decoded.clients.chatgpt.maxConcurrent??decoded.maxConcurrent,5);assert.equal(decoded.clients.claude.maxConcurrent??decoded.maxConcurrent,2);
 api.updateConcurrency(state,'chatgpt','');assert.equal(api.buildConfig(state,preferences).config,null);state.selected=['claude'];assert.ok(api.buildConfig(state,preferences).config);
});
test('restoring old scalar links preserves their count while v2 restores distinct tool counts',()=>{
 const presets=['fast','balanced','quality'].map(id=>({id,preferences:JSON.parse(fs.readFileSync(new URL(`../policies/${id}.json`,import.meta.url),'utf8'))}));
 const common={release:'0.1.0',roles:['reviewer'],scope:'all',tools:[{id:'chatgpt',mode:'balanced',base:'balanced',choices:{reviewer:{model:'gpt-6.1-sol',effort:'high'}}},{id:'claude',mode:'balanced',base:'balanced',choices:{reviewer:{model:'sonnet',effort:'high'}}}]};
 const old=api.restoreState({...common,v:1,maxConcurrent:7},preferences,presets);assert.equal(old.profiles.chatgpt.maxConcurrent,7);assert.equal(old.profiles.claude.maxConcurrent,7);assert.equal(api.modeFor(old,'chatgpt'),'custom');
 const modern=api.restoreState({...common,v:2,tools:common.tools.map((t,i)=>({...t,mode:'custom',maxConcurrent:i?2:5}))},preferences,presets);assert.equal(modern.profiles.chatgpt.maxConcurrent,5);assert.equal(modern.profiles.claude.maxConcurrent,2);assert.equal(modern.jobs.chatgpt.reviewer.model,'gpt-6.1-sol');
});

test('selecting Gemini explains that only Antigravity is configured, not Gemini CLI',()=>{
 assert.deepEqual(plain(api.assistantNotices([])),[]);
 assert.deepEqual(plain(api.assistantNotices(['chatgpt','claude','kimi','grok'])),[]);
 const notices=plain(api.assistantNotices(['claude','gemini']));
 assert.equal(notices.length,1);assert.match(notices[0],/Gemini/);assert.match(notices[0],/Antigravity/);assert.match(notices[0],/not Gemini CLI/);
 assert.match(template,/<p class="notice tools-notice" id="tools-notice" role="note" hidden><\/p>/);
 assert.match(script,/\$\('tools-notice'\)/);
});
