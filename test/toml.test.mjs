import test from 'node:test';
import assert from 'node:assert/strict';
import { parseToml, setTomlValue, restoreTomlValue, removeTomlValue } from '../src/toml.mjs';

test('scalar updates preserve quoted keys, comments, multiline strings and unrelated bytes', () => {
  const input = '# secret comment\nmodel = "main"\ntext = """hello\n[agents]\nworld"""\n["agents"]\n"max_threads" = 12 # retain\n';
  const result = setTomlValue(input, ['agents', 'max_threads'], 3);
  assert.equal(result.text, input.replace('12 # retain', '3 # retain'));
  assert.equal(parseToml(result.text).agents.max_threads, 3);
  assert.equal(restoreTomlValue(result.text + '# new edit\n', result.ownership), input + '# new edit\n');
});

test('new values are surgically added and removed while preserving later table edits', () => {
  const changed = setTomlValue('model = "main"\n', ['agents', 'max_threads'], 3);
  const later = changed.text + 'max_depth = 1 # user\n';
  const undone = restoreTomlValue(later, changed.ownership);
  assert.equal(parseToml(undone).agents.max_depth, 1);
  assert.equal(parseToml(undone).agents.max_threads, undefined);
  assert.match(undone, /# user/);
});

test('owned scalar drift, malformed TOML and unsupported inline tables fail safely', () => {
  const result = setTomlValue('[agents]\nmax_threads = 12\n', ['agents', 'max_threads'], 3);
  assert.throws(() => restoreTomlValue(result.text.replace('= 3', '= 4'), result.ownership), {code:'OWNED_DRIFT'});
  assert.throws(() => setTomlValue('[broken', ['agents', 'max_threads'], 3), {code:'INVALID_TOML'});
  assert.throws(() => setTomlValue('agents = { max_threads = 8 }\n', ['agents', 'max_threads'], 3), {code:'UNSUPPORTED_TOML_STRUCTURE'});
});

test('section-wide effort removal is owned, reversible, and refuses replacement drift',()=>{
 const original='[secondary_model]\ndefault_effort = "high" # user default\ndefault_model = "code"\n';
 const edit=removeTomlValue(original,['secondary_model','default_effort']);assert.equal(parseToml(edit.text).secondary_model.default_effort,undefined);assert.equal(parseToml(edit.text).secondary_model.default_model,'code');
 assert.deepEqual(parseToml(restoreTomlValue(edit.text+'# later\n',edit.ownership)),parseToml(original));
 assert.throws(()=>restoreTomlValue(edit.text+'default_effort = "low"\n',edit.ownership),{code:'OWNED_DRIFT'});
});
