import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {siteDeploymentConfig} from '../scripts/prepare-site-deploy.mjs';
import {verifyHostedSite} from '../scripts/verify-hosted-site.mjs';

const config=()=>({name:'agent-policy-kit',compatibility_date:'2026-10-30',workers_dev:true,preview_urls:false,assets:{directory:'./dist',html_handling:'auto-trailing-slash',not_found_handling:'none'},routes:[{pattern:'agent-policy-kit.trymenow.io',custom_domain:true}]});

test('CI asset deployment retains existing worker identity and omits routing authority',()=>{
 const source=config(),result=siteDeploymentConfig(source,'/workspace');
 assert.equal(result.name,'agent-policy-kit');assert.equal(result.assets.directory,'/workspace/dist');assert.equal(result.workers_dev,true);assert.equal(result.preview_urls,false);
 assert.equal(result.routes,undefined);assert.equal(result.route,undefined);assert.deepEqual(source,config());
 for(const patch of [{name:'other-worker'},{main:'worker.js'},{vars:{SECRET:'never-copy'}},{account_id:'other-account'},{assets:{directory:'../outside'}}])assert.throws(()=>siteDeploymentConfig({...config(),...patch},'/workspace'));
});

function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'apk-site-proof-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'dist/v/0.1.0'),{recursive:true});fs.writeFileSync(path.join(root,'dist/index.html'),'Latest');fs.writeFileSync(path.join(root,'dist/v/0.1.0/index.html'),'Frozen');return root;}
function response(url,body,status=200){return {ok:status===200,status,url,arrayBuffer:async()=>Uint8Array.from(Buffer.from(body)).buffer};}

test('public deployment proof checks latest and exact archive bytes with ordinary TLS URLs',async t=>{
 const root=fixture(t),calls=[];
 const result=await verifyHostedSite({root,baseUrl:'https://example.test/',attempts:1,fetchImpl:async url=>{calls.push(String(url));return response(String(url),new URL(url).pathname==='/'?'Latest':'Frozen');}});
 assert.equal(result.length,2);assert.equal(calls.length,2);assert.ok(calls.every(url=>url.startsWith('https://example.test/')));
});

test('deployment proof refuses wrong content, unavailable pages, redirects and unsafe destinations',async t=>{
 const root=fixture(t);
 for(const fetchImpl of [async url=>response(String(url),'Wrong'),async url=>response(String(url),'',404),async()=>response('https://attacker.test/','Latest')])await assert.rejects(verifyHostedSite({root,baseUrl:'https://example.test/',attempts:1,fetchImpl}));
 for(const baseUrl of ['http://example.test/','https://user:secret@example.test/'])await assert.rejects(verifyHostedSite({root,baseUrl,attempts:1,fetchImpl:async()=>{throw new Error('Must not fetch');}}));
});
