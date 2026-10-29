import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { detectClients, resolveClient, summarizeDetection } from '../src/detect.mjs';

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'policy-detect-')));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const hostHome = path.join(root,'host');
  const bin = path.join(root,"bin's directory");
  await fs.mkdir(hostHome); await fs.mkdir(bin);
  return {root,hostHome,bin,env:{PATH:bin}};
}
async function executable(file,body) {
  await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,`#!${process.execPath}\n${body}\n`,{mode:0o700});
}

test('config directories alone never detect a client or execute anything',async t=>{
  const f = await fixture(t);
  for (const dir of ['.codex','.claude','.kimi-code','.gemini']) await fs.mkdir(path.join(f.hostHome,dir));
  const records = await detectClients(f);
  assert.deepEqual(records.map(r=>r.status),['not_found','not_found','not_found','not_found']);
  assert.ok(records.every(r=>r.version === null && r.executable === null));
});

test('PATH detection validates branded versions and keeps path details internal',async t=>{
  const f = await fixture(t);
  const file = path.join(f.bin,'codex');
  await executable(file,'console.log("codex-cli 0.165.0");');
  const result = await resolveClient('codex',f);
  assert.deepEqual(result,{client:'codex',status:'detected',version:'0.165.0',origin:'path',executable:file});
  assert.deepEqual(summarizeDetection([result]),[{client:'codex',status:'detected',version:'0.165.0',origin:'path'}]);
  assert.ok(!JSON.stringify(summarizeDetection([result])).includes(f.root));
});

test('conventional host locations and native launcher symlinks work when PATH lacks the CLI',async t=>{
  const f = await fixture(t);
  const target = path.join(f.root,'native-launcher');
  await executable(target,'console.log("2.1.312 (Claude Code)");');
  const link = path.join(f.hostHome,'.local/bin/claude');
  await fs.mkdir(path.dirname(link),{recursive:true}); await fs.symlink(target,link);
  assert.deepEqual(await resolveClient('claude',f),{client:'claude',status:'detected',version:'2.1.312',origin:'known_location',executable:target});
  await executable(path.join(f.hostHome,'.kimi-code/bin/kimi'),'if (process.argv[2] === "--version") console.log("2.4.0"); else console.log("Kimi Code CLI\\nUsage: kimi [OPTIONS]");');
  const kimi = await resolveClient('kimi',f);
  assert.equal(kimi.status,'detected'); assert.equal(kimi.version,'2.4.0'); assert.equal(kimi.origin,'known_location');
});

test('invalid earlier candidates never hide a later real client',async t=>{
  const f = await fixture(t);
  await executable(path.join(f.bin,'codex'),'console.log("other-product 9.9.9 SECRET");');
  await executable(path.join(f.hostHome,'.local/bin/codex'),'console.log("codex-cli 0.165.0");');
  const result = await resolveClient('codex',f);
  assert.equal(result.status,'detected'); assert.equal(result.origin,'known_location');
});

test('unbranded versions require native Kimi or Antigravity help identity',async t=>{
  const f = await fixture(t);
  await executable(path.join(f.bin,'agy'),'if (process.argv[2] === "--version") console.log("1.4.10\\ncommit-string\\narm64"); else console.log("Antigravity\\nUsage: agy [options] [paths...]");');
  assert.equal((await resolveClient('agy',f)).status,'detected');
  await executable(path.join(f.bin,'kimi'),'if (process.argv[2] === "--version") console.log("2.4.0"); else console.log("Unrelated tool SECRET");');
  assert.equal((await resolveClient('kimi',f)).status,'invalid');
});

test('timeout, excessive output, failed exits and non-executable files fail without raw output',async t=>{
  const f = await fixture(t);
  await executable(path.join(f.bin,'codex'),'setInterval(()=>{},1000);');
  const timeout = await resolveClient('codex',{...f,timeoutMs:50});
  assert.equal(timeout.status,'timeout');
  await executable(path.join(f.bin,'claude'),'console.log("SECRET".repeat(20000));');
  assert.equal((await resolveClient('claude',f)).status,'invalid');
  await executable(path.join(f.bin,'kimi'),'console.log("kimi 2.4.0"); process.exitCode=1;');
  assert.equal((await resolveClient('kimi',f)).status,'invalid');
  await executable(path.join(f.bin,'agy'),'console.log("Antigravity 1.4.10");');
  await fs.chmod(path.join(f.bin,'agy'),0o600);
  assert.equal((await resolveClient('agy',f)).status,'invalid');
  assert.ok(!JSON.stringify(summarizeDetection([timeout])).includes('SECRET'));
});

test('relative PATH entries and shell metacharacters cannot invoke a command shell',async t=>{
  const f = await fixture(t);
  const hostile = path.join(f.root,'bin; touch INJECTION');
  await fs.mkdir(hostile);
  await executable(path.join(hostile,'codex'),'console.log("codex-cli 0.165.0");');
  assert.equal((await resolveClient('codex',{...f,env:{PATH:hostile}})).status,'detected');
  assert.equal((await resolveClient('codex',{...f,env:{PATH:'.'+path.delimiter}})).status,'not_found');
  await assert.rejects(fs.stat(path.join(f.root,'INJECTION')),{code:'ENOENT'});
});

test('current native Kimi and agy help signatures identify bare-semver executables',async t=>{
  const f = await fixture(t);
  await executable(path.join(f.bin,'kimi'),'if (process.argv[2] === "--version") console.log("2.4.0"); else console.log("The Starting Point for Next-Gen Agents\\nKimi Code\\nkimi provider\\nhttps://moonshotai.github.io/kimi-code/");');
  await executable(path.join(f.bin,'agy'),'if (process.argv[2] === "--version") console.log("1.4.10"); else console.log("Usage of agy:\\n--agent --model --effort\\nAvailable subcommands:\\nagent agents models plugin");');
  for (const client of ['kimi','agy']) assert.equal((await resolveClient(client,f)).status,'detected');
});

test('detection summaries allowlist all fields instead of echoing supplied paths or errors',()=>{
  const summary = summarizeDetection([{client:'codex',status:'detected',version:'/private/SECRET',origin:'/private/SECRET',executable:'/private/SECRET',stdout:'SECRET',error:'SECRET'}]);
  assert.ok(!JSON.stringify(summary).includes('SECRET'));
  assert.deepEqual(summary,[{client:'codex',status:'invalid',version:null,origin:null}]);
});

test('timed-out earlier candidates still allow a verified conventional fallback',async t=>{
  const f = await fixture(t);
  await executable(path.join(f.bin,'codex'),'setInterval(()=>{},1000);');
  await executable(path.join(f.hostHome,'.local/bin/codex'),'console.log("codex-cli 0.165.0");');
  const result = await resolveClient('codex',{...f,timeoutMs:400});
  assert.equal(result.status,'detected'); assert.equal(result.origin,'known_location');
});

test('legacy Claude native host location is checked without consulting configuration targets',async t=>{
  const f = await fixture(t);
  await executable(path.join(f.hostHome,'.claude/local/claude'),'console.log("2.1.312 (Claude Code)");');
  assert.equal((await resolveClient('claude',f)).status,'detected');
});

test('oversized semver metadata cannot disagree with the sanitized detected status',async t=>{
  const f = await fixture(t);
  await executable(path.join(f.bin,'codex'),`console.log(${JSON.stringify('codex-cli 1.2.3-'+ 'a'.repeat(64)+'+'+'b'.repeat(64))});`);
  assert.equal((await resolveClient('codex',f)).status,'invalid');
});

import { spawn } from 'node:child_process';
test('each POSIX probe cleans its own descendants on timeout, overflow and completion', {skip:process.platform === 'win32'}, async t=>{
  const unrelated=spawn(process.execPath,['-e','setInterval(()=>{},1000);'],{stdio:'ignore'});
  t.after(()=>{try{unrelated.kill('SIGKILL');}catch{}});
  for(const mode of ['timeout','overflow','complete']){
    const f=await fixture(t),pidFile=path.join(f.root,'descendant.pid');
    await executable(path.join(f.bin,'codex'),`import fs from 'node:fs';import {spawn} from 'node:child_process';const child=spawn(process.execPath,['-e','setInterval(()=>{},1000);'],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(pidFile)},String(child.pid));${mode==='complete'?'console.log("codex-cli 0.165.0");process.exit(0);':mode==='overflow'?'console.log("X".repeat(100000));setInterval(()=>{},1000);':'setInterval(()=>{},1000);'}`);
    const result=await resolveClient('codex',{...f,timeoutMs:500});
    const pid=Number(await fs.readFile(pidFile,'utf8'));
    t.after(()=>{try{process.kill(pid,'SIGKILL');}catch{}});
    assert.equal(result.status,mode==='timeout'?'timeout':mode==='complete'?'detected':'invalid');
    assert.throws(()=>process.kill(pid,0),{code:'ESRCH'},`${mode} probe leaked a descendant`);
    assert.doesNotThrow(()=>process.kill(unrelated.pid,0),'probe killed an unrelated process');
  }
});
