import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validatePolicy} from '../src/policy.mjs';

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

for(const kind of ['code','light']) test(`Kimi ${kind} selection rejects the reserved primary pool alias`,()=>{
  const p=preferences();
  p.clients.kimi={code:{model:'kimi-code/k3',effort:'high'},light:{model:'kimi-code/kimi-for-coding',effort:'low'},avoidModels:[]};
  p.clients.kimi[kind].model='primary';
  assert.throws(()=>validatePolicy(p),{code:'INVALID_POLICY'});
});
