import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

// Routing is a separate, explicitly authorized infrastructure operation. A CI
// asset token only needs Workers Scripts edit; existing domain bindings stay.
export function siteDeploymentConfig(config,root){
 const allowed=['$schema','name','compatibility_date','workers_dev','preview_urls','assets','routes','route'];
 if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(key=>!allowed.includes(key))||config.name!=='agent-policy-kit'||typeof config.compatibility_date!=='string'||!/^\d{4}-\d\d-\d\d$/.test(config.compatibility_date)||config.workers_dev!==true||config.preview_urls!==false)throw new Error('Unsupported website deployment configuration.');
 const assets=config.assets;
 if(!assets||typeof assets!=='object'||Array.isArray(assets)||Object.keys(assets).some(key=>!['directory','html_handling','not_found_handling'].includes(key))||assets.directory!=='./dist')throw new Error('Website deployment must use the generated dist directory.');
 return {name:config.name,compatibility_date:config.compatibility_date,workers_dev:config.workers_dev,preview_urls:config.preview_urls,assets:{...assets,directory:path.join(path.resolve(root),'dist')}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),destination=path.join(root,'.agent-work/ci-wrangler.json');
  const {experimental_readRawConfig}=createRequire(import.meta.url)('wrangler');
  const {rawConfig}=experimental_readRawConfig({config:path.join(root,'wrangler.jsonc')},{useConfigRedirectIfAvailable:false});
  const config=siteDeploymentConfig(rawConfig,root);
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(config,null,2)+'\n',{flag:'wx'});
  console.log('Prepared existing-worker static asset configuration.');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
