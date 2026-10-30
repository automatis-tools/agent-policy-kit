import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as host from '../scripts/build-host.mjs';
import * as site from '../scripts/build-site.mjs';

const sensitive=['policies/fast.json','policies/balanced.json','policies/quality.json','models/catalog.json','src/roles.mjs','src/explicit.mjs','src/policy.mjs','schema/policy.schema.json'];
const put=(root,file,text)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),text);};
const git=(root,...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function fixture(t){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'apk-host-build-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 git(root,'init','-b','main');git(root,'config','user.name','Fixture');git(root,'config','user.email','fixture@example.invalid');
 for(const file of sensitive)put(root,file,'public configuration\n');
 put(root,'private-account.json','PRIVATE_ACCOUNT_MUST_NOT_SHIP');return root;
}
function release(root,version,html,tag='v'+version){
 put(root,'package.json',JSON.stringify({name:'agent-policy-kit',version}));put(root,'site/index.html',html);git(root,'add','package.json','site',...sensitive);git(root,'commit','-m','Release '+version);git(root,'tag',tag);
}
const renderPage=({canonicalRoot,hostedReleases})=>JSON.stringify({canonicalRoot,hostedReleases,byline:'Current author'});
const options=root=>({root,renderPage,lookupPublished:async version=>({name:'agent-policy-kit',version})});

test('host archives exact reachable tagged HTML and renders latest root separately',async t=>{
 assert.equal(typeof host.buildHost,'function');const root=fixture(t),first='<html>Original release author\r\n</html>\n',second='<html>Second release</html>';
 release(root,'0.1.0',first);release(root,'0.2.0',second);put(root,'site/index.html','Unreleased UI');put(root,'src/share.mjs','Current share UI');
 const current=git(root,'rev-parse','HEAD');git(root,'checkout','-b','other-history');release(root,'9.0.0','Unrelated release');git(root,'checkout','main');assert.equal(git(root,'rev-parse','HEAD'),current);
 const result=await host.buildHost(options(root));assert.deepEqual(result.hostedReleases,['0.1.0','0.2.0']);
 assert.equal(fs.readFileSync(path.join(root,'dist/v/0.1.0/index.html'),'utf8'),first);assert.equal(fs.readFileSync(path.join(root,'dist/v/0.2.0/index.html'),'utf8'),second);
 const latest=JSON.parse(fs.readFileSync(path.join(root,'dist/index.html'),'utf8'));assert.equal(latest.canonicalRoot,true);assert.deepEqual(latest.hostedReleases,result.hostedReleases);assert.equal(latest.byline,'Current author');
 assert.equal(fs.existsSync(path.join(root,'dist/_redirects')),false);assert.match(fs.readFileSync(path.join(root,'dist/_headers'),'utf8'),/frame-ancestors 'none'/);
 assert.doesNotMatch(JSON.stringify(fs.readdirSync(path.join(root,'dist'))),/private/);assert.doesNotMatch(fs.readFileSync(path.join(root,'dist/index.html'),'utf8'),/PRIVATE_ACCOUNT/);
 await host.buildHost(options(root));assert.equal(fs.readFileSync(path.join(root,'dist/v/0.1.0/index.html'),'utf8'),first);
});

test('host release authority rejects missing tag, unpublished package and mismatched package identities before cleanup',async t=>{
 for(const reason of ['tag','published','identity','tag-version','published-identity','published-version','duplicate-version','registry-unavailable']){
  const root=fixture(t);release(root,'0.1.0','Frozen');put(root,'dist/index.html','Prior deployment');
  if(reason==='tag')git(root,'tag','-d','v0.1.0');
  if(reason==='identity'){put(root,'package.json',JSON.stringify({name:'other-package',version:'0.1.0'}));git(root,'add','package.json');git(root,'commit','-m','Wrong package');git(root,'tag','-f','v0.1.0');}
  if(reason==='tag-version'){git(root,'tag','-d','v0.1.0');git(root,'tag','v0.2.0');}
  if(reason==='duplicate-version')git(root,'tag','0.1.0');
  const config=options(root);if(reason==='published')config.lookupPublished=async()=>null;
  if(reason==='published-identity')config.lookupPublished=async()=>({name:'other-package',version:'0.1.0'});
  if(reason==='published-version')config.lookupPublished=async()=>({name:'agent-policy-kit',version:'9.9.9'});
  if(reason==='registry-unavailable')config.lookupPublished=async()=>{throw Object.assign(new Error('HOST_REGISTRY_UNAVAILABLE'),{code:'HOST_REGISTRY_UNAVAILABLE'});};
  await assert.rejects(host.buildHost(config));assert.equal(fs.readFileSync(path.join(root,'dist/index.html'),'utf8'),'Prior deployment');
 }
});

test('every configuration-sensitive change blocks an old npm command; independent UI and share edits are allowed',async t=>{
 for(const file of sensitive){const root=fixture(t);release(root,'0.1.0','Frozen');put(root,file,'unreleased configuration\n');await assert.rejects(host.buildHost(options(root)),{code:'UNRELEASED_HOST_CONFIGURATION'});assert.equal(fs.existsSync(path.join(root,'dist')),false);}
});

test('host refuses unexpected output and symlinks without touching output or external files',async t=>{
 for(const mode of ['unexpected','unknown-version','root-symlink','nested-symlink']){
  const root=fixture(t);release(root,'0.1.0','Frozen');const external=path.join(root,'external');fs.mkdirSync(external);put(root,'external/keep.txt','Keep me');
  if(mode==='root-symlink')fs.symlinkSync(external,path.join(root,'dist'));
  else{put(root,'dist/index.html','Prior deployment');if(mode==='unexpected')put(root,'dist/private.json','User file');else if(mode==='unknown-version')put(root,'dist/v/9.9.9/index.html','Unowned version');else{fs.mkdirSync(path.join(root,'dist/v'));fs.symlinkSync(external,path.join(root,'dist/v/0.1.0'));}}
  await assert.rejects(host.buildHost(options(root)),{code:'UNSAFE_HOST_OUTPUT'});assert.equal(fs.readFileSync(path.join(external,'keep.txt'),'utf8'),'Keep me');if(mode!=='root-symlink')assert.equal(fs.readFileSync(path.join(root,'dist/index.html'),'utf8'),'Prior deployment');
 }
});

test('anonymous registry lookup uses only the fixed public package URL and validates metadata',async()=>{
 assert.equal(typeof host.lookupPublishedVersion,'function');const calls=[];
 const fetchImpl=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({name:'agent-policy-kit',version:'1.0.0-beta.1',private:'Never returned'})};};
 assert.deepEqual(await host.lookupPublishedVersion('1.0.0-beta.1',{fetchImpl}),{name:'agent-policy-kit',version:'1.0.0-beta.1'});
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://registry.npmjs.org/agent-policy-kit/1.0.0-beta.1');assert.equal(calls[0].options.redirect,'error');assert.deepEqual(calls[0].options.headers,{accept:'application/json'});
 assert.equal(await host.lookupPublishedVersion('0.1.0',{fetchImpl:async()=>({ok:true,json:async()=>({name:'different-package',version:'0.1.0'})})}),null);
 await assert.rejects(host.lookupPublishedVersion('../private',{fetchImpl}));assert.equal(calls.length,1);
});

test('host rejects build-metadata releases that the explicit installer command cannot target',async t=>{
 const root=fixture(t);release(root,'0.1.0+build.1','Unreachable archive');put(root,'dist/index.html','Prior deployment');
 await assert.rejects(host.buildHost(options(root)),{code:'INVALID_HOST_RELEASE'});assert.equal(fs.readFileSync(path.join(root,'dist/index.html'),'utf8'),'Prior deployment');
 assert.throws(()=>site.renderConfigurationPage({hostedReleases:['0.1.0+build.1']}));
});

test('public registry unavailability is distinct from a missing published version and leaks no transport details',async()=>{
 const lookup=fetchImpl=>host.lookupPublishedVersion('0.1.0',{fetchImpl});
 assert.equal(await lookup(async()=>({ok:false,status:404})),null);
 for(const fetchImpl of [async()=>{throw new Error('PRIVATE_TRANSPORT_DETAIL');},async()=>({ok:false,status:503}),async()=>({ok:false,status:429}),async()=>({ok:true,json:async()=>{throw new Error('PRIVATE_RESPONSE_DETAIL');}})]){
  await assert.rejects(lookup(fetchImpl),error=>{assert.equal(error.code,'HOST_REGISTRY_UNAVAILABLE');assert.equal(error.message,'HOST_REGISTRY_UNAVAILABLE');assert.doesNotMatch(JSON.stringify(error),/PRIVATE/);return true;});
 }
});

test('render API distinguishes latest canonical metadata and trusted archive routing data',()=>{
 assert.equal(typeof site.renderConfigurationPage,'function');const html=site.renderConfigurationPage({canonicalRoot:true,hostedReleases:['0.1.0']});
 assert.match(html,/<link rel="canonical" href="https:\/\/agent-policy-kit.trymenow.io\/">/);assert.match(html,/"hostedReleases":\["0.1.0"\]/);
 for(const version of ['../unsafe','1.0.0-a..b','01.0.0','1.0.0-01','1.0.0+build.1'])assert.throws(()=>site.renderConfigurationPage({hostedReleases:[version]}));
});
