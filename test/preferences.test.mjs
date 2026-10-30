import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validatePolicy,rolePreference} from '../src/policy.mjs';

const preferences = () => ({schemaVersion:1,maxConcurrent:3,clients:{codex:{
  code:{model:'gpt-6.1-sol',effort:'high'},light:{model:'gpt-6-luna',effort:'high'},avoidModels:['gpt-6-astra'],
}}});
test('shared preferences express code/light models and one concurrency target without runtime modes', () => {
  const source=preferences(), parsed=validatePolicy(source);
  assert.deepEqual(parsed,source); assert.ok(Object.isFrozen(parsed.clients.codex.code));
  source.clients.codex.code.model='changed'; assert.equal(parsed.clients.codex.code.model,'gpt-6.1-sol');
});
test('legacy runtime policy and unknown fields are rejected', () => {
  for (const patch of [{mode:'enforce'},{hooks:[]},{audit:{}},{runtime:'proxy'}]) assert.throws(()=>validatePolicy({...preferences(),...patch}));
  assert.throws(()=>validatePolicy({...preferences(),maxConcurrent:0}));
  assert.throws(()=>validatePolicy({...preferences(),maxConcurrent:33}));
});
test('invalid model efforts, contradictory preferences and untrusted objects fail safely', () => {
  const bad=preferences(); bad.clients.codex.code.effort='ultra';assert.throws(()=>validatePolicy(bad));
  bad.clients.codex.code.effort='high';bad.clients.codex.avoidModels.push('gpt-6.1-sol');assert.throws(()=>validatePolicy(bad));
  const accessors=preferences();Object.defineProperty(accessors.clients.codex.code,'model',{get(){throw new Error('private');},enumerable:true});
  assert.throws(()=>validatePolicy(accessors), e=>!e.message.includes('private'));
});
test('agy preferences use native tiers without fabricated per-role effort', () => {
  const p=preferences();p.clients.agy={code:{model:'pro',effort:null},light:{model:'flash',effort:null},avoidModels:[]};
  assert.equal(validatePolicy(p).clients.agy.code.model,'pro');
  p.clients.agy.code.effort='high';assert.throws(()=>validatePolicy(p));
});
test('the bundled preset uses the same shared preference contract', () => {
  const p=validatePolicy(JSON.parse(fs.readFileSync(new URL('../policies/balanced.json',import.meta.url))));
  assert.equal(p.maxConcurrent,3);assert.equal(Object.keys(p.clients).length,4);
});

test('individual task choices override recommendations without changing other roles',()=>{
  const p=preferences();p.clients.codex.roles={reviewer:{model:'review-model',effort:'medium'}};
  const config=validatePolicy(p).clients.codex;
  assert.equal(rolePreference(config,'reviewer').model,'review-model');
  assert.equal(rolePreference(config,'worker').model,'gpt-6.1-sol');
  assert.equal(rolePreference(config,'explorer').model,'gpt-6-luna');
  assert.throws(()=>validatePolicy({...p,clients:{codex:{...p.clients.codex,roles:{unknown:{model:'x',effort:'high'}}}}}));
});
test('Kimi effort consistency concerns effective task choices rather than unused recommendations',()=>{
  const client={code:{model:'native/k3',effort:'high'},light:{model:'native/light',effort:'low'},avoidModels:[],
    roles:Object.fromEntries(['worker','reviewer','explorer','routine'].map(role=>[role,{model:'native/k3',effort:'low'}]))};
  const p={schemaVersion:1,maxConcurrent:3,clients:{kimi:client}};
  assert.equal(rolePreference(validatePolicy(p).clients.kimi,'worker').effort,'low');
  client.roles.reviewer.effort='high';assert.throws(()=>validatePolicy(p));
});

test('native-default effort and documented expanded levels remain model-specific',()=>{
  const p=preferences();p.clients.codex.code.effort='max';assert.doesNotThrow(()=>validatePolicy(p));
  p.clients.codex.code.effort='none';assert.throws(()=>validatePolicy(p));
  p.clients.codex.code.effort=null;assert.equal(validatePolicy(p).clients.codex.code.effort,null);
  p.clients.claude={code:{model:'claude-haiku-4-5-20251001',effort:null},light:{model:'haiku',effort:'max'},avoidModels:[]};
  assert.doesNotThrow(()=>validatePolicy(p));p.clients.claude.code.effort='high';assert.throws(()=>validatePolicy(p));
});
test('Kimi native-default requests can share an alias with one explicit effort',()=>{
  const p={schemaVersion:1,maxConcurrent:3,clients:{kimi:{code:{model:'native/k3',effort:'max'},light:{model:'native/k3',effort:null},avoidModels:[]}}};
  assert.doesNotThrow(()=>validatePolicy(p));
  p.clients.kimi.light.effort='high';assert.throws(()=>validatePolicy(p));
});

for(const kind of ['code','light']) test(`Kimi ${kind} selection rejects the reserved primary pool alias`,()=>{
  const p=preferences();
  p.clients.kimi={code:{model:'kimi-code/k3',effort:'high'},light:{model:'kimi-code/kimi-for-coding',effort:'low'},avoidModels:[]};
  p.clients.kimi[kind].model='primary';
  assert.throws(()=>validatePolicy(p),{code:'INVALID_POLICY'});
});

test('Google dated provider model IDs are bounded identifiers with native-default effort',()=>{
 const model='claude-sonnet-4-5@20250929',p=preferences();p.clients.claude={code:{model,effort:null},light:{model:'haiku',effort:null},avoidModels:[]};assert.equal(validatePolicy(p).clients.claude.code.model,model);const schema=JSON.parse(fs.readFileSync(new URL('../schema/policy.schema.json',import.meta.url))),identifier=new RegExp(schema.$defs.identifier.pattern);assert.ok(identifier.test(model));for(const invalid of ['@model',model+' whitespace',model+';id','a'.repeat(129),'$(id)']){p.clients.claude.code.model=invalid;assert.throws(()=>validatePolicy(p),{code:'INVALID_POLICY'});assert.equal(identifier.test(invalid),false);}
});
