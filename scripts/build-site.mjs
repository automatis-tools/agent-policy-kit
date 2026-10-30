import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundledReleaseInfo,presetPreferences,modelCatalog} from '../src/release.mjs';
import {validatePolicy} from '../src/policy.mjs';
import {ROLE_DEFINITIONS} from '../src/roles.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function publicUrl(value){
  let url;
  try {if(typeof value!=='string'||value.length>2048)throw new Error();url=new URL(value);}catch {throw new Error('Site metadata requires a public HTTPS URL.');}
  if(url.protocol!=='https:'||url.username||url.password)throw new Error('Site metadata requires a public HTTPS URL.');
  return url.href;
}
if(!pkg.author||typeof pkg.author!=='object'||typeof pkg.author.name!=='string'||!pkg.author.name.trim()||pkg.author.name.length>200)throw new Error('Package author requires a name and profile URL.');
const authorName=pkg.author.name.trim(),authorUrl=publicUrl(pkg.author.url);
const repository=typeof pkg.repository==='string'?pkg.repository:pkg.repository?.url;
const repositoryUrl=publicUrl(repository?.replace(/^git\+/,'').replace(/\.git$/,''));
const homeUrl=publicUrl(pkg.homepage);
const relatedProjects=[
  {name:'Agents Can Communicate',url:'https://github.com/automatis-tools/agents-can-communicate'},
  {name:'Automatis Skills',url:'https://github.com/automatis-tools/automatis-skills'}
];
const template=fs.readFileSync(path.join(root,'site/template.html'),'utf8');
const marker='__APK_RELEASE_DATA__';
const release=bundledReleaseInfo();
const canonicalUrl=new URL(`/v/${release.version}/`,homeUrl).href;
const authorId=authorUrl+'#person',projectId=repositoryUrl+'#software';
const title=`Agent Policy Kit — by ${authorName}`;
const description=`Configure local subagent roles, models and effort with Agent Policy Kit, an open source tool by ${authorName}.`;
const structuredData={'@context':'https://schema.org','@graph':[
  {'@type':'Person','@id':authorId,name:authorName,url:authorUrl},
  {'@type':'SoftwareSourceCode','@id':projectId,name:'Agent Policy Kit',description:pkg.description,url:new URL('/',homeUrl).href,codeRepository:repositoryUrl,author:{'@id':authorId}},
  {'@type':'WebPage','@id':canonicalUrl+'#webpage',name:title,url:canonicalUrl,author:{'@id':authorId},mainEntity:{'@id':projectId},mentions:relatedProjects.map(project=>({'@type':'SoftwareSourceCode',name:project.name,codeRepository:project.url}))}
]};
const attribution=`<span>Created by <a rel="author" href="${escapeHtml(authorUrl)}">${escapeHtml(authorName)}</a></span><nav aria-label="Related projects"><span>More tools:</span>${relatedProjects.map(project=>`<a href="${escapeHtml(project.url)}">${escapeHtml(project.name)}</a>`).join(' ')}</nav>`;
const metadata={__APK_TITLE__:escapeHtml(title),__APK_DESCRIPTION__:escapeHtml(description),__APK_AUTHOR_NAME__:escapeHtml(authorName),__APK_AUTHOR_URL__:escapeHtml(authorUrl),__APK_CANONICAL_URL__:escapeHtml(canonicalUrl),__APK_STRUCTURED_DATA__:JSON.stringify(structuredData).replaceAll('<','\\u003c'),__APK_ATTRIBUTION__:attribution};
const preferences=validatePolicy(JSON.parse(fs.readFileSync(path.join(root,'policies/balanced.json'),'utf8')));
const data={...release,packageSpec:`agent-policy-kit@${release.version}`,preferences,
  presets:release.presets.map(preset=>({...preset,preferences:presetPreferences(preset.id)})),catalog:modelCatalog(),roles:ROLE_DEFINITIONS,
  unreleased:release.notes.includes(`## ${release.version} — Unreleased`)};
// Embed the font and its license so the release page remains a single offline file.
const font=fs.readFileSync(path.join(root,'site/fonts/public-sans-latin.woff2')).toString('base64');
const fontLicense=fs.readFileSync(path.join(root,'site/fonts/public-sans-OFL.txt'),'utf8').trim();
const replacements={...metadata,
  __APK_EXPLICIT_CODEC__:fs.readFileSync(path.join(root,'src/explicit.mjs'),'utf8').replace(/^export /gm,''),
  __APK_SHARE_CODEC__:fs.readFileSync(path.join(root,'src/share.mjs'),'utf8').replace(/^export /gm,''),
  __APK_BASE_CSS__:fs.readFileSync(path.join(root,'site/base.css'),'utf8'),
  __APK_FONT_DATA__:font,__APK_FONT_LICENSE__:fontLicense,
  [marker]:JSON.stringify(data).replaceAll('<','\\u003c')
};
for(const key of Object.keys(replacements))if(template.split(key).length!==2)throw new Error(`Configuration page must have one ${key} marker`);
// Replace original template slots once; inserted text stays data, even if it
// contains another slot name or String.replace replacement syntax.
const html=template.replace(new RegExp(Object.keys(replacements).join('|'),'g'),key=>replacements[key]);
const destination=path.join(root,'site/index.html');
if(process.argv.includes('--check')){
  if(!fs.existsSync(destination)||fs.readFileSync(destination,'utf8')!==html)throw new Error('Configuration page is stale; run npm run build:site');
}else fs.writeFileSync(destination,html);
console.log(process.argv.includes('--check')?'PASS: configuration page matches release.':'Built self-contained configuration page.');
