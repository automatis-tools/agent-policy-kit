import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validatePolicy,rolePreference} from '../src/policy.mjs';
import {ROLE_IDS} from '../src/roles.mjs';
import {EXPLICIT_FIELDS,parseExplicitOptions} from '../src/explicit.mjs';

const template = fs.readFileSync(new URL('../site/template.html', import.meta.url), 'utf8');
const preferences = JSON.parse(fs.readFileSync(new URL('../policies/balanced.json', import.meta.url), 'utf8'));
const release = {version: '0.1.0', preferences, notes: 'A release.', unreleased: true};
const codec=fs.readFileSync(new URL('../src/explicit.mjs',import.meta.url),'utf8').replace(/^export /gm,'');
const script = template.match(/<script>([\s\S]*?)<\/script>/)[1].replace('__APK_RELEASE_DATA__',()=>JSON.stringify(release)).replace('__APK_EXPLICIT_CODEC__',()=>codec);
const context = vm.createContext({TextEncoder, btoa});
vm.runInContext(script, context);
const api = context.APKConfigurator;
const plain = value => JSON.parse(JSON.stringify(value));
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
  for(const role of expected.selectedRoles??ROLE_IDS)assert.deepEqual(rolePreference(decoded.clients[client],role),expected.clients[client].roles?.[role]??expected.clients[client][['worker','reviewer'].includes(role)?'code':'light']);
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
  assert.deepEqual(plain(state.selected), ['codex', 'claude', 'kimi', 'agy']);
});

test('replacing custom settings requires confirmation and preserves the selected view', () => {
  const state = api.initialState(preferences);
  state.active = 'all'; state.profiles.codex.custom = true;
  state.jobs.codex.worker = {model: 'custom/code', effort: 'low'};
  const before = JSON.stringify(state);
  const fast = JSON.parse(fs.readFileSync(new URL('../policies/fast.json', import.meta.url), 'utf8'));
  const preset = {id: 'fast', label: 'Fast & economical', preferences: fast};
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

test('an individual preset changes only that tool and All reports mixed modes',()=>{
 const state=api.initialState(preferences);state.active='kimi';
 const quality=JSON.parse(fs.readFileSync(new URL('../policies/quality.json',import.meta.url),'utf8'));
 const preset={id:'quality',label:'Quality first',preferences:quality},before=JSON.stringify(state);
 assert.equal(api.applyPreset(state,preset),state,'scope warning requires confirmation');
 assert.equal(api.applyPreset(state,preset,()=>false),state);assert.equal(JSON.stringify(state),before);
 let prompts=0;const next=api.applyPreset(state,preset,()=>{prompts++;return true;});assert.equal(prompts,1);
 assert.equal(next.active,'kimi');assert.equal(api.modeFor(next),'quality');assert.equal(api.modeFor(next,'all'),'custom');
 for(const client of ['codex','claude','agy']){assert.deepEqual(plain(next.jobs[client]),plain(state.jobs[client]));assert.deepEqual(plain(next.profiles[client]),plain(state.profiles[client]));assert.equal(api.modeFor(next,client),'balanced');}
 const config=plain(api.buildConfig(next,preferences).config);assert.deepEqual(config.clients.kimi,quality.clients.kimi);
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
 assert.equal(api.modeFor(named,'all'),'balanced');assert.equal(named.jobs.codex.worker.effort,'high');
});

test('configuration template has a single release marker and no external assets or network calls', () => {
  assert.equal(template.split('__APK_RELEASE_DATA__').length, 2);
  assert.doesNotMatch(template, /<(?:script|link|img)[^>]+(?:src|href)=/i);
  assert.doesNotMatch(script, /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/);
  assert.doesNotMatch(template, /type="(?:checkbox|number)"|role="tablist"|id="effort-/);
  assert.match(template, /id="selected-tools"[^>]*role="group"/);
  assert.match(template, /id="setup-command" readonly/);
  assert.doesNotMatch(template,/savedDesign|Design prototype|installer not connected/);
});

test('recommendations expose four independent jobs and preserve native fallbacks', () => {
  const state = api.initialState(preferences);
  const {config, errors} = plain(api.buildConfig(state, preferences));
  assert.deepEqual(errors, []);
  assert.deepEqual(Object.keys(config.clients), ['codex', 'claude', 'kimi', 'agy']);
  assert.deepEqual(config, preferences);
  assert.deepEqual(Object.keys(state.jobs.codex), ['worker', 'reviewer', 'explorer', 'routine']);
  assert.equal(config.clients.codex.roles, undefined);
  assert.deepEqual(config.clients.codex.code, preferences.clients.codex.code);
  assert.deepEqual(config.clients.kimi.light, preferences.clients.kimi.light);
  assert.deepEqual(plain(state.jobs.agy.worker), {model: 'pro', effort: null});
  state.jobs.codex.reviewer.model = 'custom/review:1';
  assert.equal(state.jobs.codex.worker.model, preferences.clients.codex.code.model);
});

test('all four tools stay configured and only changed roles produce overrides', () => {
  const state = api.initialState(preferences);
  state.jobs.claude.reviewer = api.preferenceForModel(preferences.clients.claude, 'reviewer', 'opus');
  const {config, errors} = plain(api.buildConfig(state, preferences));
  assert.deepEqual(errors, []);
  assert.deepEqual(Object.keys(config.clients), ['codex', 'claude', 'kimi', 'agy']);
  assert.equal(config.maxConcurrent, preferences.maxConcurrent);
  assert.deepEqual(config.clients.claude.roles, {reviewer: {model: 'opus', effort: 'high'}});
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
  for (const role of ['worker', 'reviewer', 'explorer', 'routine']) {
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
  for (const role of ['worker', 'reviewer', 'explorer', 'routine']) state.jobs.kimi[role] = {model: 'kimi-code/k3', effort: 'low'};
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
    const state = api.initialState(preferences); state.maxConcurrent = maxConcurrent;
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

test('command is version pinned, fully explicit and shell safe', () => {
  const config = plain(api.buildConfig(api.initialState(preferences), preferences).config);
  const command = api.buildCommand(config, release);
  assert.match(command, /^npx --yes --ignore-scripts --package agent-policy-kit@0\.1\.0 agent-policy setup/);
  assert.doesNotMatch(command,/--config|--preset|--release/);
  for(const flag of ['codex','claude','kimi','antigravity'])assert.ok(command.includes('--'+flag+" '"));
  equivalent(decodedCommand(command),config);
  assert.throws(() => api.buildCommand(config, {...release, version: '0.1.0;echo'}), /Invalid release/);
  assert.equal(Buffer.from(api.encodeConfig({note: 'Привіт'}), 'base64url').toString('utf8'), JSON.stringify({note: 'Привіт'}));
});

test('approved four-step builder exposes roles, tools, modes and a copy command action', () => {
  assert.match(template, /Set up subagents for your coding tools\./);
  assert.match(template, /Apply your setup locally with one command\./);
  assert.deepEqual([...template.matchAll(/class="step-number">(\d)<\/span>/g)].map(match=>match[1]),['1','2','3','4']);
  assert.match(script, /type:'radio',name:'mode'/);
  assert.match(script, /\['Role','Model','Effort'\]/);
  assert.match(script, /agy: 'Antigravity'/);
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
  state.jobs.codex.explorer.effort = null;
  state.jobs.codex.routine.effort = null;
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
