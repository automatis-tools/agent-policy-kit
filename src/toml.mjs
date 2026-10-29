import { parseForESLint, getStaticTOMLValue } from 'toml-eslint-parser';
import { isDeepStrictEqual } from 'node:util';

function fail(code) { throw Object.assign(new Error(code), {code}); }
function ast(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 1024 * 1024) fail('INVALID_TOML');
  try { return parseForESLint(text, {tomlVersion:'1.0'}).ast; }
  catch { fail('INVALID_TOML'); }
}
export function parseToml(text) { return getStaticTOMLValue(ast(text)); }
const keys = key => key.keys.map(k => k.type === 'TOMLBare' ? k.name : k.value);
const same = (a, b) => isDeepStrictEqual(a, b);
const literal = value => {
  if (!['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isSafeInteger(value))) fail('UNSUPPORTED_TOML_VALUE');
  return JSON.stringify(value);
};
const keyText = key => /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
function locate(tree, target) {
  for (const node of tree.body[0].body) {
    const table = node.type === 'TOMLTable' ? node : null;
    for (const kv of table ? table.body : [node]) {
      if (kv.type !== 'TOMLKeyValue') continue;
      const full = [...(table?.resolvedKey ?? []), ...keys(kv.key)];
      if (same(full, target)) return kv;
      if (full.length < target.length && same(full, target.slice(0, full.length))) fail('UNSUPPORTED_TOML_STRUCTURE');
    }
  }
  return null;
}
function replace(text, start, end, value) { return text.slice(0, start) + value + text.slice(end); }
function newline(text) { return text.includes('\r\n') ? '\r\n' : '\n'; }
function endLine(text, position) { const i = text.indexOf('\n', position); return i === -1 ? text.length : i + 1; }
function removeStatement(text, node) {
  const startLine = text.lastIndexOf('\n', node.range[0] - 1) + 1;
  const start = /^\s*$/.test(text.slice(startLine, node.range[0])) ? startLine : node.range[0];
  const end = endLine(text, node.range[1]);
  const tail = text.slice(node.range[1], end);
  return replace(text, start, /^\s*$/.test(tail) ? end : node.range[1], '');
}

export function setTomlValue(text, target, value) {
  const tree = ast(text);
  const found = locate(tree, target);
  const after = literal(value);
  const ownership = {kind:'scalar',path:target,before:found ? text.slice(...found.value.range) : null,after};
  if (found) return {text:replace(text, ...found.value.range, after),ownership};
  const tablePath = target.slice(0, -1);
  const tables = tree.body[0].body.filter(n => n.type === 'TOMLTable');
  // Arrays of tables and inline/dotted parent definitions cannot be extended safely here.
  if (tables.some(n => n.kind === 'array' && same(n.resolvedKey.slice(0, tablePath.length), tablePath))) fail('UNSUPPORTED_TOML_STRUCTURE');
  const table = tables.find(n => n.kind === 'standard' && same(n.resolvedKey, tablePath));
  const nl = newline(text);
  const entry = `${keyText(target.at(-1))} = ${after}${nl}`;
  if (table) {
    const at = endLine(text, table.key.range[1]);
    const separator = at === text.length && !text.endsWith('\n') ? nl : '';
    text = replace(text, at, at, separator + entry);
  } else if (tablePath.length === 0) {
    text = entry + text;
  } else {
    const prefix = text.length && !text.endsWith('\n') ? nl : '';
    text += `${prefix}${nl}[${tablePath.map(keyText).join('.')}]${nl}${entry}`;
    ownership.addedTable = tablePath;
  }
  ast(text);
  return {text,ownership};
}

export function restoreTomlValue(text, ownership) {
  const tree = ast(text);
  const found = locate(tree, ownership.path);
  if (!found || text.slice(...found.value.range) !== ownership.after) fail('OWNED_DRIFT');
  if (ownership.before !== null) return replace(text, ...found.value.range, ownership.before);
  text = removeStatement(text, found);
  if (ownership.addedTable) {
    const table = ast(text).body[0].body.find(n => n.type === 'TOMLTable' && n.kind === 'standard' && same(n.resolvedKey, ownership.addedTable));
    if (table && table.body.length === 0) text = removeStatement(text, table);
  }
  ast(text);
  return text;
}

export function appendTomlHook(text, entry) {
  const parsed = parseToml(text);
  if (parsed.hooks !== undefined && !Array.isArray(parsed.hooks)) fail('UNSUPPORTED_TOML_STRUCTURE');
  if ((parsed.hooks ?? []).some(e => same(e, entry))) fail('OWNERSHIP_CONFLICT');
  const nl = newline(text);
  const block = `[[hooks]]${nl}` + Object.entries(entry).map(([k, v]) => `${keyText(k)} = ${literal(v)}${nl}`).join('');
  const result = text + (text.endsWith('\n') || !text ? '' : nl) + nl + block;
  ast(result);
  return {text:result,ownership:{kind:'hook',entry}};
}

export function removeTomlHook(text, ownership) {
  const tree = ast(text);
  const matches = tree.body[0].body.filter(n => n.type === 'TOMLTable' && n.kind === 'array' && same(n.resolvedKey.slice(0, -1), ['hooks']) && same(Object.fromEntries(n.body.map(kv => [keys(kv.key).join('.'), getStaticTOMLValue(kv.value)])), ownership.entry));
  if (matches.length !== 1) fail('OWNED_DRIFT');
  const table = matches[0];
  if (tree.body[0].body.some(n => n.type === 'TOMLTable' && n.resolvedKey.length > table.resolvedKey.length && same(n.resolvedKey.slice(0,table.resolvedKey.length),table.resolvedKey))) fail('OWNED_DRIFT');
  // Node ranges span exactly the owned table, not the following user's table.
  const result = removeStatement(text, table);
  ast(result);
  return result;
}
