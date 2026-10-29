import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CLIENTS, publicModels } from './policy.mjs';

const actions = ['allow', 'rewrite', 'deny', 'unsupported'];
const reasons = ['pin_profile', 'profile_allowed', 'model_not_allowed', 'effort_not_allowed', 'unsupported_client',
  'tier_not_model', 'invalid_input', 'invalid_policy', 'client_reported', 'model_unavailable', 'native_pool_binding_required',
  'native_binding_invalid', 'audit_unavailable', 'unsupported_event'];
const sources = ['requested', 'client_reported', 'provider_reported', 'unavailable'];
function error() { const e = new Error('Audit storage is unavailable or unsafe.'); e.code = 'audit_unavailable'; throw e; }
function privateDir(directory) {
  if (!path.isAbsolute(directory)) error();
  let cursor = path.parse(directory).root;
  for (const part of directory.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try { if (!fs.lstatSync(cursor).isDirectory() || fs.lstatSync(cursor).isSymbolicLink()) error(); }
    catch (e) { if (e.code === 'ENOENT') fs.mkdirSync(cursor, { mode: 0o700 }); else throw e; }
  }
}
function safeFile(file, maxBytes) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) error();
  return fs.readFileSync(file);
}
function salt(directory) {
  const file = path.join(directory, 'audit-salt');
  try {
    const fd = fs.openSync(file, 'wx', 0o600);
    try { fs.writeFileSync(fd, crypto.randomBytes(32)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  } catch (e) { if (e.code !== 'EEXIST') throw e; }
  for (let attempt = 0; attempt < 10; attempt++) {
    const value = safeFile(file, 32);
    if (value.length === 32) return value;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
  }
  error();
}
const numeric = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
function sanitize(raw, policy, key) {
  if (!raw || !CLIENTS.includes(raw.client)) error();
  const models = publicModels(policy, raw.client);
  const config = policy.clients[raw.client];
  const role = typeof raw.role === 'string' ? raw.role.split(':').at(-1) : null;
  const knownRole = Object.values(config?.profiles ?? {}).some(p => p.roles.includes(role));
  const model = value => value == null ? null : (models.includes(value) ? value : 'unrecognized');
  const hash = value => typeof value === 'string' && value.length <= 512
    ? crypto.createHmac('sha256', key).update(value).digest('hex').slice(0, 24) : null;
  return {
    schemaVersion: 1, timestamp: new Date().toISOString(), client: raw.client,
    kind: ['decision', 'observation', 'diagnostic'].includes(raw.kind) ? raw.kind : 'diagnostic',
    action: actions.includes(raw.action) ? raw.action : 'unsupported', reason: reasons.includes(raw.reason) ? raw.reason : 'unsupported_event',
    enforced: raw.enforced === true, role: knownRole ? role : 'other',
    profile: typeof raw.profile === 'string' && Object.hasOwn(config?.profiles ?? {}, raw.profile) ? raw.profile : null,
    requestedModel: model(raw.requestedModel), reportedModel: model(raw.reportedModel), expectedModel: model(raw.expectedModel),
    source: sources.includes(raw.source) ? raw.source : 'unavailable',
    requestedEffort: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(raw.requestedEffort) ? raw.requestedEffort : null,
    session: hash(raw.sessionId), agent: hash(raw.agentId),
    tokens: { input: numeric(raw.tokens?.input), output: numeric(raw.tokens?.output), cached: numeric(raw.tokens?.cached) },
  };
}
export function appendRecord(stateDir, raw, policy) {
  privateDir(stateDir);
  const directory = path.join(stateDir, 'audit'); privateDir(directory);
  const record = sanitize(raw, policy, salt(stateDir));
  const file = path.join(directory, `${Date.now()}-${crypto.randomUUID()}.json`);
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(record) + '\n', { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporary, file);
  return file;
}
export function readRecords(stateDir) {
  if (!fs.existsSync(stateDir)) return [];
  privateDir(stateDir);
  const directory = path.join(stateDir, 'audit');
  if (!fs.existsSync(directory)) return [];
  privateDir(directory);
  const names = fs.readdirSync(directory).filter(n => /^\d+-[a-f0-9-]+\.json$/.test(n)).sort();
  if (names.length > 100000) error();
  return names.map(name => JSON.parse(safeFile(path.join(directory, name), 4096)));
}
export function publicSummary(records) {
  const groups = new Map();
  for (const record of records) {
    if (!record || !CLIENTS.includes(record.client) || !actions.includes(record.action)) error();
    // Do not re-export stored arbitrary strings, even if a local file was edited.
    const key = `${record.client}:${record.action}`;
    const group = groups.get(key) ?? { client: record.client, action: record.action, records: 0, inputTokens: 0, outputTokens: 0 };
    group.records++; group.inputTokens += numeric(record.tokens?.input); group.outputTokens += numeric(record.tokens?.output);
    groups.set(key, group);
  }
  return { schemaVersion: 1, records: records.length, groups: [...groups.values()] };
}
