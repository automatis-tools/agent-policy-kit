import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validatePolicy} from './policy.mjs';

export const PACKAGE_VERSION=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const PRESETS=Object.freeze([{id:'fast',label:'Fast & economical',description:'For small, well-defined tasks. Lighter models, with extra reasoning for review and tests.'},{id:'balanced',label:'Balanced',description:'Stronger coding and verification, lighter exploration and mechanical work.'},{id:'quality',label:'Quality first',description:'For demanding implementation and verification. Prioritizes capability over response time and usage.'}].map(Object.freeze));
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
