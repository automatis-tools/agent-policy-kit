import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const shaPattern=/^[a-f0-9]{40}$/;
const releaseTag=/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const deny=reason=>({deploy:false,reason});
export function deploymentDecision({eventName,ref,repository,event,headSha,mainSha,verificationRuns=[],tagSha,tagOnMain=false}){
 if(ref!=='refs/heads/main')return deny('not-main-context');
 if(typeof repository!=='string'||!/^[-\w.]+\/[-\w.]+$/.test(repository))return deny('invalid-repository');
 if(!shaPattern.test(headSha??'')||!shaPattern.test(mainSha??''))return deny('invalid-commit');
 if(eventName==='workflow_run'){
  const run=event?.workflow_run;
  if(run?.name!=='Verify package'||run.event!=='push'||run.conclusion!=='success'||run.head_repository?.full_name!==repository)return deny('untrusted-verification-event');
  if(run.head_branch!=='main'){
   if(typeof run.head_branch!=='string'||run.head_branch.length>128||!releaseTag.test(run.head_branch)||!tagOnMain||tagSha!==run.head_sha)return deny('untrusted-release-tag');
  }
 }else if(eventName!=='workflow_dispatch')return deny('unsupported-event');
 if(headSha!==mainSha)return deny('stale-main-checkout');
 if(!Array.isArray(verificationRuns)||!verificationRuns.some(run=>run?.head_sha===headSha&&run.head_branch==='main'&&run.event==='push'&&run.status==='completed'&&run.conclusion==='success'&&run.head_repository?.full_name===repository))return deny('main-ci-not-passed');
 return {deploy:true,reason:'verified-current-main',sha:headSha};
}

async function main(){
 const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
 const env=process.env,eventName=env.GITHUB_EVENT_NAME,ref=env.GITHUB_REF,repository=env.GITHUB_REPOSITORY;
 if(!['workflow_run','workflow_dispatch'].includes(eventName)||ref!=='refs/heads/main')throw new Error('Deployment requires a main-branch GitHub Actions context.');
 if(!/^[-\w.]+\/[-\w.]+$/.test(repository??'')||!env.GITHUB_EVENT_PATH||!env.GITHUB_OUTPUT||!env.GH_TOKEN)throw new Error('Deployment context is incomplete.');
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const git=(args,optional=false)=>{
  const result=spawnSync('git',args,{cwd:root,encoding:'utf8',timeout:30000});
  if(result.error||result.status!==0){if(optional)return null;throw new Error('Unable to verify deployment Git history.');}
  return result.stdout.trim();
 };
 git(['fetch','origin','main','--tags']);
 const headSha=git(['rev-parse','HEAD']),mainSha=git(['rev-parse','origin/main']);
 let tagSha=null,tagOnMain=false;
 const triggerBranch=event?.workflow_run?.head_branch;
 if(typeof triggerBranch==='string'&&triggerBranch.length<=128&&releaseTag.test(triggerBranch)){
  tagSha=git(['rev-parse',`refs/tags/${triggerBranch}^{commit}`],true);
  if(tagSha){const ancestor=spawnSync('git',['merge-base','--is-ancestor',tagSha,'origin/main'],{cwd:root,timeout:10000});tagOnMain=ancestor.status===0;}
 }
 let verificationRuns=[];
 if(shaPattern.test(headSha)&&headSha===mainSha){
  const query=new URLSearchParams({branch:'main',event:'push',head_sha:headSha,per_page:'20'});
  const response=await fetch(`https://api.github.com/repos/${repository}/actions/workflows/ci.yml/runs?${query}`,{headers:{Authorization:`Bearer ${env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'agent-policy-kit-deploy'},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`Unable to verify main CI (HTTP ${response.status}).`);
  verificationRuns=(await response.json()).workflow_runs;
 }
 const result=deploymentDecision({eventName,ref,repository,event,headSha,mainSha,verificationRuns,tagSha,tagOnMain});
 fs.appendFileSync(env.GITHUB_OUTPUT,`deploy=${result.deploy}\nreason=${result.reason}\nsha=${result.deploy?result.sha:''}\n`);
 console.log(result.deploy?`Deployment authorized for main ${result.sha}.`:`Deployment skipped: ${result.reason}.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
