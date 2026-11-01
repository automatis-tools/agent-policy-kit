import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {deploymentDecision,decisionNotice,releaseTagState} from '../scripts/deploy-guard.mjs';

// Fixture repositories must never inherit a surrounding repository from a launcher such as a git hook.
for(const key of execFileSync('git',['rev-parse','--local-env-vars'],{encoding:'utf8'}).split('\n').filter(Boolean))delete process.env[key];

const repo='automatis-tools/agent-policy-kit',sha='a'.repeat(40),older='b'.repeat(40);
const run={head_sha:sha,head_branch:'main',event:'push',status:'completed',conclusion:'success',head_repository:{full_name:repo}};
const workflow={name:'Verify package',event:'push',conclusion:'success',head_branch:'main',head_sha:sha,head_repository:{full_name:repo}};
const input=()=>({eventName:'workflow_run',ref:'refs/heads/main',repository:repo,event:{workflow_run:structuredClone(workflow)},headSha:sha,mainSha:sha,verificationRuns:[structuredClone(run)],version:'0.1.0',releaseTagged:true});

test('main deployment requires successful same-repository push CI for the checked out current main',()=>{
 assert.equal(deploymentDecision(input()).deploy,true);
 const manual={...input(),eventName:'workflow_dispatch',event:{}};assert.equal(deploymentDecision(manual).deploy,true);
 for(const patch of [{ref:'refs/heads/feature'},{eventName:'pull_request'},{mainSha:older},{headSha:''},{verificationRuns:[]},{verificationRuns:[{...run,conclusion:'failure'}]},{verificationRuns:[{...run,head_sha:older}]},{verificationRuns:[{...run,event:'pull_request'}]},{verificationRuns:[{...run,head_repository:{full_name:'attacker/fork'}}]}])assert.equal(deploymentDecision({...input(),...patch}).deploy,false);
});

test('workflow_run never trusts pull requests, forks or failed verification even with a passing status elsewhere',()=>{
 for(const patch of [{name:'Other workflow'},{event:'pull_request'},{conclusion:'failure'},{head_repository:{full_name:'attacker/fork'}},{head_branch:'feature'},{head_branch:'v1.2.3;echo'}]){
  const value=input();Object.assign(value.event.workflow_run,patch);assert.equal(deploymentDecision(value).deploy,false);
 }
});

test('a verified release-tag CI completion can retry main deployment without executing tagged branch code',()=>{
 const value=input();value.event.workflow_run.head_branch='v0.1.0';value.event.workflow_run.head_sha=older;value.tagSha=older;value.tagOnMain=true;
 assert.equal(deploymentDecision(value).deploy,true);
 for(const patch of [{tagSha:null},{tagSha:sha},{tagOnMain:false}])assert.equal(deploymentDecision({...value,...patch}).deploy,false);
});

test('a package version without a release tag on main skips deployment with a stated reason instead of failing',()=>{
 for(const value of [input(),{...input(),eventName:'workflow_dispatch',event:{}}]){
  const result=deploymentDecision({...value,version:'0.3.0',releaseTagged:false});
  assert.deepEqual(result,{deploy:false,reason:'release-not-tagged',version:'0.3.0'});
  const notice=decisionNotice(result);assert.match(notice,/0\.3\.0/);assert.match(notice,/not tagged and published yet/);
 }
 assert.equal(deploymentDecision({...input(),releaseTagged:undefined}).deploy,false,'a missing tag state must never deploy');
 assert.equal(decisionNotice(deploymentDecision(input())),null);
});

test('security and CI denials keep precedence over a missing release tag',()=>{
 for(const patch of [{ref:'refs/heads/feature'},{mainSha:older},{verificationRuns:[]},{eventName:'pull_request'}]){
  const result=deploymentDecision({...input(),...patch,releaseTagged:false});
  assert.equal(result.deploy,false);assert.notEqual(result.reason,'release-not-tagged');assert.equal(decisionNotice(result),null);
 }
});

test('release tag state mirrors the host build: a v-prefixed or bare version tag reachable from HEAD',t=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'apk-deploy-tag-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const globalConfig=path.join(root,'.gitconfig-empty');fs.writeFileSync(globalConfig,'');
 const env={...process.env,GIT_CONFIG_GLOBAL:globalConfig,GIT_CONFIG_NOSYSTEM:'1'};
 const git=(...args)=>execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid',...args],{cwd:root,env,stdio:['ignore','pipe','pipe']});
 const release=version=>{fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'agent-policy-kit',version}));git('add','package.json');git('commit','-q','-m','Release '+version);};
 git('init','-q','-b','main');release('0.1.0');git('tag','v0.1.0');
 assert.deepEqual(releaseTagState(root),{version:'0.1.0',releaseTagged:true});
 release('0.2.0');assert.deepEqual(releaseTagState(root),{version:'0.2.0',releaseTagged:false});
 git('checkout','-q','-b','elsewhere');fs.writeFileSync(path.join(root,'other'),'x');git('add','other');git('commit','-q','-m','Elsewhere');git('tag','v0.2.0');git('checkout','-q','main');
 assert.equal(releaseTagState(root).releaseTagged,false,'a tag outside HEAD history does not count');
 git('tag','0.2.0');assert.equal(releaseTagState(root).releaseTagged,true,'a bare version tag counts like the host build');
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'agent-policy-kit',version:'0.2.0 --all'}));
 assert.throws(()=>releaseTagState(root),/valid package version/);
});
