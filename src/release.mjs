import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validatePolicy} from './policy.mjs';

export const PACKAGE_VERSION=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const PRESETS=Object.freeze([{id:'fast',label:'Light',description:'Light models for every role. Limits last longest.'},{id:'balanced',label:'Standard',description:'Stronger models for code, review, tests and docs. Fits most plans.'},{id:'quality',label:'Top-tier',description:'High-end models for most roles. Uses limits fastest.',topModels:Object.freeze({chatgpt:Object.freeze({model:'gpt-6-astra',effort:'high'}),claude:Object.freeze({model:'claude-opus-5-5',effort:'xhigh'}),kimi:Object.freeze({model:'kimi-code/k3.1-pro',effort:'high'})})}].map(Object.freeze));
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
