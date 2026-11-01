import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const hook=fileURLToPath(new URL('../.githooks/pre-push',import.meta.url));
const zero='0'.repeat(40),sha='1'.repeat(40);

function fixture(t,{modules=true}={}){
 const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'apk-pre-push-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const repo=path.join(dir,'repo'),bin=path.join(dir,'bin'),log=path.join(dir,'npm.log');fs.mkdirSync(path.join(repo,'nested'),{recursive:true});fs.mkdirSync(bin);
 assert.equal(spawnSync('git',['init','-q',repo]).status,0);
 if(modules)fs.mkdirSync(path.join(repo,'node_modules'));
 fs.writeFileSync(path.join(bin,'npm'),`#!/bin/sh\nprintf '%s|%s\\n' "$PWD" "$*" >> ${JSON.stringify(log)}\n[ "$*" = "\${FAKE_NPM_FAIL:-}" ] && exit 3\nexit 0\n`,{mode:0o700});
 const base=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GIT_')));
 const run=(input,env={})=>spawnSync(hook,['origin','git@example.invalid:repo.git'],{cwd:path.join(repo,'nested'),input,encoding:'utf8',env:{...base,PATH:bin+path.delimiter+process.env.PATH,...env}});
 const calls=()=>fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n'):[];
 return {repo:fs.realpathSync(repo),run,calls};
}

test('pre-push hook is an executable contributor file outside the published package',()=>{
 assert.ok(fs.statSync(hook).mode&0o111,'hook must be executable');
 const files=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url))).files;
 assert.ok(!files.some(entry=>entry.startsWith('.githooks')));
});

test('pre-push hook runs the repository check and unit tests from the top level for branch updates',t=>{
 const f=fixture(t);const got=f.run(`refs/heads/x ${sha} refs/heads/x ${zero}\n`);
 assert.equal(got.status,0,got.stderr);assert.deepEqual(f.calls(),[`${f.repo}|run --silent check`,`${f.repo}|run --silent test:unit`]);
});

test('pre-push hook blocks the push when the check or the unit tests fail',t=>{
 const f=fixture(t);
 let got=f.run(`refs/heads/x ${sha} refs/heads/x ${sha}\n`,{FAKE_NPM_FAIL:'run --silent check'});
 assert.equal(got.status,3);assert.deepEqual(f.calls(),[`${f.repo}|run --silent check`],'a failed check must stop before the tests');
 got=f.run(`refs/heads/x ${sha} refs/heads/x ${sha}\n`,{FAKE_NPM_FAIL:'run --silent test:unit'});
 assert.equal(got.status,3);assert.equal(f.calls().length,3);
});

test('pre-push hook skips checks when every pushed ref is a deletion or nothing is pushed',t=>{
 const f=fixture(t);
 for(const input of [`(delete) ${zero} refs/heads/old ${sha}\n(delete) ${'0'.repeat(64)} refs/heads/older ${sha}\n`,'']){const got=f.run(input);assert.equal(got.status,0,got.stderr);}
 assert.deepEqual(f.calls(),[]);
});

test('pre-push hook hides the repository from checks when git pushes from a linked worktree',t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'apk-pre-push-wt-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bin=path.join(dir,'bin'),log=path.join(dir,'npm.log'),globalConfig=path.join(dir,'gitconfig');fs.mkdirSync(bin);fs.writeFileSync(globalConfig,'');
 fs.writeFileSync(path.join(bin,'npm'),`#!/bin/sh\nprintf '%s|%s|%s\\n' "$*" "\${GIT_DIR-unset}" "\${GIT_CONFIG_PARAMETERS-unset}" >> ${JSON.stringify(log)}\n`,{mode:0o700});
 const env={...Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GIT_'))),PATH:bin+path.delimiter+process.env.PATH,GIT_CONFIG_GLOBAL:globalConfig,GIT_CONFIG_NOSYSTEM:'1'};
 const git=(cwd,...args)=>{const got=spawnSync('git',args,{cwd,env,encoding:'utf8'});assert.equal(got.status,0,got.stderr);return got;};
 git(dir,'init','-q','--bare','remote.git');git(dir,'init','-q','-b','main','repo');const repo=path.join(dir,'repo'),wt=path.join(dir,'wt');
 git(repo,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-q','--allow-empty','-m','init');git(repo,'worktree','add','-q','-b','topic',wt);fs.mkdirSync(path.join(wt,'node_modules'));
 git(wt,'-c',`core.hooksPath=${path.dirname(hook)}`,'push','-q',path.join(dir,'remote.git'),'topic');
 assert.deepEqual(fs.readFileSync(log,'utf8').trim().split('\n'),['run --silent check|unset|unset','run --silent test:unit|unset|unset']);
});

test('pre-push hook explains missing dependencies instead of running the check',t=>{
 const f=fixture(t,{modules:false});const got=f.run(`refs/heads/x ${sha} refs/heads/x ${zero}\n`);
 assert.equal(got.status,1);assert.match(got.stderr,/npm ci --ignore-scripts/);assert.deepEqual(f.calls(),[]);
});
