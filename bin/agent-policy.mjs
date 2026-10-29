#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {CLIENTS,validatePolicy} from '../src/policy.mjs';
import {detectClients,resolveClient,summarizeDetection} from '../src/detect.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version;
const print=value=>process.stdout.write(JSON.stringify(value,null,2)+'\n');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const safeCode=code=>typeof code==='string'&&/^[A-Z_]{1,64}$/.test(code)?code:'OPERATION_FAILED';
function loadPolicy(file) {
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>65536) fail('INVALID_POLICY');
  try{return validatePolicy(JSON.parse(fs.readFileSync(file,'utf8')));}catch{fail('INVALID_POLICY');}
}
function help(){console.log(`Agent Policy Kit ${version}

Usage: agent-policy <command> [options]

  instructions  Print the AI setup and removal guide
  init          Copy default preferences to --policy (never overwrite)
  detect        Detect installed coding tools from executable identity
  setup         Plan native configuration; add --apply to write
  install       Plan one --client or all detected clients
  uninstall     Plan owned removals; add --apply to remove
  doctor        Check owned native configuration without model calls

Options: --client codex|claude|kimi|agy --home PATH --state-dir PATH
         --policy FILE --apply --help --version

State defaults to AGENT_POLICY_HOME or ~/.agent-policy-kit.
This configurator exits after setup. Native files work without the package.`);}
async function main(){
  const {values:opts,positionals}=parseArgs({allowPositionals:true,strict:true,options:{
    client:{type:'string'},home:{type:'string'},'state-dir':{type:'string'},policy:{type:'string'},
    apply:{type:'boolean',default:false},help:{type:'boolean'},version:{type:'boolean'},
  }});
  if(opts.version){console.log(version);return;}
  const command=positionals[0];
  if(opts.help||!command||command==='help'){help();return;}
  if(!['instructions','init','detect','setup','install','uninstall','doctor'].includes(command)) fail('UNKNOWN_COMMAND');
  if(positionals.length!==1) fail('UNEXPECTED_ARGUMENT');
  if(command==='instructions'){process.stdout.write(fs.readFileSync(path.join(root,'AGENT_INSTALL.md'),'utf8'));return;}
  const client=opts.client;
  if(client&&!CLIENTS.includes(client)) fail('UNSUPPORTED_CLIENT');
  const home=path.resolve(opts.home??os.homedir());
  const selectedState=opts['state-dir']??process.env.AGENT_POLICY_HOME??path.join(home,'.agent-policy-kit');
  if(!path.isAbsolute(selectedState)) fail('STATE_PATH_MUST_BE_ABSOLUTE');
  const stateDir=path.resolve(selectedState);
  const policyPath=opts.policy?path.resolve(opts.policy):fs.existsSync(path.join(stateDir,'policy.json'))?path.join(stateDir,'policy.json'):path.join(root,'policies/balanced.json');
  if(command==='detect'){print(summarizeDetection(client?[await resolveClient(client)]:await detectClients()));return;}
  if(command==='init'){
    if(!opts.policy) fail('POLICY_PATH_REQUIRED');
    fs.mkdirSync(path.dirname(policyPath),{recursive:true,mode:0o700});
    fs.writeFileSync(policyPath,JSON.stringify(loadPolicy(path.join(root,'policies/balanced.json')),null,2)+'\n',{flag:'wx',mode:0o600});
    print({status:'created',schemaVersion:1});return;
  }
  if(command==='uninstall'){
    const {uninstall,summarizePlan}=await import('../src/install.mjs');
    const clients=client?[client]:CLIENTS.filter(c=>fs.existsSync(path.join(stateDir,'installations',c+'.json')));
    const results=[];
    for(const selected of clients){
      try{const result=await uninstall({client:selected,home,stateDir,apply:opts.apply});results.push(opts.apply?result:summarizePlan(result));}
      catch(error){results.push({client:selected,status:'error',error:safeCode(error.code)});}
    }
    const failed=results.some(r=>r.status==='error');
    print(client&&!failed?results[0]:{schemaVersion:1,status:failed?'partial':clients.length?'completed':'not_installed',results});
    if(failed) process.exitCode=3;
    return;
  }
  loadPolicy(policyPath);
  if(command==='setup'||command==='install'){
    const {setupDetected}=await import('../src/setup.mjs');
    const result=await setupDetected({client:client??null,home,stateDir,policyPath,apply:opts.apply});
    print(result);process.exitCode=result.exitCode;return;
  }
  const {planInstall}=await import('../src/install.mjs');
  const report={schemaVersion:1,mode:'configuration_only',version,clients:{}};
  for(const selected of client?[client]:CLIENTS){
    const detection=summarizeDetection([await resolveClient(selected)])[0];
    let configuration={status:'not_configured'};
    if(fs.existsSync(path.join(stateDir,'installations',selected+'.json'))){
      try{const plan=await planInstall({client:selected,home,stateDir,policyPath});configuration={status:plan.status==='unchanged'?'verified':'attention',warnings:plan.warnings};}
      catch(error){configuration={status:'attention',reason:safeCode(error.code)};}
    }
    report.clients[selected]={detection,configuration,modelExecution:'not_checked',
      concurrency:['codex','claude'].includes(selected)?'native_setting_with_client_exceptions':'instructions_only',
      models:selected==='agy'?'native_tiers':selected==='kimi'?'native_pool_with_routing_guidance':'native_role_settings'};
  }
  print(report);
}
main().catch(error=>{print({error:safeCode(error.code)});process.exitCode=1;});
