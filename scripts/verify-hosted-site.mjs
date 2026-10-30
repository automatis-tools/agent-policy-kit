import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export async function verifyHostedSite({root,baseUrl,attempts=8,delayMs=3000,fetchImpl=fetch}={}){
 const base=new URL(baseUrl);
 if(base.protocol!=='https:'||base.username||base.password||!Number.isInteger(attempts)||attempts<1||attempts>10)throw new Error('Invalid public deployment verification target.');
 const dist=path.join(root,'dist'),targets=[['/',path.join(dist,'index.html')]];
 for(const version of fs.readdirSync(path.join(dist,'v'))){
  if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))throw new Error('Invalid release verification path.');
  targets.push([`/v/${version}/`,path.join(dist,'v',version,'index.html')]);
 }
 const results=[];
 for(const [pathname,file]of targets){
  const expected=fs.readFileSync(file),url=new URL(pathname,base.origin);url.searchParams.set('verify',createHash('sha256').update(expected).digest('hex').slice(0,12));
  let matched=false;
  for(let attempt=0;attempt<attempts;attempt++){
   try{
    const response=await fetchImpl(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
    const actualUrl=new URL(response.url);
    if(response.ok&&actualUrl.origin===url.origin&&actualUrl.pathname===url.pathname&&Buffer.from(await response.arrayBuffer()).equals(expected)){matched=true;break;}
   }catch{}
   if(attempt+1<attempts)await new Promise(resolve=>setTimeout(resolve,delayMs));
  }
  if(!matched)throw new Error(`Public deployment did not match ${pathname}`);
  results.push({path:pathname,bytes:expected.length,sha256:createHash('sha256').update(expected).digest('hex')});
 }
 return results;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  console.log(JSON.stringify(await verifyHostedSite({root,baseUrl:pkg.homepage})));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
