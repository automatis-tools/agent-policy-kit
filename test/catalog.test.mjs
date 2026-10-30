import test from 'node:test';import assert from 'node:assert/strict';
import {modelCatalog,presetPreferences,PRESETS,bundledReleaseInfo} from '../src/release.mjs';
import {validatePolicy,rolePreference,ROLES} from '../src/policy.mjs';

test('release catalog carries dated sourced native selectors and compatible efforts',()=>{
 const catalog=modelCatalog();assert.match(catalog.reviewedAt,/^\d{4}-\d\d-\d\d$/);
 assert.equal(catalog.clients.codex.models.length,9);assert.equal(catalog.clients.kimi.models.length,4);assert.equal(catalog.clients.agy.label,'Antigravity');
 for(const [client,data]of Object.entries(catalog.clients)){
  assert.equal(new Set(data.models.map(m=>m.id)).size,data.models.length);
  for(const model of data.models){assert.match(model.source,/^https:\/\//);assert.ok(model.efforts.every(e=>data.efforts.includes(e)),client);assert.ok(model.defaultEffort===null||model.efforts.includes(model.defaultEffort));}
 }
 assert.deepEqual(catalog.clients.agy.models.map(m=>m.id),['pro','flash','flash_lite','inherit']);
 assert.ok(catalog.clients.claude.models.some(m=>m.id==='claude-haiku-5-5'));
});
test('three named presets are valid editable recommendations from the same package release',()=>{
 assert.deepEqual(PRESETS.map(p=>p.id),['fast','balanced','quality']);
 const fingerprints=new Set();
 for(const preset of PRESETS){const preferences=presetPreferences(preset.id);validatePolicy(preferences);fingerprints.add(bundledReleaseInfo(preset.id).preferencesHash);for(const client of Object.values(preferences.clients))for(const role of Object.keys(ROLES))assert.ok(rolePreference(client,role));}
 assert.equal(fingerprints.size,3);assert.throws(()=>presetPreferences('../outside'),e=>e.code==='UNKNOWN_PRESET');
 assert.equal(presetPreferences('fast').clients.codex.code.effort,'low');assert.equal(presetPreferences('quality').clients.claude.code.model,'opus');
});

test('Fable is a documented Claude subagent alias with current native effort choices',()=>{
 const data=modelCatalog().clients.claude,row=data.models.find(model=>model.id==='fable');assert.ok(row);assert.equal(row.kind,'alias');assert.deepEqual(row.efforts,['low','medium','high','xhigh','max']);assert.equal(row.defaultEffort,'high');assert.match(row.source,/^https:\/\/code\.claude\.com\/docs\/en\/(?:sub-agents|model-config)/);assert.ok(!data.excluded.some(model=>model.id==='fable'));assert.deepEqual(data.excluded.map(model=>model.id),['best','default','opus[1m]','opusplan','sonnet[1m]']);
});
