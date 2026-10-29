import test from 'node:test';
import assert from 'node:assert/strict';
import { parseToml, setTomlValue, restoreTomlValue, appendTomlHook, removeTomlHook } from '../src/toml.mjs';

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

test('Kimi hook tables append without touching native model pool and uninstall by AST ownership', () => {
  const original = '[secondary_model.models."subagent-code"]\nmodel = "provider/code"\n';
  const entry = {event:'PreToolUse',matcher:'^(Agent|AgentSwarm)$',command:"'node' '/space and quote/cli.mjs'",timeout:10};
  const result = appendTomlHook(original, entry);
  assert.ok(result.text.startsWith(original));
  assert.deepEqual(parseToml(result.text).hooks, [entry]);
  const later = result.text + '\n[[hooks]]\nevent = "Stop"\ncommand = "echo later"\n';
  const undone = removeTomlHook(later, result.ownership);
  assert.equal(parseToml(undone).hooks.length, 1);
  assert.equal(parseToml(undone).hooks[0].command, 'echo later');
  assert.ok(undone.startsWith(original));
});

test('owned Kimi hook rejects nested table drift rather than transferring it to an earlier hook', () => {
  for (const suffix of ['[hooks.extra]\nuser_value = 123\n','[[hooks.extra]]\nuser_value = 123\n','[hooks."quoted.extra"]\nuser_value = 123\n']) {
    const original = '[[hooks]]\nevent = "Stop"\ncommand = "user"\n';
    const entry = {event:'PreToolUse',matcher:'^(Agent|AgentSwarm)$',command:'owned',timeout:10};
    const result = appendTomlHook(original,entry);
    const changed = result.text + '\n' + suffix;
    assert.throws(()=>removeTomlHook(changed,result.ownership),{code:'OWNED_DRIFT'});
  }
});
