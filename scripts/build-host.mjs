import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {renderConfigurationPage} from './build-site.mjs';

const repositoryRoot=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sensitiveFiles=['policies/fast.json','policies/balanced.json','policies/quality.json','models/catalog.json','src/roles.mjs','src/explicit.mjs','src/policy.mjs','schema/policy.schema.json'];
const semver=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/;
const validVersion=value=>typeof value==='string'&&value.length<=128&&semver.test(value);
function fail(code){throw Object.assign(new Error(code),{code});}
function git(root,...args){return execFileSync('git',args,{cwd:root,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});}
function packageIdentity(text){let pkg;try{pkg=JSON.parse(text);}catch{fail('INVALID_HOST_RELEASE');}if(pkg?.name!=='agent-policy-kit'||!validVersion(pkg.version))fail('INVALID_HOST_RELEASE');return pkg;}
function inspectOutput(destination,versions=null){
 let stat;try{stat=fs.lstatSync(destination);}catch(error){if(error.code==='ENOENT')return;throw error;}
 if(!stat.isDirectory()||stat.isSymbolicLink())fail('UNSAFE_HOST_OUTPUT');
 function walk(directory,level){
  for(const name of fs.readdirSync(directory)){
   const target=path.join(directory,name),node=fs.lstatSync(target);if(node.isSymbolicLink())fail('UNSAFE_HOST_OUTPUT');
   const allowedFile=level===0?['index.html','_headers','_redirects'].includes(name):level===2&&name==='index.html';
   const allowedDirectory=level===0?name==='v':level===1&&validVersion(name)&&(versions===null||versions.includes(name));
   if(node.isFile()&&allowedFile)continue;
   if(node.isDirectory()&&allowedDirectory){walk(target,level+1);continue;}
   fail('UNSAFE_HOST_OUTPUT');
  }
 }
 walk(destination,0);
}

export async function lookupPublishedVersion(version,{attempts=1,fetchImpl=fetch}={}){
 if(!validVersion(version)||!Number.isInteger(attempts)||attempts<1||attempts>3)fail('INVALID_HOST_RELEASE');
 let unavailable=true;
 for(let attempt=0;attempt<attempts;attempt++){
  unavailable=true;
  try{
   const response=await fetchImpl(`https://registry.npmjs.org/agent-policy-kit/${encodeURIComponent(version)}`,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{accept:'application/json'}});
   if(response.ok){const record=await response.json();if(record?.name==='agent-policy-kit'&&record.version===version)return {name:record.name,version:record.version};unavailable=false;}
   else if(response.status===404)unavailable=false;
  }catch{}
  if(attempt+1<attempts)await new Promise(resolve=>setTimeout(resolve,1000));
 }
 if(unavailable)fail('HOST_REGISTRY_UNAVAILABLE');
 return null;
}

export async function buildHost({root=repositoryRoot,lookupPublished=lookupPublishedVersion,renderPage=renderConfigurationPage}={}){
 root=path.resolve(root);const rootStat=fs.lstatSync(root);if(!rootStat.isDirectory()||rootStat.isSymbolicLink())fail('UNSAFE_HOST_OUTPUT');
 const destination=path.join(root,'dist');inspectOutput(destination);
 const current=packageIdentity(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 const tags=git(root,'tag','--merged','HEAD').toString('utf8').trim().split('\n').filter(Boolean),archives=new Map();
 for(const tag of tags){
  const version=tag.startsWith('v')?tag.slice(1):tag;if(!validVersion(version))continue;
  const ref=`refs/tags/${tag}`;
  const pkg=packageIdentity(git(root,'show',`${ref}:package.json`).toString('utf8'));if(pkg.version!==version||archives.has(version))fail('INVALID_HOST_RELEASE');
  archives.set(version,{ref,html:git(root,'show',`${ref}:site/index.html`)});
 }
 const release=archives.get(current.version);if(!release)fail('HOST_RELEASE_TAG_REQUIRED');
 for(const file of sensitiveFiles){
  const target=path.join(root,file);let actual;try{const stat=fs.lstatSync(target);if(!stat.isFile()||stat.isSymbolicLink())fail('UNRELEASED_HOST_CONFIGURATION');actual=fs.readFileSync(target);}catch{fail('UNRELEASED_HOST_CONFIGURATION');}
  if(!actual.equals(git(root,'show',`${release.ref}:${file}`)))fail('UNRELEASED_HOST_CONFIGURATION');
 }
 const published=await lookupPublished(current.version);if(published?.name!=='agent-policy-kit'||published.version!==current.version)fail('HOST_RELEASE_NOT_PUBLISHED');
 const hostedReleases=[...archives.keys()].sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
 const html=await renderPage({canonicalRoot:true,hostedReleases});if(typeof html!=='string'||!html.length)fail('INVALID_HOST_PAGE');
 // Recheck immediately before replacing this strictly allowlisted generated tree.
 inspectOutput(destination,hostedReleases);fs.rmSync(destination,{recursive:true,force:true});fs.mkdirSync(destination,{recursive:true});
 fs.writeFileSync(path.join(destination,'index.html'),html);
 for(const [version,archive]of archives){const directory=path.join(destination,'v',version);fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'index.html'),archive.html);}
 fs.writeFileSync(path.join(destination,'_headers'),`/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'\n  Cache-Control: no-cache\n`);
 return {version:current.version,hostedReleases,destination};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await buildHost({lookupPublished:version=>lookupPublishedVersion(version,{attempts:3})});console.log(`Built latest root and ${result.hostedReleases.length} immutable release snapshot(s).`);}catch(error){console.error(error.code??'HOST_BUILD_FAILED');process.exitCode=1;}
}
