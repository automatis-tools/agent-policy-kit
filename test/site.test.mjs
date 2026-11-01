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
for(const [id,client]of Object.entries(preferences.clients)){delete client.roles;if(!['agy','grok'].includes(id))client.code.effort='high';}
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
 state.selected=['codex'];state.active='codex';state.selectedRoles=['worker'];assert.equal(api.modeFor(state),null);assert.equal(api.buildConfig(state,preferences).config,null);
 const chosen=api.applyPreset(state,{id:'balanced',preferences},()=>{throw new Error('first mode selection must not warn');});
 assert.equal(chosen.profiles.codex.modeSelected,true);assert.equal(api.modeFor(chosen),'balanced');assert.ok(api.buildConfig(chosen,preferences).config);
});

test('fresh form preselects every role in catalog order while tools stay unselected',()=>{
 const state=api.initialState(preferences,'balanced',{empty:true});
 assert.deepEqual(plain(state.selectedRoles),ROLE_IDS);assert.deepEqual(plain(state.selected),[]);
 assert.deepEqual(plain(api.stepCompletion(state,preferences)),[true,false,false,false]);
 state.selectedRoles.pop();assert.deepEqual(plain(api.initialState(preferences,'balanced',{empty:true}).selectedRoles),ROLE_IDS);
});

test('page starts and resets with every role selected and an independent role list',()=>{
 assert.match(template,/let helpers=\[\.\.\.state\.selectedRoles\],pickedTools=\[\];/);
 const freshForm=template.slice(template.indexOf(' function freshForm('),template.indexOf(' function loadAddress('));
 const context=vm.createContext({A:api,initial:{preferences,id:'balanced'},toolModeLabels:new Map()});
 vm.runInContext(`let state=null,helpers=['reviewer'],pickedTools=['codex'],selectedScope='codex',lastCopiedCommand='old',commandRevision=0;${freshForm};freshForm();globalThis.result={helpers,pickedTools,selectedScope,stateRoles:state.selectedRoles};`,context);
 const {result}=context;assert.deepEqual(plain(result.helpers),ROLE_IDS);assert.deepEqual(plain(result.pickedTools),[]);assert.equal(result.selectedScope,null);assert.notEqual(result.helpers,result.stateRoles);
});

const TOP={codex:'gpt-6-astra',claude:'claude-fable-5-1',kimi:'kimi-code/k3.1-pro'};
function topTier(){const quality=JSON.parse(fs.readFileSync(new URL('../policies/quality.json',import.meta.url),'utf8'));return {quality,preset:{id:'quality',label:'Top-tier',preferences:quality,topModels:TOP}};}

test('the Top-tier top-model switch changes only code roles of the chosen tool and keeps the mode',()=>{
 const {quality,preset}=topTier();
 let state=api.initialState(preferences,'balanced',{empty:true});state.selected=['codex','claude','agy'];state.active='all';
 state=api.applyPreset(state,preset);assert.equal(api.modeFor(state),'quality');
 for(const client of ['codex','claude'])assert.equal(api.topModelsOn(state,client),false,client);
 assert.deepEqual(plain(api.topModelRoles(state,'agy')),[]);assert.deepEqual(plain(api.topModelRoles(state,'claude')),['worker','reviewer','tester']);
 api.setTopModels(state,['claude'],true);
 assert.equal(api.topModelsOn(state,'claude'),true);assert.equal(api.topModelsOn(state,'codex'),false);
 for(const role of ['worker','reviewer','tester'])assert.deepEqual(plain(state.jobs.claude[role]),{model:TOP.claude,effort:'high'});
 for(const role of ['explorer','writer','routine'])assert.deepEqual(plain(state.jobs.claude[role]),rolePreference(quality.clients.claude,role));
 assert.equal(api.modeFor(state,'claude'),'quality');assert.equal(api.modeFor(state),'quality');
 assert.equal(rolePreference(api.buildConfig(state,preferences).config.clients.claude,'worker').model,TOP.claude);
 const standard=api.applyPreset(state,{id:'balanced',preferences},()=>{throw new Error('top models belong to Top-tier, not to edits');});
 assert.equal(api.modeFor(standard),'balanced');
 const again=api.applyPreset(state,preset,()=>true);assert.equal(api.topModelsOn(again,'claude'),false);
 api.setTopModels(state,['claude'],false);assert.deepEqual(plain(state.jobs.claude.worker),rolePreference(quality.clients.claude,'worker'));
 state.profiles.codex.custom=true;assert.deepEqual(plain(api.topModelRoles(state,'codex')),[]);
});

test('the page shows one top-model switch under Top-tier and wires it to the selected scope',()=>{
 assert.match(template,/<button type="button" role="switch" id="top-models-toggle" aria-checked="false">/);
 assert.match(template,/renderModeNotice\(\);renderTopModels\(\);/);
 assert.match(template,/A\.setTopModels\(state,topTargets\(\),event\.currentTarget\.getAttribute\('aria-checked'\)!=='true'\)/);
 assert.match(template,/if\(A\.modeFor\(state\)!=='quality'\)return \[\];/);
});

test('restoring a Top-tier link with top models applies them to every code role',()=>{
 const {preset}=topTier(),data={v:2,release:'0.1.0',roles:['reviewer'],tools:[{id:'claude',mode:'quality',base:'quality',maxConcurrent:2,choices:{reviewer:{model:TOP.claude,effort:'high'}}}],scope:'claude'};
 const state=api.restoreState(data,preferences,[preset],'balanced');
 assert.equal(api.modeFor(state,'claude'),'quality');assert.equal(api.topModelsOn(state,'claude'),true);
 for(const role of ['worker','reviewer','tester'])assert.equal(state.jobs.claude[role].model,TOP.claude);
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
 assert.match(template,/\$\('concurrency-label'\)\.textContent=\['kimi','agy'\]\.includes\(client\)\?'Max per session \(advisory\)':'Max per session';/);
});

test('the header links to the repository instead of showing the release version',()=>{
 const header=template.match(/<header>[\s\S]*?<\/header>/)[0];
 assert.match(header,/<a class="repo-link" href="__APK_REPOSITORY_URL__" target="_blank" rel="noopener noreferrer" aria-label="Agent Policy Kit on GitHub">/);
 assert.doesNotMatch(template,/release-version/);
 const page=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 assert.match(page,/<a class="repo-link" href="https:\/\/github\.com\/automatis-tools\/agent-policy-kit"/);
});

test('Reset form sits with the form result, not in the site header',()=>{
 const header=template.match(/<header>[\s\S]*?<\/header>/)[0];
 assert.doesNotMatch(header,/reset-form/);
 assert.match(template,/<div class="setup-footer"><p class="release-status" id="release-status"><\/p><button type="button" class="reset-form" id="reset-form">Reset form<\/button><\/div><\/section>/);
});

test('empty role and tool fields share one empty-field appearance',()=>{
 const declarations=selector=>{const body=template.match(new RegExp(`(?:^|[}\\n])${selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\{([^}]*)\\}`))?.[1];assert.ok(body,selector);return Object.fromEntries(body.split(';').filter(Boolean).map(item=>{const at=item.indexOf(':');return [item.slice(0,at),item.slice(at+1)];}));};
 const field=declarations('.tag-box'),emptyTools=declarations('.tool-group.is-empty');
 for(const property of ['min-height','padding','background'])assert.equal(emptyTools[property],field[property],property);
 assert.equal(declarations('.tool-group.is-empty .empty').padding,declarations('.empty').padding);
 assert.match(template,/box\.classList\.toggle\('is-empty',!chosen\.length\)/);
 assert.match(template,/'Add roles from below'/);assert.match(template,/'Add coding tools from below'/);
});

test('a partially selected global mode warns before replacing existing choices',()=>{
 let state=api.initialState(preferences,'balanced',{empty:true});state.selected=['codex','claude'];state.selectedRoles=['reviewer'];state.active='codex';
 state=api.applyPreset(state,{id:'balanced',preferences});state.active='all';assert.equal(api.modeFor(state),null);assert.equal(api.buildConfig(state,preferences).config,null);
 const fast=JSON.parse(fs.readFileSync(new URL('../policies/fast.json',import.meta.url),'utf8'));
 assert.equal(api.applyPreset(state,{id:'fast',preferences:fast}),state);
 const next=api.applyPreset(state,{id:'fast',preferences:fast},()=>true);assert.equal(api.modeFor(next),'fast');assert.ok(api.buildConfig(next,preferences).config);
});

test('manual effort selection chooses Custom for that tool',()=>{
 const state=api.initialState(preferences,'balanced',{empty:true});state.selected=['codex'];state.active='codex';state.selectedRoles=['worker'];
 api.updateEffort(state,'codex','worker','high');assert.equal(state.profiles.codex.modeSelected,true);assert.equal(api.modeFor(state),'custom');
});

test('switching All to Custom alone does not create a destructive preset change',()=>{
 const state=api.initialState(preferences);for(const client of state.selected)state.profiles[client].custom=true;
 const quality=JSON.parse(fs.readFileSync(new URL('../policies/quality.json',import.meta.url),'utf8'));
 const next=api.applyPreset(state,{id:'quality',preferences:quality},()=>{throw new Error('No edited settings to overwrite');});
 assert.equal(api.modeFor(next),'quality');
});

test('All still protects real model edits and mixed bases',()=>{
 const quality=JSON.parse(fs.readFileSync(new URL('../policies/quality.json',import.meta.url),'utf8'));
 for(const change of [state=>{state.jobs.codex.worker.effort='low';},state=>{state.profiles.claude.presetId='quality';}]){
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
 const state=api.initialState(preferences);state.selected=['codex'];state.selectedRoles=['reviewer'];
 state.jobs.codex.worker={model:'unused invalid model',effort:'invalid'};
 state.jobs.codex.reviewer={model:'custom/review',effort:'high'};
 const {config,errors}=plain(api.buildConfig(state,preferences));assert.deepEqual(errors,[]);
 assert.deepEqual(config.selectedRoles,['reviewer']);assert.deepEqual(Object.keys(config.clients),['codex']);
 assert.deepEqual(config.clients.codex.roles,{reviewer:{model:'custom/review',effort:'high'}});validatePolicy(config);
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
  assert.deepEqual(plain(state.selected), ['codex', 'claude', 'kimi', 'agy', 'grok']);
});

test('replacing custom settings requires confirmation and preserves the selected view', () => {
  const state = api.initialState(preferences);
  state.active = 'all'; state.profiles.codex.custom = true;
  state.jobs.codex.worker = {model: 'custom/code', effort: 'low'};
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
 let state=api.initialState(preferences,'balanced',{empty:true});state.selected=['codex'];state.active='codex';
 state=api.applyPreset(state,{id:'balanced',preferences});assert.equal(api.modeFor(state,'codex'),'balanced');
 const light=api.applyPreset(state,{id:'fast',label:'Light',preferences:fast},()=>{throw new Error('nothing to lose, no confirmation');});
 assert.equal(api.modeFor(light,'codex'),'fast');
 state.jobs.codex.worker={model:'custom/code',effort:'low'};let asked=0;
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
 for(const client of ['codex','claude','agy']){assert.deepEqual(plain(next.jobs[client]),plain(state.jobs[client]));assert.deepEqual(plain(next.profiles[client]),plain(state.profiles[client]));assert.equal(api.modeFor(next,client),'balanced');}
 const config=plain(api.buildConfig(next,preferences).config);assert.deepEqual(config.clients.kimi,{...quality.clients.kimi,maxConcurrent:2});
 for(const client of ['codex','claude','agy'])assert.deepEqual(config.clients[client],preferences.clients[client]);
 assert.equal(next.maxConcurrent,state.maxConcurrent);assert.equal(JSON.stringify(state),before);
 next.active='all';const reset=api.applyPreset(next,{id:'balanced',preferences},()=>true);
 assert.equal(api.modeFor(reset),'balanced');for(const client of reset.selected)assert.equal(api.modeFor(reset,client),'balanced');
 assert.deepEqual(plain(api.buildConfig(reset,preferences).config),preferences);
});

test('manual effort edits mark only their tool Custom while other named modes remain',()=>{
 const state=api.initialState(preferences);api.updateEffort(state,'codex','worker','low');
 assert.equal(api.modeFor(state,'codex'),'custom');assert.equal(api.modeFor(state,'all'),'custom');
 for(const client of ['claude','kimi','agy'])assert.equal(api.modeFor(state,client),'balanced');
 const named=api.applyPreset({...state,active:'codex'},{id:'balanced',preferences},()=>true);
 assert.equal(api.modeFor(named,'all'),'balanced');assert.equal(named.jobs.codex.worker.effort,preferences.clients.codex.code.effort);
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
  assert.deepEqual(Object.keys(config.clients), ['codex', 'claude', 'kimi', 'agy', 'grok']);
  assert.deepEqual(config, preferences);
  assert.deepEqual(Object.keys(state.jobs.codex), ROLE_IDS);
  assert.equal(config.clients.codex.roles, undefined);
  assert.deepEqual(config.clients.codex.code, preferences.clients.codex.code);
  assert.deepEqual(config.clients.kimi.light, preferences.clients.kimi.light);
  assert.deepEqual(plain(state.jobs.agy.worker), {model: 'pro', effort: null});
  state.jobs.codex.reviewer.model = 'custom/review:1';
  assert.equal(state.jobs.codex.worker.model, preferences.clients.codex.code.model);
});

test('all five tools stay configured and only changed roles produce overrides', () => {
  const state = api.initialState(preferences);
  state.jobs.claude.reviewer = api.preferenceForModel(preferences.clients.claude, 'reviewer', 'opus');
  const {config, errors} = plain(api.buildConfig(state, preferences));
  assert.deepEqual(errors, []);
  assert.deepEqual(Object.keys(config.clients), ['codex', 'claude', 'kimi', 'agy', 'grok']);
  assert.equal(config.maxConcurrent, preferences.maxConcurrent);
  assert.deepEqual(config.clients.claude.roles, {reviewer: {model: 'opus', effort: preferences.clients.claude.code.effort}});
  assert.ok(!config.clients.claude.avoidModels.includes('opus'));
  assert.deepEqual(config.clients.claude.code, preferences.clients.claude.code);
  assert.equal(config.clients.codex.roles, undefined);
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
  custom.clients.codex.roles = {reviewer: {model: 'review/custom', effort: 'medium'}};
  const state = api.initialState(custom);
  assert.equal(state.jobs.codex.reviewer.model, 'review/custom');
  assert.equal(state.jobs.codex.worker.model, custom.clients.codex.code.model);
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
    state.jobs.codex.worker.model = model;
    const invalid = api.buildConfig(state, preferences);
    assert.equal(invalid.config, null, model);
    assert.ok(invalid.errors.length, model);
  }
  for (const maxConcurrent of ['', '1.2', 'NaN', '0', '33']) {
    const state = api.initialState(preferences); state.profiles.codex.maxConcurrent = maxConcurrent===''?'':Number(maxConcurrent);
    assert.equal(api.buildConfig(state, preferences).config, null, maxConcurrent);
  }
  for(const selected of [[],null,'codex',{},['codex','codex'],['invented']]){
    const state=api.initialState(preferences);state.selected=selected;
    assert.equal(api.buildConfig(state,preferences).config,null);
  }
});

test('agy accepts native tiers without invented per-role effort', () => {
  const state = api.initialState(preferences);
  state.jobs.agy.reviewer = {model: 'inherit', effort: null};
  assert.deepEqual(plain(api.buildConfig(state, preferences)).errors, []);
  state.jobs.agy.reviewer.effort = 'high';
  assert.equal(api.buildConfig(state, preferences).config, null);
  state.jobs.agy.reviewer = {model: 'custom-model', effort: null};
  assert.equal(api.buildConfig(state, preferences).config, null);
});

test('Grok Build accepts any model identifier but never a per-role effort', () => {
  const state = api.initialState(preferences);
  state.jobs.grok.reviewer = {model: 'grok-4.5', effort: null};
  state.jobs.grok.explorer = {model: 'custom-grok-model', effort: null};
  const built = plain(api.buildConfig(state, preferences));
  assert.deepEqual(built.errors, []);
  assert.deepEqual(built.config.clients.grok.roles.reviewer, {model: 'grok-4.5', effort: null});
  state.jobs.grok.reviewer.effort = 'high';
  assert.equal(api.buildConfig(state, preferences).config, null);
  state.jobs.grok.reviewer = {model: 'grok-4.5', effort: null};
  state.selected = ['grok'];state.active = 'grok';
  const command = api.buildCommand(plain(api.buildConfig(state, preferences).config), release);
  assert.match(command, /--grok '[^']*reviewer=grok-4\.5[^']*'/);
  assert.doesNotMatch(command, /--grok '[^']*:/);
  equivalent(decodedCommand(command), plain(api.buildConfig(state, preferences).config));
});

test('command is version pinned, fully explicit and shell safe', () => {
  const config = plain(api.buildConfig(api.initialState(preferences), preferences).config);
  const command = api.buildCommand(config, release);
  assert.match(command, /^npx --yes --ignore-scripts --package agent-policy-kit@0\.1\.0 agent-policy setup/);
  assert.doesNotMatch(command,/--config|--preset|--release/);
  for(const flag of ['codex','claude','kimi','antigravity','grok'])assert.ok(command.includes('--'+flag+" '"));
  equivalent(decodedCommand(command),config);
  assert.throws(() => api.buildCommand(config, {...release, version: '0.1.0;echo'}), /Invalid release/);
  assert.equal(Buffer.from(api.encodeConfig({note: 'Привіт'}), 'base64url').toString('utf8'), JSON.stringify({note: 'Привіт'}));
});

test('four-step builder keeps parallelism with roles and the copy action last', () => {
  assert.match(template, /Set up subagents for your coding tools\./);
  assert.match(template, /Apply your setup locally with one command\./);
  assert.deepEqual([...template.matchAll(/class="step-number">(\d)<\/span>/g)].map(match=>match[1]),['1','2','3','4']);
  assert.match(script, /type:'radio',name:'mode'/);
  assert.match(script, /\['Role','Model','Effort'\]/);
  assert.match(script, /agy: 'Antigravity', grok: 'Grok Build'/);
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
  assert.deepEqual(plain(api.preferenceForModel(preferences.clients.codex, 'worker', 'catalog/model-a', jobs, catalog)), {model: 'catalog/model-a', effort: 'high'});
  jobs.worker.effort = 'xhigh';
  assert.equal(api.preferenceForModel(preferences.clients.codex, 'worker', 'catalog/model-a', jobs, catalog).effort, 'xhigh');
  assert.equal(api.preferenceForModel(preferences.clients.codex, 'worker', 'catalog/model-b', jobs, catalog).effort, null);
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
  config.clients.codex.roles = {reviewer: {model: 'custom/reviewer', effort: 'high'}};
  const custom=api.buildCommand(config,withPresets);assert.ok(custom.includes('reviewer=custom/reviewer:high'));equivalent(decodedCommand(custom),config);
});

test('explicit tool argument order follows the selected tool order',()=>{
 const state=api.initialState(preferences);state.selected=['kimi','codex'];state.selectedRoles=['reviewer'];
 const config=plain(api.buildConfig(state,preferences).config),command=api.buildCommand(config,release);
 assert.ok(command.indexOf('--kimi ')<command.indexOf('--codex '));equivalent(decodedCommand(command),config);
});

test('catalog validation accepts native default and rejects a model-unsupported level', () => {
  const state = api.initialState(preferences);
  const catalog = {clients: {codex: {label: 'Codex', efforts: ['low', 'high', 'xhigh'], models: [
    {id: preferences.clients.codex.code.model, efforts: ['high', 'xhigh'], defaultEffort: 'high'},
    {id: preferences.clients.codex.light.model, efforts: [], defaultEffort: null}
  ]}}};
  for(const choice of Object.values(state.jobs.codex))choice.effort=null;
  state.jobs.codex.worker.effort = 'xhigh';
  assert.deepEqual(plain(api.buildConfig(state, preferences, catalog)).errors, []);
  state.jobs.codex.worker.effort = 'low';
  assert.equal(api.buildConfig(state, preferences, catalog).config, null);
  state.jobs.codex.worker.effort = null;
  assert.deepEqual(plain(api.buildConfig(state, preferences, catalog)).errors, []);
});

test('Kimi model selection reuses its alias effort; independent client roles keep valid effort', () => {
  const catalog = {efforts: ['low', 'high'], models: [{id: 'catalog/shared', efforts: ['low', 'high'], defaultEffort: 'high'}]};
  const jobs = {worker: {model: 'catalog/shared', effort: 'high'}, routine: {model: 'other', effort: 'low'}};
  assert.equal(api.preferenceForModel(preferences.clients.kimi, 'routine', 'catalog/shared', jobs, catalog, true).effort, 'high');
  assert.equal(api.preferenceForModel(preferences.clients.codex, 'routine', 'catalog/shared', jobs, catalog).effort, 'low');
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
 const state=api.initialState(preferences);api.updateConcurrency(state,'codex','5');
 const quality=JSON.parse(fs.readFileSync(new URL('../policies/quality.json',import.meta.url),'utf8')),before=JSON.stringify(state);
 assert.equal(api.applyPreset(state,{id:'quality',preferences:quality}),state);assert.equal(JSON.stringify(state),before);
 const next=api.applyPreset(state,{id:'quality',preferences:quality},()=>true);for(const client of next.selected)assert.equal(next.profiles[client].maxConcurrent,2);
 assert.equal(decodedCommand(api.buildCommand(plain(api.buildConfig(next,preferences).config),release)).maxConcurrent,2);
});
test('concurrency edits propagate boundary values to applicable commands and block invalid drafts',()=>{
 for(const value of [1,5,32]){const state=api.initialState(preferences);api.updateConcurrency(state,'codex',String(value));const built=plain(api.buildConfig(state,preferences));assert.deepEqual(built.errors,[]);const decoded=decodedCommand(api.buildCommand(built.config,release));assert.equal(decoded.clients.codex.maxConcurrent??decoded.maxConcurrent,value);}
 for(const value of ['', '0','33','1.5']){const state=api.initialState(preferences);api.updateConcurrency(state,'codex',value);const built=plain(api.buildConfig(state,preferences));assert.equal(built.config,null);assert.match(built.errors[0],/whole number.*1.*32/);}
});

test('Add all fills missing roles and tools while preserving existing selection order',()=>{
 assert.deepEqual(plain(api.addAll(['reviewer'],ROLE_IDS)),['reviewer','worker','explorer','tester','writer','routine']);
 assert.deepEqual(plain(api.addAll(['claude'],['codex','claude','kimi','agy','grok'])),['claude','codex','kimi','agy','grok']);
 const selected=['claude','codex'];assert.deepEqual(plain(api.addAll(selected,['codex','claude','kimi','agy','grok'])),['claude','codex','kimi','agy','grok']);assert.deepEqual(selected,['claude','codex']);
 assert.deepEqual(plain(api.addAll(['codex','claude','kimi','agy','grok'],['codex','claude','kimi','agy','grok'])),['codex','claude','kimi','agy','grok']);
});
test('adding all selections keeps model edits and the chosen concurrency in the generated configuration',()=>{
 const state=api.initialState(preferences);state.selected=['codex'];state.selectedRoles=['reviewer'];state.profiles.codex.maxConcurrent=7;state.jobs.codex.reviewer={model:'custom/reviewer',effort:'high'};
 state.selected=api.addAll(state.selected,['codex','claude','kimi','agy','grok']);state.selectedRoles=api.addAll(state.selectedRoles,ROLE_IDS);
 const result=plain(api.buildConfig(state,preferences));assert.deepEqual(result.errors,[]);assert.equal(result.config.clients.codex.maxConcurrent??result.config.maxConcurrent,7);assert.equal(result.config.clients.codex.roles.reviewer.model,'custom/reviewer');assert.deepEqual(Object.keys(result.config.clients),['codex','claude','kimi','agy','grok']);equivalent(decodedCommand(api.buildCommand(result.config,release)),result.config);
});

test('concurrency stepper changes one tool command at a time and respects both limits',()=>{
 const state=api.initialState(preferences);
 api.stepConcurrency(state,'codex',1);const decoded=decodedCommand(api.buildCommand(plain(api.buildConfig(state,preferences).config),release));assert.equal(decoded.clients.codex.maxConcurrent,4);
 api.stepConcurrency(state,'codex',-1);assert.equal(state.profiles.codex.maxConcurrent,3);
 state.profiles.codex.maxConcurrent=1;api.stepConcurrency(state,'codex',-1);assert.equal(state.profiles.codex.maxConcurrent,1);
 state.profiles.codex.maxConcurrent=32;api.stepConcurrency(state,'codex',1);assert.equal(state.profiles.codex.maxConcurrent,32);
 for(const draft of ['', '1.5','NaN']){api.updateConcurrency(state,'codex',draft);api.stepConcurrency(state,'codex',1);assert.equal(state.profiles.codex.maxConcurrent,1);assert.ok(api.buildConfig(state,preferences).config);}
 assert.equal(state.profiles.claude.maxConcurrent,3);
});

test('a bad parallel limit invalidates tool details and copy but leaves role selection complete',()=>{
 const empty=api.initialState(preferences,'balanced',{empty:true});assert.deepEqual(plain(api.stepCompletion(empty,preferences)),[true,false,false,false]);
 empty.selectedRoles=[];assert.deepEqual(plain(api.stepCompletion(empty,preferences)),[false,false,false,false]);
 const state=api.initialState(preferences);assert.deepEqual(plain(api.stepCompletion(state,preferences)),[true,true,true,false]);
 state.profiles.codex.maxConcurrent='';assert.deepEqual(plain(api.stepCompletion(state,preferences,undefined,true)),[true,true,false,false]);
 state.profiles.codex.maxConcurrent=5;assert.deepEqual(plain(api.stepCompletion(state,preferences,undefined,true)),[true,true,true,true]);
 state.jobs.codex.worker.model='invalid model';assert.deepEqual(plain(api.stepCompletion(state,preferences,undefined,true)),[true,true,false,false]);
});

test('parallel limits belong to individual tool profiles and preset selection restores only that tool',()=>{
 const state=api.initialState(preferences);state.active='codex';api.updateConcurrency(state,'codex','5');assert.equal(state.profiles.codex.maxConcurrent,5);assert.equal(state.profiles.claude.maxConcurrent,3);assert.equal(api.modeFor(state,'codex'),'custom');
 const quality=JSON.parse(fs.readFileSync(new URL('../policies/quality.json',import.meta.url),'utf8'));const next=api.applyPreset(state,{id:'quality',preferences:quality},()=>true);assert.equal(next.profiles.codex.maxConcurrent,2);assert.equal(next.profiles.claude.maxConcurrent,3);assert.equal(state.profiles.codex.maxConcurrent,5);
});
test('mixed limits reach explicit commands and invalid limits on unselected tools do not block the setup',()=>{
 const state=api.initialState(preferences);state.selected=['codex','claude'];api.updateConcurrency(state,'codex','5');api.updateConcurrency(state,'claude','2');const result=plain(api.buildConfig(state,preferences));assert.deepEqual(result.errors,[]);const decoded=decodedCommand(api.buildCommand(result.config,release));assert.equal(decoded.clients.codex.maxConcurrent??decoded.maxConcurrent,5);assert.equal(decoded.clients.claude.maxConcurrent??decoded.maxConcurrent,2);
 api.updateConcurrency(state,'codex','');assert.equal(api.buildConfig(state,preferences).config,null);state.selected=['claude'];assert.ok(api.buildConfig(state,preferences).config);
});
test('restoring old scalar links preserves their count while v2 restores distinct tool counts',()=>{
 const presets=['fast','balanced','quality'].map(id=>({id,preferences:JSON.parse(fs.readFileSync(new URL(`../policies/${id}.json`,import.meta.url),'utf8'))}));
 const common={release:'0.1.0',roles:['reviewer'],scope:'all',tools:[{id:'codex',mode:'balanced',base:'balanced',choices:{reviewer:{model:'gpt-6.1-sol',effort:'high'}}},{id:'claude',mode:'balanced',base:'balanced',choices:{reviewer:{model:'sonnet',effort:'high'}}}]};
 const old=api.restoreState({...common,v:1,maxConcurrent:7},preferences,presets);assert.equal(old.profiles.codex.maxConcurrent,7);assert.equal(old.profiles.claude.maxConcurrent,7);assert.equal(api.modeFor(old,'codex'),'custom');
 const modern=api.restoreState({...common,v:2,tools:common.tools.map((t,i)=>({...t,mode:'custom',maxConcurrent:i?2:5}))},preferences,presets);assert.equal(modern.profiles.codex.maxConcurrent,5);assert.equal(modern.profiles.claude.maxConcurrent,2);assert.equal(modern.jobs.codex.reviewer.model,'gpt-6.1-sol');
});
