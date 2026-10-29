import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const template = fs.readFileSync(new URL('../site/template.html', import.meta.url), 'utf8');
const preferences = JSON.parse(fs.readFileSync(new URL('../policies/balanced.json', import.meta.url), 'utf8'));
const release = {version: '0.1.0', preferences, notes: 'A release.', unreleased: true};
const script = template.match(/<script>([\s\S]*?)<\/script>/)[1].replace('__APK_RELEASE_DATA__', JSON.stringify(release));
const context = vm.createContext({TextEncoder, btoa});
vm.runInContext(script, context);
const api = context.APKConfigurator;
const plain = value => JSON.parse(JSON.stringify(value));

test('configuration template has a single release marker and no external assets or network calls', () => {
  assert.equal(template.split('__APK_RELEASE_DATA__').length, 2);
  assert.doesNotMatch(template, /<(?:script|link|img)[^>]+(?:src|href)=/i);
  assert.doesNotMatch(script, /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/);
});

test('recommendations expose four independent jobs and preserve native fallbacks', () => {
  const state = api.initialState(preferences);
  const {config, errors} = plain(api.buildConfig(state, preferences));
  assert.deepEqual(errors, []);
  assert.deepEqual(Object.keys(config.clients), ['codex', 'claude', 'kimi', 'agy']);
  assert.deepEqual(Object.keys(config.clients.codex.roles), ['worker', 'reviewer', 'explorer', 'routine']);
  assert.deepEqual(config.clients.codex.code, preferences.clients.codex.code);
  assert.deepEqual(config.clients.kimi.light, preferences.clients.kimi.light);
  assert.deepEqual(config.clients.agy.roles.worker, {model: 'pro', effort: null});
  state.jobs.codex.reviewer.model = 'custom/review:1';
  assert.equal(state.jobs.codex.worker.model, preferences.clients.codex.code.model);
});

test('selected tools and explicit model choices determine the payload', () => {
  const state = api.initialState(preferences);
  state.selected = ['claude'];
  state.maxConcurrent = '7';
  state.jobs.claude.reviewer = {model: 'opus', effort: 'medium'};
  const {config, errors} = plain(api.buildConfig(state, preferences));
  assert.deepEqual(errors, []);
  assert.deepEqual(Object.keys(config.clients), ['claude']);
  assert.equal(config.maxConcurrent, 7);
  assert.equal(config.clients.claude.roles.reviewer.model, 'opus');
  assert.ok(!config.clients.claude.avoidModels.includes('opus'));
  assert.deepEqual(config.clients.claude.code, preferences.clients.claude.code);
});

test('native role recommendations override code/light defaults', () => {
  const custom = structuredClone(preferences);
  custom.clients.codex.roles = {reviewer: {model: 'review/custom', effort: 'medium'}};
  const state = api.initialState(custom);
  assert.equal(state.jobs.codex.reviewer.model, 'review/custom');
  assert.equal(state.jobs.codex.worker.model, custom.clients.codex.code.model);
});

test('Kimi aliases require consistent effective effort but unused base defaults do not constrain them', () => {
  const state = api.initialState(preferences);
  for (const role of ['worker', 'reviewer', 'explorer', 'routine']) state.jobs.kimi[role] = {model: 'kimi-code/k3', effort: 'low'};
  assert.deepEqual(plain(api.buildConfig(state, preferences)).errors, []);
  state.jobs.kimi.reviewer.effort = 'high';
  const invalid = plain(api.buildConfig(state, preferences));
  assert.equal(invalid.config, null);
  assert.match(invalid.errors.join(' '), /different effort/);
  state.jobs.kimi.reviewer = {model: 'primary', effort: 'low'};
  assert.match(plain(api.buildConfig(state, preferences)).errors.join(' '), /explicit model alias/);
});

test('bad input cannot leave a usable configuration', () => {
  for (const model of ['', 'bad model', 'x;echo', '$(id)', 'x`id`', 'é', '-bad', 'a'.repeat(129)]) {
    const state = api.initialState(preferences);
    state.jobs.codex.worker.model = model;
    const invalid = api.buildConfig(state, preferences);
    assert.equal(invalid.config, null, model);
    assert.ok(invalid.errors.length, model);
  }
  for (const maxConcurrent of ['', '1.2', 'NaN', '0', '33']) {
    const state = api.initialState(preferences); state.maxConcurrent = maxConcurrent;
    assert.equal(api.buildConfig(state, preferences).config, null, maxConcurrent);
  }
  const state = api.initialState(preferences); state.selected = [];
  assert.equal(api.buildConfig(state, preferences).config, null);
});

test('agy accepts native tiers without invented per-role effort', () => {
  const state = api.initialState(preferences);
  state.jobs.agy.reviewer = {model: 'inherit', effort: null};
  assert.deepEqual(plain(api.buildConfig(state, preferences)).errors, []);
  state.jobs.agy.reviewer.effort = 'high';
  assert.equal(api.buildConfig(state, preferences).config, null);
  state.jobs.agy.reviewer = {model: 'custom-model', effort: null};
  assert.equal(api.buildConfig(state, preferences).config, null);
});

test('command is version pinned, shell safe, and decodes to the chosen UTF-8 JSON', () => {
  const config = api.buildConfig(api.initialState(preferences), preferences).config;
  const command = api.buildCommand(config, release);
  assert.match(command, /^npx --yes --ignore-scripts --package agent-policy-kit@0\.1\.0 agent-policy setup --config ([A-Za-z0-9_-]+) --apply$/);
  const payload = command.match(/--config ([A-Za-z0-9_-]+)/)[1];
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')), plain(config));
  assert.throws(() => api.buildCommand(config, {...release, version: '0.1.0;echo'}), /invalid release/);
  assert.equal(Buffer.from(api.encodeConfig({note: 'Привіт'}), 'base64url').toString('utf8'), JSON.stringify({note: 'Привіт'}));
});
