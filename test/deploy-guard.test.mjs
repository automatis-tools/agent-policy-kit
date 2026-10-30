import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentDecision} from '../scripts/deploy-guard.mjs';

const repo='automatis-tools/agent-policy-kit',sha='a'.repeat(40),older='b'.repeat(40);
const run={head_sha:sha,head_branch:'main',event:'push',status:'completed',conclusion:'success',head_repository:{full_name:repo}};
const workflow={name:'Verify package',event:'push',conclusion:'success',head_branch:'main',head_sha:sha,head_repository:{full_name:repo}};
const input=()=>({eventName:'workflow_run',ref:'refs/heads/main',repository:repo,event:{workflow_run:structuredClone(workflow)},headSha:sha,mainSha:sha,verificationRuns:[structuredClone(run)]});

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
