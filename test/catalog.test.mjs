import fs from 'node:fs';
import test from 'node:test';import assert from 'node:assert/strict';
import {modelCatalog,presetPreferences,PRESETS,bundledReleaseInfo} from '../src/release.mjs';
import {validatePolicy,rolePreference,ROLES} from '../src/policy.mjs';

test('release catalog carries dated sourced native selectors and compatible efforts',()=>{
 const catalog=modelCatalog();assert.match(catalog.reviewedAt,/^\d{4}-\d\d-\d\d$/);
 assert.equal(catalog.clients.chatgpt.models.length,9);assert.equal(catalog.clients.kimi.models.length,6);assert.equal(catalog.clients.gemini.label,'Gemini');
 for(const [client,data]of Object.entries(catalog.clients)){
  assert.equal(new Set(data.models.map(m=>m.id)).size,data.models.length);
  for(const model of data.models){assert.match(model.source,/^https:\/\//);assert.ok(model.efforts.every(e=>data.efforts.includes(e)),client);assert.ok(model.defaultEffort===null||model.efforts.includes(model.defaultEffort));}
 }
 assert.deepEqual(catalog.clients.gemini.models.map(m=>m.id),['pro','flash','flash_lite','inherit']);
 assert.ok(catalog.clients.claude.models.some(m=>m.id==='claude-haiku-5-5'));
});

test('Grok Build inventory lists documented xAI models without per-role effort',()=>{
 const grok=modelCatalog().clients.grok;
 assert.equal(grok.label,'Grok');assert.deepEqual(grok.efforts,[]);assert.deepEqual(grok.models.map(m=>m.id),['grok-4.7','grok-4.6','grok-4.5','grok-build-0.1']);
 for(const model of grok.models){assert.deepEqual(model.efforts,[]);assert.equal(model.defaultEffort,null);assert.equal(model.source,'https://docs.x.ai/developers/models');assert.match(model.nativeSource,/^https:\/\/github\.com\/xai-org\/grok-build\//);}
 assert.ok(!('grok' in PRESETS.find(preset=>preset.id==='quality').topModels));
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
 assert.deepEqual(quality.code,{model:'kimi-code/k3',effort:'high'});assert.deepEqual(rolePreference(quality,'explorer'),{model:'kimi-code/k3',effort:'high'});
});

test('presets name how much of the plan subagents use and top models stay an explicit Top-tier opt-in',()=>{
 assert.deepEqual(PRESETS.map(preset=>[preset.id,preset.label]),[['fast','Light'],['balanced','Standard'],['quality','Top-tier']]);
 for(const preset of PRESETS)assert.ok(preset.description.length<=70,preset.id);
 const top={chatgpt:{model:'gpt-6-astra',effort:'high'},claude:{model:'claude-opus-5-5',effort:'xhigh'},kimi:{model:'kimi-code/k3.1-pro',effort:'high'}},catalog=modelCatalog().clients;
 assert.deepEqual(PRESETS.find(preset=>preset.id==='quality').topModels,top);
 assert.ok(PRESETS.filter(preset=>preset.id!=='quality').every(preset=>preset.topModels===undefined));
 for(const [client,choice] of Object.entries(top))assert.ok(catalog[client].models.find(entry=>entry.id===choice.model)?.efforts.includes(choice.effort),client);
 // Native default subagent settings copy the Coder choice, so no slider position may silently select a top choice.
 for(const id of ['fast','balanced','quality'])for(const [client,config] of Object.entries(presetPreferences(id).clients))for(const role of Object.keys(ROLES))assert.notDeepEqual(rolePreference(config,role),top[client]??null,`${id} ${client} ${role}`);
 const quality=presetPreferences('quality').clients;
 for(const [client,model] of [['chatgpt','gpt-6.1-sol'],['claude','claude-opus-5-5'],['kimi','kimi-code/k3']])
  for(const role of ['worker','reviewer','tester'])assert.deepEqual(rolePreference(quality[client],role),{model,effort:'high'},`${client} ${role}`);
});

test('native effort choices stay separate from API-only capabilities and delegation modes',()=>{
 const catalog=modelCatalog(),sol=catalog.clients.chatgpt.models.find(model=>model.id==='gpt-6.1-sol');
 assert.equal(sol.defaultEffort,'low');assert.equal(sol.apiDefaultEffort,'medium');assert.deepEqual(sol.delegationModes,['ultra']);
 const luna=catalog.clients.chatgpt.models.find(model=>model.id==='gpt-6-luna');
 assert.ok(luna.apiEfforts.includes('none'));assert.ok(!luna.efforts.includes('none'));
 for(const model of catalog.clients.chatgpt.models){assert.ok(!model.efforts.includes('ultra'));assert.ok(model.efforts.every(level=>model.apiEfforts.includes(level)));}
 const legacy=catalog.clients.claude.models.find(model=>model.id==='claude-opus-4-5-20251101');
 assert.deepEqual(legacy.efforts,[]);assert.deepEqual(legacy.apiEfforts,['low','medium','high']);
 const policy=structuredClone(presetPreferences('balanced'));
 policy.clients.chatgpt.code={model:'gpt-6-luna',effort:'none'};assert.throws(()=>validatePolicy(policy));
 policy.clients.chatgpt.code={model:'gpt-6-luna',effort:'high'};
 policy.clients.claude.code={model:legacy.id,effort:'high'};assert.throws(()=>validatePolicy(policy));
 policy.clients.claude.code.effort=null;assert.doesNotThrow(()=>validatePolicy(policy));
});
test('three named presets are valid editable recommendations from the same package release',()=>{
 assert.deepEqual(PRESETS.map(p=>p.id),['fast','balanced','quality']);
 const fingerprints=new Set();
 for(const preset of PRESETS){const preferences=presetPreferences(preset.id);validatePolicy(preferences);fingerprints.add(bundledReleaseInfo(preset.id).preferencesHash);for(const client of Object.values(preferences.clients))for(const role of Object.keys(ROLES))assert.ok(rolePreference(client,role));}
 assert.equal(fingerprints.size,3);assert.throws(()=>presetPreferences('../outside'),e=>e.code==='UNKNOWN_PRESET');
 assert.equal(presetPreferences('fast').clients.chatgpt.code.model,'gpt-6-luna');assert.equal(presetPreferences('quality').clients.claude.code.model,'claude-opus-5-5');
});

test('Fable is a documented Claude subagent alias with current native effort choices',()=>{
 const data=modelCatalog().clients.claude,row=data.models.find(model=>model.id==='fable');assert.ok(row);assert.equal(row.kind,'alias');assert.deepEqual(row.efforts,['low','medium','high','xhigh','max']);assert.equal(row.defaultEffort,'high');assert.match(row.source,/^https:\/\/code\.claude\.com\/docs\/en\/(?:sub-agents|model-config)/);assert.ok(!data.excluded.some(model=>model.id==='fable'));assert.deepEqual(data.excluded.map(model=>model.id),['best','default','opus[1m]','opusplan','sonnet[1m]']);
});

test('public recommendations never carry personal model bans',()=>{
 for(const preset of PRESETS)for(const [client,config]of Object.entries(presetPreferences(preset.id).clients))assert.deepEqual(config.avoidModels,[],`${preset.id}/${client} must leave model choice open`);
});
test('Top-tier offers stronger choices for demanding implementation and review only as an opt-in',()=>{
 const quality=presetPreferences('quality'),top=PRESETS.find(preset=>preset.id==='quality').topModels;
 assert.equal(top.chatgpt.model,'gpt-6-astra');
 // Anthropic's own benchmarks put Opus 5.5 ahead of Fable 5.1, so Claude's top choice is more reasoning on the same model.
 assert.deepEqual(top.claude,{model:'claude-opus-5-5',effort:'xhigh'});
 for(const role of ['worker','reviewer']){
  assert.equal(rolePreference(quality.clients.chatgpt,role).model,'gpt-6.1-sol');
  assert.equal(rolePreference(quality.clients.claude,role).model,'claude-opus-5-5');
 }
 assert.notEqual(rolePreference(quality.clients.chatgpt,'routine').model,'gpt-6-astra');
 assert.notDeepEqual(rolePreference(quality.clients.claude,'routine'),top.claude);
 // Discovery and docs keep the Top-tier model at medium; verification roles keep high.
 for(const client of ['chatgpt','claude'])for(const role of ['explorer','writer'])assert.equal(rolePreference(quality.clients[client],role).effort,'medium',`${client} ${role}`);
});

test('Grok presets use the fast coding model for light work and Grok 4.7 for stronger roles',()=>{
 const fast='grok-build-0.1',strong='grok-4.7',expected={
  fast:{worker:fast,reviewer:fast,explorer:fast,tester:fast,writer:fast,routine:fast},
  balanced:{worker:strong,reviewer:strong,explorer:fast,tester:strong,writer:strong,routine:fast},
  quality:{worker:strong,reviewer:strong,explorer:strong,tester:strong,writer:strong,routine:fast}};
 for(const [id,roles]of Object.entries(expected)){
  const grok=presetPreferences(id).clients.grok;assert.equal(grok.maxConcurrent,undefined,id);
  for(const [role,model]of Object.entries(roles))assert.deepEqual(rolePreference(grok,role),{model,effort:null},`${id} ${role}`);
 }
 assert.ok(modelCatalog().clients.grok.models.some(model=>model.id===fast&&model.efforts.length===0));
});

test('docs preset tables match the preset data in every cell',()=>{
 const doc=fs.readFileSync(new URL('../docs/reference/presets.md',import.meta.url),'utf8').split('\n'),catalog=modelCatalog().clients;
 const roleIds={'Coder':'worker','Reviewer':'reviewer','Code explorer':'explorer','Test writer':'tester','Docs writer':'writer','Task runner':'routine'};
 const norm=value=>value.replace(/GPT-6(?:\.1)? /,'').replace('K3 · 256K','K3 256K').replace(/\s+/g,' ').trim();
 for(const preset of PRESETS){
  const start=doc.indexOf('### '+preset.label),preferences=presetPreferences(preset.id);assert.ok(start>0,preset.label);
  const header=doc.slice(start).find(line=>line.startsWith('| Role |')).split('|').slice(2,-1).map(title=>title.trim());
  const clients=header.map(title=>Object.keys(catalog).find(id=>title===catalog[id].label||title.startsWith(catalog[id].label+' ')));
  assert.deepEqual([...clients].sort(),Object.keys(preferences.clients).sort(),preset.label);
  let rows=0;
  for(const line of doc.slice(start+1)){
   if(line.startsWith('#'))break;
   const match=line.match(/^\| (Coder|Reviewer|Code explorer|Test writer|Docs writer|Task runner) \|(.*)\|$/);if(!match)continue;rows++;
   match[2].split('|').map(cell=>cell.trim()).forEach((cell,index)=>{
    const client=clients[index],choice=rolePreference(preferences.clients[client],roleIds[match[1]]),label=catalog[client].models.find(model=>model.id===choice.model).label;
    assert.equal(norm(cell),norm(label+(choice.effort?' · '+choice.effort:'')),`${preset.label} ${match[1]} ${client}`);
   });
  }
  assert.equal(rows,6,preset.label);
 }
});

test('Standard Claude Coder runs Sonnet 5.5 at high and keeps the preset canonical (#29)',()=>{
 const claude=presetPreferences('balanced').clients.claude,sonnet=effort=>({model:'claude-sonnet-5-5',effort}),haiku=effort=>({model:'claude-haiku-5-5',effort});
 const expected={worker:sonnet('high'),reviewer:sonnet('high'),explorer:haiku('medium'),tester:sonnet('high'),writer:sonnet('medium'),routine:haiku('low')};
 for(const [role,choice]of Object.entries(expected))assert.deepEqual(rolePreference(claude,role),choice,role);
 assert.deepEqual(claude.code,sonnet('high'));assert.deepEqual(claude.light,haiku('low'));
 // Overrides equal to the code or light fallback are dropped by the configurator, so the file must not carry them.
 assert.deepEqual(Object.keys(claude.roles).sort(),['explorer','writer']);
});

test('Claude 4.5 lifecycle records what is true before the Sonnet 4.5 retirement (#28)',()=>{
 const models=modelCatalog().clients.claude.models,find=id=>models.find(model=>model.id===id);
 for(const model of models)if(model.lifecycle)assert.ok(['active','deprecated'].includes(model.lifecycle.status),model.id);
 const sonnet=find('claude-sonnet-4-5-20250929');
 assert.equal(sonnet.label,'Sonnet 4.5 (retires 2026-11-30)');
 assert.equal(sonnet.lifecycle.status,'deprecated');assert.equal(sonnet.lifecycle.deprecationDate,'2026-09-30');
 assert.equal(sonnet.lifecycle.retirementDate,'2026-11-30');assert.equal(sonnet.lifecycle.replacement,'claude-sonnet-5-5');
 assert.ok(find(sonnet.lifecycle.replacement),'the replacement is in the catalog');
 for(const platform of ['Claude API','Claude Platform on AWS','Anthropic managed','Microsoft Foundry'])assert.ok(sonnet.lifecycle.scope.includes(platform),platform);
 const partner=(model,platform)=>model.lifecycle.partners.find(entry=>entry.platform===platform);
 assert.deepEqual({...partner(sonnet,'Amazon Bedrock'),source:undefined},{platform:'Amazon Bedrock',status:'legacy',endOfLife:'2027-04-08',source:undefined});
 const google=partner(sonnet,'Google Cloud (Google managed)');assert.equal(google.retirementDate,undefined);assert.match(google.note,/no retirement date/i);
 const opus=find('claude-opus-4-5-20251101');assert.ok(!find('claude-opus-4-5-20251001'));
 assert.equal(opus.lifecycle.status,'active');assert.equal(opus.lifecycle.earliestRetirement,'2026-11-24');assert.match(opus.lifecycle.note,/legacy.*no deprecation notice/i);
 const haiku=find('claude-haiku-4-5-20251001');
 assert.equal(haiku.lifecycle.status,'active');assert.equal(haiku.lifecycle.earliestRetirement,'2026-10-15');
 assert.equal(partner(haiku,'Google Cloud (Google managed)').earliestRetirement,'2026-12-07');
 for(const model of [sonnet,opus,haiku]){assert.match(model.lifecycle.source,/^https:\/\//);for(const entry of model.lifecycle.partners??[])assert.match(entry.source,/^https:\/\//,model.id);}
});
