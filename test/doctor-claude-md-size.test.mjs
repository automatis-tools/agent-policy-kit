import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {oversizedClaudeInstructions} from '../src/inspect.mjs';
import {planInstall,applyInstall} from '../src/install.mjs';
import {formatResult} from '../src/output.mjs';

const bin=fileURLToPath(new URL('../bin/agent-policy.mjs',import.meta.url));
const skipOnWindows=process.platform==='win32';
const text=(count,end='\n')=>Array.from({length:count},(_,i)=>`line ${i}`).join(end)+end;
function fixture(t){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'apk-doctor-size-')));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const home=path.join(root,'home'),project=path.join(root,'project');
 fs.mkdirSync(path.join(home,'.claude'),{recursive:true});fs.mkdirSync(project);
 return {root,home,project,user:path.join(home,'.claude/CLAUDE.md'),local:path.join(project,'CLAUDE.md')};
}
const scan=(f,extra={})=>oversizedClaudeInstructions({home:f.home,cwd:f.project,env:{},...extra});
function cli(f,args,cwd=f.project){
 return spawnSync(process.execPath,[bin,'doctor','--home',f.home,'--state-dir',path.join(f.home,'.agent-policy-kit'),...args,'--json'],{cwd,encoding:'utf8',timeout:60000,env:{HOME:f.home,USERPROFILE:f.home,TMPDIR:f.root,PATH:path.dirname(process.execPath)}});
}
function tree(dir){
 const out={};
 for(const entry of fs.readdirSync(dir,{withFileTypes:true,recursive:true})){
  const file=path.join(entry.parentPath,entry.name);
  out[path.relative(dir,file)]=entry.isFile()?fs.readFileSync(file,'utf8'):entry.isDirectory()?'dir':'other';
 }
 return out;
}

test('a file warns only above 200 lines and the count ignores the final line break',async t=>{
 const f=fixture(t);
 assert.deepEqual(await scan(f),[],'missing files give no warning');
 for(const[body,lines]of [[text(201),201],[text(201).slice(0,-1),201],[text(201,'\r\n'),201],[text(400),400]]){
  fs.writeFileSync(f.user,body);
  assert.deepEqual(await scan(f),[{file:'user',lines}]);
 }
 for(const body of [text(200),text(200).slice(0,-1),text(200,'\r\n'),text(1),'']){
  fs.writeFileSync(f.user,body);
  assert.deepEqual(await scan(f),[]);
 }
});

test('the user and project files are labelled separately and carry no path or content',async t=>{
 const f=fixture(t);
 fs.writeFileSync(f.local,text(250));
 assert.deepEqual(await scan(f),[{file:'project',lines:250}]);
 fs.writeFileSync(f.user,text(300));
 const report=await scan(f);
 assert.deepEqual(report,[{file:'user',lines:300},{file:'project',lines:250}]);
 assert.doesNotMatch(JSON.stringify(report),/home|project\/|line 0/);
});

test('files that cannot be counted give no warning and no failure',{skip:skipOnWindows},async t=>{
 const f=fixture(t);
 fs.mkdirSync(f.user);
 assert.equal(spawnSync('mkfifo',[f.local]).status,0);
 assert.ok(fs.lstatSync(f.local).isFIFO());
 assert.deepEqual(await scan(f),[],'a directory and a named pipe are skipped without blocking');
 fs.rmSync(f.user,{recursive:true});fs.rmSync(f.local);
 fs.symlinkSync(path.join(f.root,'absent'),f.user);
 assert.deepEqual(await scan(f),[],'a dangling link is skipped');
 fs.rmSync(f.user);
 fs.writeFileSync(f.user,text(300));
 if(process.getuid?.()!==0){
  fs.chmodSync(f.user,0o000);
  assert.deepEqual(await scan(f),[],'an unreadable file is skipped');
  fs.chmodSync(f.user,0o600);
 }
 fs.truncateSync(f.user,16*1024*1024+1);
 assert.deepEqual(await scan(f),[],'a file above the read limit is skipped');
});

test('a symlinked file is counted and one file is reported once',{skip:skipOnWindows},async t=>{
 const f=fixture(t),shared=path.join(f.root,'shared.md');
 fs.writeFileSync(shared,text(220));fs.symlinkSync(shared,f.local);
 assert.deepEqual(await scan(f),[{file:'project',lines:220}]);
 fs.symlinkSync(shared,f.user);
 assert.deepEqual(await scan(f),[{file:'user',lines:220}],'the same file through two links is one warning');
 fs.rmSync(f.user);fs.rmSync(f.local);
 fs.writeFileSync(f.user,text(220));
 assert.deepEqual(await scan(f,{cwd:path.dirname(f.user)}),[{file:'user',lines:220}],'the Claude folder as the current directory is one warning');
});

test('the active Claude folder is used unless --home selects one',async t=>{
 const f=fixture(t),other=path.join(f.root,'profile');
 fs.mkdirSync(other);fs.writeFileSync(path.join(other,'CLAUDE.md'),text(210));fs.writeFileSync(f.user,text(205));
 assert.deepEqual(await scan(f,{env:{CLAUDE_CONFIG_DIR:other}}),[{file:'user',lines:210}]);
 assert.deepEqual(await scan(f,{env:{CLAUDE_CONFIG_DIR:other},explicitHome:true}),[{file:'user',lines:205}]);
 assert.deepEqual(await scan(f,{env:{CLAUDE_CONFIG_DIR:''}}),[{file:'user',lines:205}]);
});

test('doctor text names the file by label and adds nothing when sizes are fine',()=>{
 const result=files=>({clients:{claude:{configuration:{status:'not_configured'},...(files===undefined?{}:{oversizedInstructionFiles:files})}}});
 const shown=formatResult('doctor',result([{file:'user',lines:300},{file:'project',lines:201}]),{version:'1.2.3'});
 assert.match(shown,/! Claude\s+user CLAUDE\.md has 300 lines \(over 200\)/);
 assert.match(shown,/! Claude\s+project CLAUDE\.md has 201 lines \(over 200\)/);
 for(const files of [[],undefined])assert.doesNotMatch(formatResult('doctor',result(files),{version:'1.2.3'}),/CLAUDE\.md/);
});

test('CLI doctor reports the sizes without changing its status, files or receipts',async t=>{
 const f=fixture(t),stateDir=path.join(f.home,'.agent-policy-kit'),policyPath=path.join(f.root,'policy.json');
 fs.writeFileSync(policyPath,JSON.stringify({schemaVersion:1,maxConcurrent:3,clients:{claude:{code:{model:'claude-opus-5-5',effort:'high'},light:{model:'claude-haiku-5-5',effort:null},avoidModels:[]}}}));
 await applyInstall(await planInstall({client:'claude',home:f.home,stateDir,policyPath}));
 assert.equal(JSON.parse(cli(f,['--client','claude']).stdout).clients.claude.configuration.status,'verified');
 fs.appendFileSync(f.user,text(250));fs.writeFileSync(f.local,text(201));
 const before=[tree(f.home),tree(f.project)];
 const got=cli(f,['--client','claude']),report=JSON.parse(got.stdout);
 assert.equal(got.status,0);
 assert.deepEqual(report.clients.claude.oversizedInstructionFiles.map(entry=>entry.file),['user','project']);
 assert.equal(report.clients.claude.oversizedInstructionFiles[1].lines,201);
 assert.ok(report.clients.claude.oversizedInstructionFiles[0].lines>250);
 assert.ok(!got.stdout.includes(f.root),'no path reaches the output');
 assert.deepEqual([tree(f.home),tree(f.project)],before,'doctor writes nothing');
 const receipt=fs.readFileSync(path.join(stateDir,'installations/claude.json'),'utf8');
 assert.doesNotMatch(receipt,/oversized|"lines"/);
});

test('CLI doctor keeps the size check on Claude',t=>{
 const f=fixture(t);
 fs.writeFileSync(f.local,text(300));
 const other=cli(f,['--client','chatgpt']);
 assert.equal(other.status,0);
 assert.equal(Object.hasOwn(JSON.parse(other.stdout).clients.chatgpt,'oversizedInstructionFiles'),false);
 const clean=fixture(t),none=cli(clean,['--client','claude']);
 assert.equal(none.status,0);
 assert.deepEqual(JSON.parse(none.stdout).clients.claude.oversizedInstructionFiles,[]);
});

test('CLI doctor survives a removed current directory',{skip:skipOnWindows},t=>{
 const f=fixture(t);
 const gone=path.join(f.root,'gone');fs.mkdirSync(gone);
 const shell=`cd "$GONE" && rmdir "$GONE" && exec "$NODE" "$BIN" doctor --client claude --home "$HOME" --state-dir "$HOME/.agent-policy-kit" --json`;
 const removed=spawnSync('/bin/sh',['-c',shell],{encoding:'utf8',timeout:60000,env:{GONE:gone,NODE:process.execPath,BIN:bin,HOME:f.home,TMPDIR:f.root,PATH:['/usr/bin','/bin',path.dirname(process.execPath)].join(path.delimiter)}});
 assert.equal(removed.status,0,removed.stderr);
 assert.deepEqual(JSON.parse(removed.stdout).clients.claude.oversizedInstructionFiles,[]);
});
