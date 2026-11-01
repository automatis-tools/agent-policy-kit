import test from 'node:test';
import assert from 'node:assert/strict';
import {formatResult, useJsonOutput} from '../src/output.mjs';
const context={version:'0.1.0',apply:true};
const report=results=>({status:'configured',results});
test('terminal output is readable while captured output and --json retain JSON',()=>{
 assert.equal(useJsonOutput({isTTY:true}),false);
 assert.equal(useJsonOutput({isTTY:false}),true);
 assert.equal(useJsonOutput({isTTY:true,json:true}),true);
});
test('applied and unchanged clients differ and only changed tools need a fresh session',()=>{
 const text=formatResult('setup',report([{client:'chatgpt',status:'configured',changedFiles:10,appliedPreset:'balanced'},{client:'claude',status:'unchanged'},{client:'kimi',status:'not_found'},{client:'gemini',status:'not_selected'}]),context);
 assert.match(text,/ChatGPT\s+Configuration applied/);assert.match(text,/Claude\s+Already up to date/);
 assert.match(text,/new session in ChatGPT/);assert.doesNotMatch(text,/10 files|Gemini|new session in Claude/);
 assert.match(text,/Kimi.*not installed/);assert.match(text,/model execution.*not checked/i);
});
test('unchanged setup does not claim new writes or request another session',()=>{
 const text=formatResult('setup',report([{client:'chatgpt',status:'unchanged'}]),context);
 assert.match(text,/Already up to date/);assert.doesNotMatch(text,/Configuration applied|new session/);
});
test('preview preserves zero-write semantics and recognizes empty plans',()=>{
 const text=formatResult('setup',{status:'planned',results:[{client:'chatgpt',status:'planned',plan:{files:[{}]}},{client:'claude',status:'planned',plan:{files:[]}}]},{...context,apply:false});
 assert.match(text,/Preview.*no files changed/);assert.match(text,/ChatGPT\s+Would configure/);assert.match(text,/Claude\s+Already up to date/);assert.doesNotMatch(text,/new session|Configuration applied/);
});
test('partial setup retains successful clients and explains blockers without duplicating them',()=>{
 const text=formatResult('setup',{status:'partial',results:[{client:'chatgpt',status:'configured'},{client:'claude',status:'error',error:'OWNED_DRIFT'},{client:'kimi',status:'prerequisite',plan:{warnings:['kimi-provisioned-models-required']}}]},context);
 assert.match(text,/Setup incomplete/);assert.match(text,/ChatGPT\s+Configuration applied/);assert.match(text,/local edits/i);assert.match(text,/model aliases/i);assert.match(text,/OWNED_DRIFT/);
});
test('errors and informational native limitations remain bounded and are not fake blockers',()=>{
 const text=formatResult('setup',report([{client:'chatgpt',status:'configured',warnings:['chatgpt-native-precedence-limits']}]),context);
 assert.doesNotMatch(text,/incomplete|Action required|codex-native-precedence-limits/);assert.match(text,/override/i);
 assert.equal(formatResult('setup',{error:'BAD\nPRIVATE_SECRET'},context).includes('PRIVATE_SECRET'),false);
});
test('uninstall preview and completed removal are distinct',()=>{
 const plan={client:'chatgpt',status:'planned',files:[{}],warnings:[]};
 assert.match(formatResult('uninstall',plan,{...context,apply:false}),/Would remove/);
 assert.match(formatResult('uninstall',{client:'chatgpt',status:'applied'},context),/Configuration removed/);
});
test('show distinguishes user configuration, inherited effort and guidance from execution',()=>{
 const text=formatResult('show',{scope:'user',clients:{chatgpt:{status:'configured',defaults:{model:null,effort:null,enabled:false},concurrency:{value:5,kind:'native_setting'},roles:[{name:'reviewer',model:'custom/model',effort:null}],pool:[],warnings:[],apk:{status:'not_configured'}},kimi:{status:'configured',defaults:{model:null,effort:null},concurrency:{value:4,kind:'guidance'},roles:[],pool:[],warnings:[],apk:{status:'not_configured'}}}},context);
 assert.match(text,/User configuration/);assert.match(text,/reviewer.*custom\/model.*native default/);assert.match(text,/disabled/);assert.match(text,/4.*guidance/);assert.match(text,/execution.*not checked/);
});
test('show labels delegation-disabled Gemini roles explicitly',()=>{
 const text=formatResult('show',{clients:{gemini:{status:'configured',defaults:{model:null,effort:null},concurrency:{value:null,kind:'guidance'},roles:[{name:'primary-only',model:'pro',effort:null,enabled:false}],pool:[],warnings:[],apk:{status:'not_configured'}}}},context);assert.match(text,/primary-only.*delegation disabled/);
});
test('terminal output names presets with the configurator labels',()=>{
 for(const [id,label]of [['fast','Light'],['balanced','Standard'],['quality','Top-tier']]){
  const text=formatResult('setup',report([{client:'chatgpt',status:'configured',appliedPreset:id}]),context);
  assert.match(text,new RegExp(`Configuration applied · ${label}`));assert.doesNotMatch(text,/· (?:Fast|Balanced|Quality)\b/);
 }
});
