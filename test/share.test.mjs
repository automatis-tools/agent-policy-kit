import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLE_DEFINITIONS} from '../src/roles.mjs';
import {PACKAGE_VERSION, PRESETS, presetPreferences, modelCatalog} from '../src/release.mjs';
import {encodeFormState, decodeFormState} from '../src/share.mjs';
import * as share from '../src/share.mjs';
import fs from 'node:fs';
import vm from 'node:vm';

const release={version:PACKAGE_VERSION,preset:'balanced',preferences:presetPreferences(),presets:PRESETS.map(p=>({...p,preferences:presetPreferences(p.id)})),roles:ROLE_DEFINITIONS,catalog:modelCatalog()};
const clone=value=>structuredClone(value);
const effective=(preferences,role)=>preferences.roles?.[role.id]??preferences[role.kind];
function snapshot(helpers=['worker','reviewer','explorer','routine'],pickedTools=['codex','claude','kimi','agy']){
 const state={maxConcurrent:3,profiles:{},jobs:{}};
 for(const [id,preferences] of Object.entries(release.preferences.clients)){
  state.profiles[id]={presetId:'balanced',custom:false,preferences:clone(preferences)};
  state.jobs[id]=Object.fromEntries(release.roles.map(role=>[role.id,clone(effective(preferences,role))]));
 }
 return {state,helpers,pickedTools,selectedScope:pickedTools.length>1?'all':pickedTools[0]??null};
}
const raw=json=>'#setup='+Buffer.from(typeof json==='string'?json:JSON.stringify(json)).toString('base64url');
const payload=()=>({v:1,release:PACKAGE_VERSION,roles:['reviewer'],tools:[{id:'codex',mode:'balanced',base:'balanced',choices:{reviewer:{model:'gpt-6.1-sol',effort:'high'}}}],scope:'codex',maxConcurrent:3});
const invalid=fn=>assert.throws(fn,{code:'INVALID_SHARE_LINK'});

test('empty and unrelated fragments carry no setup',()=>{
 assert.equal(encodeFormState(snapshot([],[]),release),'');
 for(const fragment of ['', '#', '#about', '#other=setup', '#setup-other=value'])assert.equal(decodeFormState(fragment,release),null);
});

test('a selected role/tool round-trips to the exact canonical visible payload',()=>{
 const input=snapshot(['reviewer'],['codex']),before=clone(input),metadata=clone(release);
 const encoded=encodeFormState(input,release);
 assert.equal(encoded,raw(payload()));
 assert.deepEqual(decodeFormState(encoded,release),payload());
 assert.deepEqual(input,before);assert.deepEqual(release,metadata);
 assert.equal(encodeFormState(input,release),encoded);
});

test('full and partial selections preserve order, cap and scope',()=>{
 for(const roles of [[],['routine'],['routine','worker','explorer','reviewer']])for(const tools of [[],['agy'],['kimi','codex','agy','claude']]){
  const input=snapshot(roles,tools);input.state.maxConcurrent=32;
  if(!roles.length&&!tools.length)continue;
  const decoded=decodeFormState(encodeFormState(input,release),release);
  assert.deepEqual(decoded.roles,roles);assert.deepEqual(decoded.tools.map(t=>t.id),tools);assert.equal(decoded.scope,input.selectedScope);assert.equal(decoded.maxConcurrent,32);
  for(const tool of decoded.tools)assert.deepEqual(Object.keys(tool.choices),roles);
 }
 const input=snapshot(['worker'],['codex','kimi']);input.selectedScope=null;
 assert.equal(decodeFormState(encodeFormState(input,release),release).scope,null);
});

test('unchosen, legacy-selected and explicitly selected modes remain distinct',()=>{
 const input=snapshot(['reviewer'],['codex']);
 input.state.profiles.codex.modeSelected=false;
 input.state.jobs.codex.reviewer={model:'unfinished id; $(draft)',effort:null};
 assert.equal(decodeFormState(encodeFormState(input,release),release).tools[0].mode,null);
 input.state.profiles.codex.modeSelected=true;invalid(()=>encodeFormState(input,release));
 input.state.jobs.codex.reviewer={model:'gpt-6.1-sol',effort:'high'};
 assert.equal(decodeFormState(encodeFormState(input,release),release).tools[0].mode,'balanced');
 delete input.state.profiles.codex.modeSelected;
 assert.equal(decodeFormState(encodeFormState(input,release),release).tools[0].mode,'balanced');
});

test('custom drafts including empty/Unicode/invalid model IDs and aliases are inert data',()=>{
 for(const model of ['', 'provider:model@2026[1m]', 'sonnet[1m]', 'kimi-code/k3', 'a b;$(id)<script>🦔', '\ud800']){
  const input=snapshot(['reviewer'],['codex']);input.state.profiles.codex.custom=true;input.state.jobs.codex.reviewer={model,effort:null};
  assert.deepEqual(decodeFormState(encodeFormState(input,release),release).tools[0],{id:'codex',mode:'custom',base:'balanced',choices:{reviewer:{model,effort:null}}});
 }
});

test('links omit unselected preferences, jobs, tools and transient clipboard data',()=>{
 const input=snapshot(['reviewer'],['codex']);input.clipboardStatus='secret transient';input.state.profiles.kimi.preferences.code.model='hidden-profile';input.state.jobs.kimi.worker.model='hidden-tool';input.state.jobs.codex.worker.model='hidden-role';
 const fragment=encodeFormState(input,release),json=Buffer.from(fragment.slice(7),'base64url').toString();
 assert.deepEqual(decodeFormState(fragment,release),payload());
 assert.doesNotMatch(json,/hidden-|clipboard|avoidModels|preferences/);
});

test('all named presets enforce effective role overrides as well as code/light defaults',()=>{
 for(const preset of release.presets){
  const input=snapshot();
  for(const id of input.pickedTools){input.state.profiles[id].presetId=preset.id;input.state.profiles[id].preferences=clone(preset.preferences.clients[id]);input.state.jobs[id]=Object.fromEntries(release.roles.map(role=>[role.id,clone(effective(preset.preferences.clients[id],role))]));}
  assert.ok(decodeFormState(encodeFormState(input,release),release));
 }
 const metadata=clone(release);metadata.presets[1].preferences.clients.codex.roles={reviewer:{model:'provider:reviewer',effort:null}};
 const input=snapshot(['reviewer'],['codex']);invalid(()=>encodeFormState(input,metadata));input.state.jobs.codex.reviewer={model:'provider:reviewer',effort:null};
 assert.equal(decodeFormState(encodeFormState(input,metadata),metadata).tools[0].choices.reviewer.model,'provider:reviewer');
 for(const mutate of [p=>p.tools[0].base='fast',p=>p.tools[0].choices.reviewer.model='other',p=>p.tools[0].choices.reviewer.effort='low']){const p=payload();mutate(p);invalid(()=>decodeFormState(raw(p),release));}
});

test('unknown IDs, duplicate selections and incomplete or extra role maps fail closed',()=>{
 const changes=[p=>p.roles=['worker','worker'],p=>p.roles=['unknown'],p=>p.tools.push(clone(p.tools[0])),p=>p.tools[0].id='unknown',p=>p.tools[0].base='unknown',p=>p.tools[0].mode='unknown',p=>p.tools[0].choices={},p=>p.tools[0].choices.worker={model:'x',effort:null},p=>p.tools[0].choices.unknown={model:'x',effort:null}];
 for(const change of changes){const p=payload();change(p);invalid(()=>decodeFormState(raw(p),release));}
 for(const [field,value] of [['helpers',['worker','worker']],['helpers',['unknown']],['pickedTools',['codex','codex']],['pickedTools',['unknown']]]){const input=snapshot();input[field]=value;invalid(()=>encodeFormState(input,release));}
});

test('schema rejects wrong types, unsafe fields and unknown wire properties at every level',()=>{
 const changes=[p=>p.v=2,p=>p.v='1',p=>p.roles=null,p=>p.tools={},p=>p.release=null,p=>p.extra=true,p=>p.roles=[1],p=>p.tools[0].extra=true,p=>p.tools[0].mode=false,p=>p.tools[0].choices.reviewer.extra=true,p=>p.tools[0].choices.reviewer.model=1,p=>p.tools[0].choices.reviewer.model='x'.repeat(129),p=>p.tools[0].choices.reviewer.effort=1];
 for(const change of changes){const p=payload();change(p);invalid(()=>decodeFormState(raw(p),release));}
 for(const key of ['__proto__','constructor','prototype']){
  for(const object of [p=>p,p=>p.tools[0],p=>p.tools[0].choices,p=>p.tools[0].choices.reviewer]){const p=payload();Object.defineProperty(object(p),key,{value:{polluted:true},enumerable:true});invalid(()=>decodeFormState(raw(p),release));}
 }
 assert.equal({}.polluted,undefined);
});

test('duplicate JSON keys including escaped names are rejected instead of last-value-wins',()=>{
 const json=JSON.stringify(payload());
 for(const text of [json.replace('"v":1','"v":0,"v":1'),json.replace('"model":"gpt-6.1-sol"','"model":"other","model":"gpt-6.1-sol"'),json.replace('"v":1','"v":1,"\\u0076":1')])invalid(()=>decodeFormState(raw(text),release));
});

test('base64url is unpadded/canonical and UTF-8 and decoded length are bounded',()=>{
 const good=raw(payload());
 for(const fragment of ['#setup=',good+'=',good+' ',good+'#x',good+'&x=y','#setup=+w','#setup=AA/','#setup=A','#setup=Zh','#setup='+Buffer.from([0xff,0xfe]).toString('base64url'),'#setup='+Buffer.from([0xc0,0xaf]).toString('base64url'),'#setup='+'A'.repeat(87385),raw(' '.repeat(65537)),raw('{')])invalid(()=>decodeFormState(fragment,release));
 assert.deepEqual(decodeFormState(good,release),payload());
});

test('valid release mismatches have a distinct error and malformed versions do not redirect',()=>{
 const p=payload();p.release='99.2.3';assert.throws(()=>decodeFormState(raw(p),release),{code:'SHARE_RELEASE_MISMATCH',releaseVersion:'99.2.3'});
 for(const version of ['', '../x', '0.1.0#x', '0.1.0+build.1', 'https://example.com', 1]){p.release=version;invalid(()=>decodeFormState(raw(p),release));}
 const newer=clone(release);newer.version='1.0.0-beta.1';assert.equal(decodeFormState(encodeFormState(snapshot(['reviewer'],['codex']),newer),newer).release,newer.version);
});

test('only known valid archived release links redirect from the HTTP root and discard queries',()=>{
 assert.equal(typeof share.archivedReleaseUrl,'function');const old=payload();old.release='0.0.9';old.tools[0].choices.reviewer.model='old-native-default';
 let mismatch;try{decodeFormState(raw(old),release);}catch(error){mismatch=error;}
 assert.equal(share.archivedReleaseUrl(mismatch,'https://example.com/?private=query'+raw(old),['0.0.9']),'https://example.com/v/0.0.9/'+raw(old));
 assert.equal(share.archivedReleaseUrl(mismatch,'http://localhost:8788/'+raw(old),['0.0.9']),'http://localhost:8788/v/0.0.9/'+raw(old));
 for(const href of ['file:///tmp/index.html'+raw(old),'https://user:secret@example.com/'+raw(old),'https://example.com/v/0.0.9/'+raw(old)])assert.equal(share.archivedReleaseUrl(mismatch,href,['0.0.9']),null);
 for(const versions of [[],['0.0.8'],['https://other.example/'],['../old']])assert.equal(share.archivedReleaseUrl(mismatch,'https://example.com/'+raw(old),versions),null);
 for(const error of [{code:'INVALID_SHARE_LINK'},{code:'SHARE_RELEASE_MISMATCH',releaseVersion:'https://other.example/'},{code:'SHARE_RELEASE_MISMATCH',releaseVersion:'../old'}])assert.equal(share.archivedReleaseUrl(error,'https://example.com/'+raw(old),['0.0.9']),null);
});

test('malformed old-release payloads remain invalid instead of becoming archive navigation',()=>{
 for(const mutate of [p=>p.maxConcurrent=0,p=>p.tools[0].choices={},p=>p.roles=['reviewer','reviewer'],p=>p.tools[0].choices.reviewer.extra=true]){
  const p=payload();p.release='0.0.9';mutate(p);invalid(()=>decodeFormState(raw(p),release));
 }
});

test('known archived release links can retain a client removed from the current release inventory',()=>{
 const older=clone(release);older.version='0.0.9';
 older.preferences.clients.retired=clone(older.preferences.clients.codex);older.catalog.clients.retired=clone(older.catalog.clients.codex);
 for(const preset of older.presets)preset.preferences.clients.retired=clone(preset.preferences.clients.codex);
 const input=snapshot(['reviewer'],['codex']);input.pickedTools=['retired'];input.selectedScope='retired';input.state.profiles.retired=clone(input.state.profiles.codex);input.state.jobs.retired=clone(input.state.jobs.codex);
 const fragment=encodeFormState(input,older);assert.equal(decodeFormState(fragment,older).tools[0].id,'retired');
 let mismatch;try{decodeFormState(fragment,release);}catch(error){mismatch=error;}
 assert.equal(mismatch?.code,'SHARE_RELEASE_MISMATCH');assert.equal(mismatch.releaseVersion,'0.0.9');
 assert.equal(share.archivedReleaseUrl(mismatch,'https://example.com/'+fragment,['0.0.9']),'https://example.com/v/0.0.9/'+fragment);
 const many=payload();many.release='0.0.9';many.tools=Array.from({length:5},(_,index)=>({...clone(many.tools[0]),id:'retired'+index}));many.scope='all';
 assert.throws(()=>decodeFormState(raw(many),release),{code:'SHARE_RELEASE_MISMATCH',releaseVersion:'0.0.9'});
 const excessive=clone(many);excessive.tools=Array.from({length:33},(_,index)=>({...clone(many.tools[0]),id:'retired'+index}));invalid(()=>decodeFormState(raw(excessive),release));
 for(const id of ['../retired','https://example.com','']){const malformed=clone(many);malformed.tools[0].id=id;invalid(()=>decodeFormState(raw(malformed),release));}
});

test('page navigation uses trusted archive history and stops rendering while it redirects',()=>{
 const template=fs.readFileSync(new URL('../site/template.html',import.meta.url),'utf8'),loadAddress=template.slice(template.indexOf(' function loadAddress('),template.indexOf(' function publishAddress('));
 const old=payload();old.release='0.0.9';const hash=raw(old);
 for(const hostedReleases of [[],['0.0.9'],['0.0.8']]){
  let destination=null,resets=0;const context=vm.createContext({decodeFormState,archivedReleaseUrl:share.archivedReleaseUrl,RELEASE:{...release,hostedReleases},location:{href:'https://example.com/?private=query'+hash,hash,replace:value=>{destination=value;}},freshForm:()=>{resets++;}});
  vm.runInContext(`let linkError='',archiveNavigation=false;${loadAddress};loadAddress();globalThis.result={linkError,archiveNavigation};`,context);
  if(hostedReleases.includes('0.0.9')){assert.equal(destination,'https://example.com/v/0.0.9/'+hash);assert.equal(context.result.archiveNavigation,true);assert.equal(resets,0);}
  else{assert.equal(destination,null);assert.equal(context.result.archiveNavigation,false);assert.equal(resets,1);assert.match(context.result.linkError,/matching APK release/);}
 }
 assert.match(template,/function render\([^]*?if\(archiveNavigation\)return;/);
});

test('scope and concurrency limits reject stale/invalid selection combinations',()=>{
 for(const scope of ['all','kimi',false,0,{}]){const p=payload();p.scope=scope;invalid(()=>decodeFormState(raw(p),release));}
 for(const cap of [0,33,-1,1.5,'3',null]){const p=payload();p.maxConcurrent=cap;invalid(()=>decodeFormState(raw(p),release));const input=snapshot();input.state.maxConcurrent=cap;invalid(()=>encodeFormState(input,release));}
 const p=payload();p.scope=null;p.maxConcurrent=1;assert.equal(decodeFormState(raw(p),release).maxConcurrent,1);
});

test('generic native effort levels are accepted for drafts; Antigravity is always null',()=>{
 for(const id of Object.keys(release.catalog.clients))for(const effort of [null,...release.catalog.clients[id].efforts]){
  const input=snapshot(['reviewer'],[id]);input.state.profiles[id].custom=true;input.state.jobs[id].reviewer={model:'draft',effort};
  assert.equal(decodeFormState(encodeFormState(input,release),release).tools[0].choices.reviewer.effort,effort);
 }
 for(const [id,effort] of [['codex','ultra'],['claude','none'],['kimi','minimal'],['agy','high']]){const input=snapshot(['reviewer'],[id]);input.state.profiles[id].custom=true;input.state.jobs[id].reviewer.effort=effort;invalid(()=>encodeFormState(input,release));}
});

test('encoding refuses accessors, symbols and prototype surprises without running getters',()=>{
 let calls=0;
 for(const target of ['snapshot','state','profile','choice','release']){
  const input=snapshot(['reviewer'],['codex']),metadata=clone(release),object={snapshot:input,state:input.state,profile:input.state.profiles.codex,choice:input.state.jobs.codex.reviewer,release:metadata}[target];
  Object.defineProperty(object,'trap',{enumerable:true,get(){calls++;throw new Error('getter executed');}});invalid(()=>encodeFormState(input,metadata));
 }
 assert.equal(calls,0);
 const input=snapshot(['reviewer'],['codex']);Object.setPrototypeOf(input.state.jobs.codex.reviewer,{model:'inherited'});invalid(()=>encodeFormState(input,release));
 const symbolic=snapshot();symbolic[Symbol('hidden')]='x';invalid(()=>encodeFormState(symbolic,release));
 const sparse=snapshot();delete sparse.helpers[0];invalid(()=>encodeFormState(sparse,release));
 const inherited=snapshot();Object.setPrototypeOf(inherited.state.profiles,{secret:true});invalid(()=>encodeFormState(inherited,release));
});


test('oversized encoded state is refused even when all draft fields are individually valid',()=>{
 const metadata=clone(release),input=snapshot([],['codex']);
 metadata.roles=Array.from({length:400},(_,index)=>({id:'role-'+index,name:'Role '+index,kind:'code'}));
 input.helpers=metadata.roles.map(role=>role.id);input.state.profiles.codex.custom=true;
 input.state.jobs.codex=Object.fromEntries(input.helpers.map(role=>[role,{model:'🦔'.repeat(64),effort:null}]));
 invalid(()=>encodeFormState(input,metadata));
});


test('old release links report release mismatch before comparing changed preset choices',()=>{
 const old=payload();old.release='0.0.9';old.tools[0].choices.reviewer.model='old-native-default';
 assert.throws(()=>decodeFormState(raw(old),release),{code:'SHARE_RELEASE_MISMATCH'});
 const malformed=clone(old);malformed.extra=true;invalid(()=>decodeFormState(raw(malformed),release));
 for(const version of ['0.0.9#unsafe', '../old', '']){const malformed=clone(old);malformed.release=version;invalid(()=>decodeFormState(raw(malformed),release));}
});
