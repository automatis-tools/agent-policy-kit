import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const page=()=>fs.readFileSync(path.join(root,'site/index.html'),'utf8');
function metadata(html){const match=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);assert.ok(match,'Static author/project metadata is present');return JSON.parse(match[1]);}

test('published page visibly credits the same person identified as project and page author',()=>{
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'))),html=page();
 assert.deepEqual(pkg.author,{name:'Mykola Maksymenko',url:'https://www.linkedin.com/in/nick-maximenko/'});
 const graph=metadata(html)['@graph'],person=graph.find(n=>n['@type']==='Person'),project=graph.find(n=>n['@type']==='SoftwareSourceCode'),webpage=graph.find(n=>n['@type']==='WebPage');
 assert.equal(person.name,pkg.author.name);assert.equal(person.url,pkg.author.url);assert.equal(project.author['@id'],person['@id']);assert.equal(webpage.author['@id'],person['@id']);
 assert.equal(project.codeRepository,'https://github.com/automatis-tools/agent-policy-kit');
 assert.equal(webpage.url,`https://agent-policy-kit.trymenow.io/v/${pkg.version}/`);
 assert.ok(html.includes(`rel="author" href="${pkg.author.url}">${pkg.author.name}</a>`));
 assert.ok(html.includes('<link rel="canonical" href="'+webpage.url+'">'));
 for(const repository of ['agents-can-communicate','automatis-skills'])assert.ok(html.includes(`href="https://github.com/automatis-tools/${repository}"`));
});

function fixture(t){
 const target=fs.mkdtempSync(path.join(os.tmpdir(),'apk-metadata-'));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 for(const name of ['package.json','CHANGELOG.md','src','policies','models','scripts','site'])fs.cpSync(path.join(root,name),path.join(target,name),{recursive:true});
 return target;
}
function build(target){return spawnSync(process.execPath,['scripts/build-site.mjs'],{cwd:target,encoding:'utf8',timeout:15000});}

test('author text remains inert in HTML and JSON-LD, including script terminators and replacement syntax',t=>{
 const target=fixture(t),file=path.join(target,'package.json'),pkg=JSON.parse(fs.readFileSync(file));
 const name='Mykola __APK_AUTHOR_URL__ <Maksymenko> "$&" </script><script>throw new Error("injected")</script>';
 pkg.author={name,url:'https://www.linkedin.com/in/nick-maximenko/'};fs.writeFileSync(file,JSON.stringify(pkg));
 const result=build(target);assert.equal(result.status,0,result.stderr);
 const html=fs.readFileSync(path.join(target,'site/index.html'),'utf8');assert.equal(metadata(html)['@graph'].find(n=>n['@type']==='Person').name,name);
 assert.equal([...html.matchAll(/<script(?:\s|>)/g)].length,2);
 assert.ok(html.includes('&lt;Maksymenko&gt;'));assert.ok(!html.includes('</script><script>throw new Error'));
 assert.ok(html.includes('<meta name="author" content="Mykola __APK_AUTHOR_URL__'));
 assert.ok(html.includes('<link rel="author" href="'+pkg.author.url+'">'));
});

test('unsafe author links fail the build instead of producing a clickable credential or script URL',t=>{
 const target=fixture(t),file=path.join(target,'package.json'),pkg=JSON.parse(fs.readFileSync(file));
 for(const url of ['javascript:alert(1)','https://user:secret@example.com/']){
  pkg.author={name:'Mykola Maksymenko',url};fs.writeFileSync(file,JSON.stringify(pkg));
  const result=build(target);assert.notEqual(result.status,0);assert.ok(!result.stderr.includes('user:secret'));
 }
});
