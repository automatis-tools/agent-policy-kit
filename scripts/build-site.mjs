import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundledReleaseInfo,presetPreferences,modelCatalog} from '../src/release.mjs';
import {validatePolicy} from '../src/policy.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const template=fs.readFileSync(path.join(root,'site/template.html'),'utf8');
const marker='__APK_RELEASE_DATA__';
if(template.split(marker).length!==2)throw new Error('Configuration page must have one release-data marker');
const release=bundledReleaseInfo();
const preferences=validatePolicy(JSON.parse(fs.readFileSync(path.join(root,'policies/balanced.json'),'utf8')));
const data={...release,packageSpec:`agent-policy-kit@${release.version}`,preferences,
  presets:release.presets.map(preset=>({...preset,preferences:presetPreferences(preset.id)})),catalog:modelCatalog(),
  unreleased:release.notes.includes(`## ${release.version} — Unreleased`)};
// Embed the font and its license so the release page remains a single offline file.
const font=fs.readFileSync(path.join(root,'site/fonts/public-sans-latin.woff2')).toString('base64');
const fontLicense=fs.readFileSync(path.join(root,'site/fonts/public-sans-OFL.txt'),'utf8').trim();
const html=template
  .replace('__APK_FONT_DATA__',()=>font)
  .replace('__APK_FONT_LICENSE__',()=>fontLicense)
  .replace(marker,()=>JSON.stringify(data).replaceAll('<','\\u003c'));
const destination=path.join(root,'site/index.html');
if(process.argv.includes('--check')){
  if(!fs.existsSync(destination)||fs.readFileSync(destination,'utf8')!==html)throw new Error('Configuration page is stale; run npm run build:site');
}else fs.writeFileSync(destination,html);
console.log(process.argv.includes('--check')?'PASS: configuration page matches release.':'Built self-contained configuration page.');
