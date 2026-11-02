import { parseForESLint, getStaticTOMLValue } from 'toml-eslint-parser';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';

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
function statementRange(text, node) {
  const startLine = text.lastIndexOf('\n', node.range[0] - 1) + 1;
  const start = /^\s*$/.test(text.slice(startLine, node.range[0])) ? startLine : node.range[0];
  const end = endLine(text, node.range[1]);
  const tail = text.slice(node.range[1], end);
  return [start, /^\s*$/.test(tail) ? end : node.range[1]];
}
function removeStatement(text, node) { return replace(text, ...statementRange(text, node), ''); }
// setTomlValue writes one empty line before a table that it adds. Return the start of that line, or `start` when the line before is not empty.
// The separator that setTomlValue wrote before a table uses the same line ending as the table header.
// Among the empty lines directly before the header, remove the nearest one with that line ending,
// so an empty line that the user added with another line ending stays.
function separatorBefore(text, start, ending) {
  let at = start;
  while (at > 0) {
    const previous = at < 2 ? 0 : text.lastIndexOf('\n', at - 2) + 1, line = text.slice(previous, at);
    if (!/^\r?\n$/.test(line)) return null;
    if (line === ending) return [previous, at];
    at = previous;
  }
  return null;
}
// A hash identifies the last line that got an added line break without keeping config text in the receipt.
const lineHash = line => createHash('sha256').update(line).digest('hex');

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
    if (separator) ownership.addedLineBreak = lineHash(text.slice(text.lastIndexOf('\n') + 1));
    text = replace(text, at, at, separator + entry);
  } else if (tablePath.length === 0) {
    text = entry + text;
  } else {
    const prefix = text.length && !text.endsWith('\n') ? nl : '';
    if (prefix) ownership.addedLineBreak = lineHash(text.slice(text.lastIndexOf('\n') + 1));
    text += `${prefix}${nl}[${tablePath.map(keyText).join('.')}]${nl}${entry}`;
    ownership.addedTable = tablePath;
  }
  ast(text);
  return {text,ownership};
}

export function restoreTomlValue(text, ownership) {
  const tree = ast(text);
  const found = locate(tree, ownership.path);
  if (ownership.kind === 'removed') {
    if (found) fail('OWNED_DRIFT');
    if (ownership.before === null) return text;
    const before = parseToml(`value = ${ownership.before}\n`).value;
    return setTomlValue(text,ownership.path,before).text;
  }
  if (!found || text.slice(...found.value.range) !== ownership.after) fail('OWNED_DRIFT');
  if (ownership.before !== null) return replace(text, ...found.value.range, ownership.before);
  let [start, end] = statementRange(text, found);
  text = replace(text, start, end, '');
  if (ownership.addedTable) {
    const table = ast(text).body[0].body.find(n => n.type === 'TOMLTable' && n.kind === 'standard' && same(n.resolvedKey, ownership.addedTable));
    if (table && table.body.length === 0) {
      // Remove the header and the empty line that setTomlValue wrote before it. Releases 0.3.0 to 0.5.1 wrote the same empty line.
      [start, end] = statementRange(text, table);
      const header = text.slice(start, end), ending = header.endsWith('\r\n') ? '\r\n' : header.endsWith('\n') ? '\n' : newline(text);
      const separator = separatorBefore(text, start, ending);
      if (separator && separator[1] === start) start = separator[0];
      text = replace(text, start, end, '');
      if (separator && separator[1] < start) { text = replace(text, separator[0], separator[1], ''); start -= separator[1] - separator[0]; }
    }
  }
  // setTomlValue ended a last line that had no line break. Remove that line break only when nothing follows
  // the removed lines and the file again ends with that same line, so a line the user added keeps its line break.
  if (typeof ownership.addedLineBreak === 'string' && start === text.length) {
    const nl = text.endsWith('\r\n') ? '\r\n' : '\n';
    if (text.endsWith(nl)) {
      const body = text.slice(0, -nl.length);
      if (lineHash(body.slice(body.lastIndexOf('\n') + 1)) === ownership.addedLineBreak) text = body;
    }
  }
  ast(text);
  return text;
}

export function removeTomlValue(text,target) {
  const tree=ast(text),found=locate(tree,target);
  if(!found)return {text,ownership:{kind:'removed',path:target,before:null}};
  const ownership={kind:'removed',path:target,before:text.slice(...found.value.range)};
  const result=removeStatement(text,found);
  ast(result);
  return {text:result,ownership};
}
