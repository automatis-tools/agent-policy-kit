import fs from 'node:fs';
import path from 'node:path';
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
    catch (e) {
      if (e.code !== 'ENOENT') throw e;
      try { fs.mkdirSync(cursor, { mode: 0o700 }); }
      catch (created) {
        if (created.code !== 'EEXIST' || !fs.lstatSync(cursor).isDirectory() || fs.lstatSync(cursor).isSymbolicLink()) throw created;
      }
    }
  }
}
function safeFile(file, maxBytes) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) error();
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.ino !== stat.ino || opened.dev !== stat.dev || opened.size > maxBytes) error();
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}
const numeric = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
function sanitize(raw, policy) {
  if (!raw || !CLIENTS.includes(raw.client)) error();
  const models = publicModels(policy, raw.client);
  const config = policy.clients[raw.client];
  const role = typeof raw.role === 'string' ? raw.role.split(':').at(-1) : null;
  const knownRole = Object.values(config?.profiles ?? {}).some(p => p.roles.includes(role));
  const model = value => value == null ? null : (models.includes(value) ? value : 'unrecognized');
  return {
    schemaVersion: 1, timestamp: new Date().toISOString(), client: raw.client,
    action: actions.includes(raw.action) ? raw.action : 'unsupported', reason: reasons.includes(raw.reason) ? raw.reason : 'unsupported_event',
    enforced: raw.enforced === true, role: knownRole ? role : 'other',
    profile: typeof raw.profile === 'string' && Object.hasOwn(config?.profiles ?? {}, raw.profile) ? raw.profile : null,
    requestedModel: model(raw.requestedModel), reportedModel: model(raw.reportedModel), expectedModel: model(raw.expectedModel),
    source: sources.includes(raw.source) ? raw.source : 'unavailable',
    requestedEffort: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(raw.requestedEffort) ? raw.requestedEffort : null,
    tokens: { input: numeric(raw.tokens?.input), output: numeric(raw.tokens?.output), cached: numeric(raw.tokens?.cached) },
  };
}
export function appendRecord(stateDir, raw, policy) {
  privateDir(stateDir);
  const record = sanitize(raw, policy);
  const line = Buffer.from(JSON.stringify(record) + '\n');
  if (line.length > 4096) error();
  const file = path.join(stateDir, 'audit.jsonl');
  const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND | (fs.constants.O_NOFOLLOW ?? 0), 0o600);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || (process.platform !== 'win32' && (stat.mode & 0o077))) error();
    // One bounded O_APPEND write per record on a local filesystem.
    if (fs.writeSync(fd, line) !== line.length) error();
  } finally { fs.closeSync(fd); }
  return file;
}
export function readRecords(stateDir, policy) {
  if (!fs.existsSync(stateDir)) return [];
  privateDir(stateDir);
  const file = path.join(stateDir, 'audit.jsonl');
  if (!fs.existsSync(file)) return [];
  const lines = safeFile(file, 16 * 1024 * 1024).toString('utf8').split('\n').filter(Boolean);
  const fields = ['schemaVersion', 'timestamp', 'client', 'action', 'reason', 'enforced', 'role', 'profile',
    'requestedModel', 'reportedModel', 'expectedModel', 'source', 'requestedEffort', 'tokens'];
  return lines.map(line => {
    if (Buffer.byteLength(line) > 4096) error();
    const record = JSON.parse(line);
    if (!record || typeof record !== 'object' || Array.isArray(record) || Object.keys(record).some(k => !fields.includes(k))
      || record.schemaVersion !== 1 || !CLIENTS.includes(record.client) || !actions.includes(record.action)
      || !reasons.includes(record.reason) || !sources.includes(record.source) || typeof record.enforced !== 'boolean'
      || typeof record.timestamp !== 'string' || !/^\d{4}-\d\d-\d\dT[0-9:.]+Z$/.test(record.timestamp)) error();
    if (!record.tokens || typeof record.tokens !== 'object' || Array.isArray(record.tokens)
      || Object.keys(record.tokens).some(k => !['input', 'output', 'cached'].includes(k))
      || !['input', 'output', 'cached'].every(k => record.tokens[k] === null || numeric(record.tokens[k]) !== null)) error();
    if (record.requestedEffort !== null && !['low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(record.requestedEffort)) error();
    if (policy) {
      const models = publicModels(policy, record.client);
      for (const key of ['requestedModel', 'reportedModel', 'expectedModel']) if (record[key] !== null && !models.includes(record[key])) record[key] = 'unrecognized';
      const config = policy.clients[record.client];
      if (!Object.values(config?.profiles ?? {}).some(p => p.roles.includes(record.role))) record.role = 'other';
      if (record.profile !== null && !Object.hasOwn(config?.profiles ?? {}, record.profile)) record.profile = null;
    }
    return record;
  });
}
export function publicSummary(records) {
  const groups = new Map();
  for (const record of records) {
    if (!record || !CLIENTS.includes(record.client) || !actions.includes(record.action)) error();
    // Do not re-export stored arbitrary strings, even if a local file was edited.
    const key = `${record.client}:${record.action}`;
    const group = groups.get(key) ?? { client: record.client, action: record.action, records: 0, inputTokens: null, outputTokens: null, missingTokenRecords: 0 };
    group.records++;
    const input = numeric(record.tokens?.input); const output = numeric(record.tokens?.output);
    if (input !== null) group.inputTokens = (group.inputTokens ?? 0) + input;
    if (output !== null) group.outputTokens = (group.outputTokens ?? 0) + output;
    if (input === null && output === null) group.missingTokenRecords++;
    groups.set(key, group);
  }
  return { schemaVersion: 1, records: records.length, groups: [...groups.values()] };
}
