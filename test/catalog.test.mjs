import test from 'node:test';import assert from 'node:assert/strict';
import {modelCatalog,presetPreferences,PRESETS,bundledReleaseInfo} from '../src/release.mjs';
import {validatePolicy,rolePreference,ROLES} from '../src/policy.mjs';

test('release catalog carries dated sourced native selectors and compatible efforts',()=>{
 const catalog=modelCatalog();assert.match(catalog.reviewedAt,/^\d{4}-\d\d-\d\d$/);
 assert.equal(catalog.clients.codex.models.length,9);assert.equal(catalog.clients.kimi.models.length,6);assert.equal(catalog.clients.agy.label,'Antigravity');
 for(const [client,data]of Object.entries(catalog.clients)){
  assert.equal(new Set(data.models.map(m=>m.id)).size,data.models.length);
  for(const model of data.models){assert.match(model.source,/^https:\/\//);assert.ok(model.efforts.every(e=>data.efforts.includes(e)),client);assert.ok(model.defaultEffort===null||model.efforts.includes(model.defaultEffort));}
 }
 assert.deepEqual(catalog.clients.agy.models.map(m=>m.id),['pro','flash','flash_lite','inherit']);
 assert.ok(catalog.clients.claude.models.some(m=>m.id==='claude-haiku-5-5'));
});

test('current Kimi inventory includes both K3.1 Pro routes with native thinking levels',()=>{
 const models=modelCatalog().clients.kimi.models;
 assert.deepEqual(models.map(model=>model.upstreamModelId),['k3.1-pro','k3.1-pro-highspeed','k3','k3-256k','kimi-for-coding','kimi-for-coding-highspeed']);
 for(const id of ['k3.1-pro','k3.1-pro-highspeed']){
  const model=models.find(model=>model.id==='kimi-code/'+id);assert.ok(model);
  assert.deepEqual(model.efforts,['low','high','max']);assert.equal(model.defaultEffort,'high');assert.equal(model.thinkingRequired,true);
  assert.equal(model.source,'https://www.kimi.com/code/docs/en/kimi-code/models');
 }
 const quality=presetPreferences('quality').clients.kimi;
 assert.deepEqual(quality.code,{model:'kimi-code/k3.1-pro',effort:'max'});assert.deepEqual(rolePreference(quality,'explorer'),{model:'kimi-code/k3',effort:'high'});
});

test('native effort choices stay separate from API-only capabilities and delegation modes',()=>{
 const catalog=modelCatalog(),sol=catalog.clients.codex.models.find(model=>model.id==='gpt-6.1-sol');
 assert.equal(sol.defaultEffort,'low');assert.equal(sol.apiDefaultEffort,'medium');assert.deepEqual(sol.delegationModes,['ultra']);
 const luna=catalog.clients.codex.models.find(model=>model.id==='gpt-6-luna');
 assert.ok(luna.apiEfforts.includes('none'));assert.ok(!luna.efforts.includes('none'));
 for(const model of catalog.clients.codex.models){assert.ok(!model.efforts.includes('ultra'));assert.ok(model.efforts.every(level=>model.apiEfforts.includes(level)));}
 const legacy=catalog.clients.claude.models.find(model=>model.id==='claude-opus-4-5-20251101');
 assert.deepEqual(legacy.efforts,[]);assert.deepEqual(legacy.apiEfforts,['low','medium','high']);
 const policy=structuredClone(presetPreferences('balanced'));
 policy.clients.codex.code={model:'gpt-6-luna',effort:'none'};assert.throws(()=>validatePolicy(policy));
 policy.clients.codex.code={model:'gpt-6-luna',effort:'high'};
 policy.clients.claude.code={model:legacy.id,effort:'high'};assert.throws(()=>validatePolicy(policy));
 policy.clients.claude.code.effort=null;assert.doesNotThrow(()=>validatePolicy(policy));
});
test('three named presets are valid editable recommendations from the same package release',()=>{
 assert.deepEqual(PRESETS.map(p=>p.id),['fast','balanced','quality']);
 const fingerprints=new Set();
 for(const preset of PRESETS){const preferences=presetPreferences(preset.id);validatePolicy(preferences);fingerprints.add(bundledReleaseInfo(preset.id).preferencesHash);for(const client of Object.values(preferences.clients))for(const role of Object.keys(ROLES))assert.ok(rolePreference(client,role));}
 assert.equal(fingerprints.size,3);assert.throws(()=>presetPreferences('../outside'),e=>e.code==='UNKNOWN_PRESET');
 assert.equal(presetPreferences('fast').clients.codex.code.model,'gpt-6-luna');assert.equal(presetPreferences('quality').clients.claude.code.model,'claude-fable-5-1');
});

test('Fable is a documented Claude subagent alias with current native effort choices',()=>{
 const data=modelCatalog().clients.claude,row=data.models.find(model=>model.id==='fable');assert.ok(row);assert.equal(row.kind,'alias');assert.deepEqual(row.efforts,['low','medium','high','xhigh','max']);assert.equal(row.defaultEffort,'high');assert.match(row.source,/^https:\/\/code\.claude\.com\/docs\/en\/(?:sub-agents|model-config)/);assert.ok(!data.excluded.some(model=>model.id==='fable'));assert.deepEqual(data.excluded.map(model=>model.id),['best','default','opus[1m]','opusplan','sonnet[1m]']);
});

test('public recommendations never carry personal model bans',()=>{
 for(const preset of PRESETS)for(const [client,config]of Object.entries(presetPreferences(preset.id).clients))assert.deepEqual(config.avoidModels,[],`${preset.id}/${client} must leave model choice open`);
});
test('Quality prioritizes frontier models for demanding implementation and review',()=>{
 const quality=presetPreferences('quality');
 for(const role of ['worker','reviewer']){
  assert.equal(rolePreference(quality.clients.codex,role).model,'gpt-6-astra');
  assert.equal(rolePreference(quality.clients.claude,role).model,'claude-fable-5-1');
 }
 assert.notEqual(rolePreference(quality.clients.codex,'routine').model,'gpt-6-astra');
 assert.notEqual(rolePreference(quality.clients.claude,'routine').model,'claude-fable-5-1');
});
