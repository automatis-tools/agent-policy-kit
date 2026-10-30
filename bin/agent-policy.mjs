#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {CLIENTS,validatePolicy} from '../src/policy.mjs';
import {ROLE_IDS} from '../src/roles.mjs';
import {EXPLICIT_FIELDS,parseExplicitOptions} from '../src/explicit.mjs';
import {nativeHomeConflict} from '../src/native.mjs';
import {detectClients,resolveClient,summarizeDetection} from '../src/detect.mjs';
import {bundledReleaseInfo,presetPreferences} from '../src/release.mjs';
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
  release       Show this package's configuration version and release notes
  setup         Plan native configuration; add --apply to write
  install       Plan one --client or all detected clients
  uninstall     Plan owned removals; add --apply to remove
  doctor        Check owned native configuration without model calls

Options: --client codex|claude|kimi|agy --home PATH --state-dir PATH
         --policy FILE | --release [--preset fast|balanced|quality] | --config BASE64URL
         --roles worker,reviewer,explorer,routine --max-concurrent 3
         --codex ROLE=MODEL:EFFORT,... --claude ROLE=MODEL:EFFORT,...
         --kimi ROLE=ALIAS:EFFORT,... --antigravity ROLE=TIER,...
         --avoid-codex MODELS --avoid-claude MODELS --avoid-kimi MODELS --avoid-antigravity MODELS
         --apply --help --version

Explicit tool input requires --roles and --max-concurrent. Use :native for unpinned effort.
Include every selected role for each selected tool. Avoid lists are comma-separated.
State defaults to AGENT_POLICY_HOME or ~/.agent-policy-kit.
This configurator exits after setup. Native files work without the package.`);}
async function main(){
  const {values:opts,positionals,tokens}=parseArgs({allowPositionals:true,strict:true,tokens:true,options:{
    client:{type:'string'},home:{type:'string'},'state-dir':{type:'string'},policy:{type:'string'},
    apply:{type:'boolean',default:false},help:{type:'boolean'},version:{type:'boolean'},
    release:{type:'boolean',default:false},config:{type:'string'},preset:{type:'string'},
    ...Object.fromEntries(EXPLICIT_FIELDS.map(name=>[name,{type:'string'}])),
  }});
  if(opts.version){console.log(version);return;}
  const command=positionals[0];
  if(opts.help||!command||command==='help'){help();return;}
  if(!['instructions','init','detect','release','setup','install','uninstall','doctor'].includes(command)) fail('UNKNOWN_COMMAND');
  if(positionals.length!==1) fail('UNEXPECTED_ARGUMENT');
  const seen=new Set();for(const token of tokens)if(token.kind==='option'&&EXPLICIT_FIELDS.includes(token.name)){if(seen.has(token.name))fail('DUPLICATE_OPTION');seen.add(token.name);}
  const explicitValues=Object.fromEntries(EXPLICIT_FIELDS.filter(name=>opts[name]!==undefined).map(name=>[name,opts[name]])),explicit=Object.keys(explicitValues).length>0;
  const bundled=Boolean(opts.release||opts.preset!==undefined);
  if([opts.policy!==undefined,bundled,opts.config!==undefined,explicit].filter(Boolean).length>1)fail('CONFLICTING_OPTIONS');
  if(explicit&&(!['setup','install'].includes(command)||opts.client!==undefined))fail('CONFLICTING_OPTIONS');
  if((opts.release||opts.config!==undefined)&&!['setup','install'].includes(command))fail('CONFLICTING_OPTIONS');
  if(opts.preset!==undefined&&!['release','setup','install'].includes(command))fail('CONFLICTING_OPTIONS');
  const preset=opts.preset??'balanced';
  if(bundled)presetPreferences(preset);
  if(command==='instructions'){process.stdout.write(fs.readFileSync(path.join(root,'AGENT_INSTALL.md'),'utf8'));return;}
  if(command==='release'){print(bundledReleaseInfo(preset));return;}
  const client=opts.client;
  if(client!==undefined&&!CLIENTS.includes(client)) fail('UNSUPPORTED_CLIENT');
  const home=path.resolve(opts.home??os.homedir());
  const selectedState=opts['state-dir']??process.env.AGENT_POLICY_HOME??path.join(home,'.agent-policy-kit');
  if(!path.isAbsolute(selectedState)) fail('STATE_PATH_MUST_BE_ABSOLUTE');
  const stateDir=path.resolve(selectedState);
  const builtin=path.join(root,`policies/${preset}.json`);
  let policyPath=bundled?builtin:opts.policy?path.resolve(opts.policy):fs.existsSync(path.join(stateDir,'policy.json'))?path.join(stateDir,'policy.json'):builtin;
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
  if(command==='setup'||command==='install'){
    let temporary;
    try{
      if(opts.config!==undefined||explicit){
        let preferences;
        if(explicit){try{preferences=validatePolicy(parseExplicitOptions(explicitValues,ROLE_IDS));}catch{fail('INVALID_EXPLICIT_CONFIG');}}
        else try{
          if(opts.config.length>87384||!/^[-_A-Za-z0-9]+$/.test(opts.config))throw new Error();
          const bytes=Buffer.from(opts.config,'base64url');
          if(bytes.length>65536||bytes.toString('base64url')!==opts.config)throw new Error();
          preferences=validatePolicy(JSON.parse(bytes.toString('utf8')));
        }catch{fail('INVALID_CONFIG');}
        temporary=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'agent-policy-config-'));
        policyPath=path.join(temporary,'preferences.json');
        fs.writeFileSync(policyPath,JSON.stringify(preferences),{flag:'wx',mode:0o600});
      }
      const preferences=loadPolicy(policyPath);
      const {setupDetected}=await import('../src/setup.mjs');
      const result=await setupDetected({client:client??null,home,stateDir,policyPath,apply:opts.apply,explicitHome:Boolean(opts.home),
        releaseVersion:version,replace:bundled||opts.config!==undefined||explicit,
        preset:explicit||opts.config!==undefined||opts.policy||policyPath!==builtin?null:preset,
        source:explicit||opts.config!==undefined||opts.policy?'custom':policyPath===builtin?'release':'saved',
        enabledClients:Object.keys(preferences.clients)});
      print(result);process.exitCode=result.exitCode;return;
    }finally{if(temporary)fs.rmSync(temporary,{recursive:true,force:true});}
  }
  const {inspectConfiguration}=await import('../src/install.mjs');
  const report={schemaVersion:1,mode:'configuration_only',version,clients:{}};
  for(const selected of client?[client]:CLIENTS){
    const detection=summarizeDetection([await resolveClient(selected)])[0];
    let configuration={status:'not_configured'};
    if(!opts.home&&nativeHomeConflict(selected,home,process.env)){
      configuration={status:'attention',reason:'NATIVE_HOME_OVERRIDE_UNSUPPORTED'};
    } else if(fs.existsSync(path.join(stateDir,'installations',selected+'.json'))){
      try{configuration=await inspectConfiguration({client:selected,home,stateDir});}
      catch(error){configuration={status:'attention',reason:safeCode(error.code)};}
    }
    report.clients[selected]={detection,configuration,modelExecution:'not_checked',
      concurrency:['codex','claude'].includes(selected)?'native_setting_with_client_exceptions':'instructions_only',
      models:selected==='agy'?'native_tiers':selected==='kimi'?'native_pool_with_routing_guidance':'native_role_settings'};
  }
  print(report);
}
main().catch(error=>{print({error:safeCode(error.code)});process.exitCode=1;});
