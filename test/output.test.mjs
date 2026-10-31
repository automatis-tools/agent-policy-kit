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
 const text=formatResult('setup',report([{client:'codex',status:'configured',changedFiles:10,appliedPreset:'balanced'},{client:'claude',status:'unchanged'},{client:'kimi',status:'not_found'},{client:'agy',status:'not_selected'}]),context);
 assert.match(text,/Codex\s+Configuration applied/);assert.match(text,/Claude Code\s+Already up to date/);
 assert.match(text,/new session in Codex/);assert.doesNotMatch(text,/10 files|Antigravity|new session in Claude/);
 assert.match(text,/Kimi.*not installed/);assert.match(text,/model execution.*not checked/i);
});
test('unchanged setup does not claim new writes or request another session',()=>{
 const text=formatResult('setup',report([{client:'codex',status:'unchanged'}]),context);
 assert.match(text,/Already up to date/);assert.doesNotMatch(text,/Configuration applied|new session/);
});
test('preview preserves zero-write semantics and recognizes empty plans',()=>{
 const text=formatResult('setup',{status:'planned',results:[{client:'codex',status:'planned',plan:{files:[{}]}},{client:'claude',status:'planned',plan:{files:[]}}]},{...context,apply:false});
 assert.match(text,/Preview.*no files changed/);assert.match(text,/Codex\s+Would configure/);assert.match(text,/Claude Code\s+Already up to date/);assert.doesNotMatch(text,/new session|Configuration applied/);
});
test('partial setup retains successful clients and explains blockers without duplicating them',()=>{
 const text=formatResult('setup',{status:'partial',results:[{client:'codex',status:'configured'},{client:'claude',status:'error',error:'OWNED_DRIFT'},{client:'kimi',status:'prerequisite',plan:{warnings:['kimi-provisioned-models-required']}}]},context);
 assert.match(text,/Setup incomplete/);assert.match(text,/Codex\s+Configuration applied/);assert.match(text,/local edits/i);assert.match(text,/model aliases/i);assert.match(text,/OWNED_DRIFT/);
});
test('errors and informational native limitations remain bounded and are not fake blockers',()=>{
 const text=formatResult('setup',report([{client:'codex',status:'configured',warnings:['codex-native-precedence-limits']}]),context);
 assert.doesNotMatch(text,/incomplete|Action required|codex-native-precedence-limits/);assert.match(text,/override/i);
 assert.equal(formatResult('setup',{error:'BAD\nPRIVATE_SECRET'},context).includes('PRIVATE_SECRET'),false);
});
test('uninstall preview and completed removal are distinct',()=>{
 const plan={client:'codex',status:'planned',files:[{}],warnings:[]};
 assert.match(formatResult('uninstall',plan,{...context,apply:false}),/Would remove/);
 assert.match(formatResult('uninstall',{client:'codex',status:'applied'},context),/Configuration removed/);
});
