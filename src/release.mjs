import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validatePolicy} from './policy.mjs';

export const PACKAGE_VERSION=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const PRESETS=Object.freeze([{id:'fast',label:'Light',description:'Light models for every role. Makes plan limits last longest; suits entry plans and many parallel sessions.'},{id:'balanced',label:'Standard',description:'Stronger models for code, review and tests; light models for search and routine work. Fits most plans.'},{id:'quality',label:'Top-tier',description:'Strongest models at high effort for most roles; suits top plans with few parallel sessions. Top models are an opt-in.',topModels:Object.freeze({codex:'gpt-6-astra',claude:'claude-fable-5-1',kimi:'kimi-code/k3.1-pro'})}].map(Object.freeze));
export function presetPreferences(id='balanced'){
  if(!PRESETS.some(preset=>preset.id===id))throw Object.assign(new Error('Unknown preset.'),{code:'UNKNOWN_PRESET'});
  return validatePolicy(JSON.parse(fs.readFileSync(new URL(`../policies/${id}.json`,import.meta.url),'utf8')));
}
export function modelCatalog(){return JSON.parse(fs.readFileSync(new URL('../models/catalog.json',import.meta.url),'utf8'));}

export function bundledReleaseInfo(preset='balanced'){
  const preferences=presetPreferences(preset);
  return {schemaVersion:1,version:PACKAGE_VERSION,preset,presets:PRESETS,catalogReviewedAt:modelCatalog().reviewedAt,
    preferencesHash:createHash('sha256').update(JSON.stringify(canonical(preferences))).digest('hex'),
    notes:fs.readFileSync(new URL('../CHANGELOG.md',import.meta.url),'utf8')};
}
