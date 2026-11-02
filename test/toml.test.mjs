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

// Issue #34: undo must give back the exact bytes, including the empty line before a table APK added and a line break APK added at the end.
const undoAll=(text,edits)=>edits.toReversed().reduce((value,edit)=>restoreTomlValue(value,edit.ownership),text);
function applyAll(text,targets) {
 const edits=[];
 for(const [target,value] of targets){const edit=setTomlValue(text,target,value);text=edit.text;edits.push(edit);}
 return {text,edits};
}
const grokTargets=[[['subagents','max_concurrent'],3],[['subagents','models','apk-worker'],'grok-4.7'],[['subagents','models','apk-reviewer'],'grok-4.5'],[['subagents','models','general-purpose'],'grok-4.7']];
const originals=['# user grok settings\nmodel = "main-grok"\n[subagents]\nenabled = true\n','# user grok settings\nmodel = "main-grok"\n','model = "main-grok"','model = "main-grok"\n\n','[subagents]','[subagents]\nenabled = true','# user\r\nmodel = "main-grok"\r\n','','\n# only a comment\n'];

test('removing a table APK added also removes the empty line APK wrote before it',()=>{
 for(const original of originals){
  const {text,edits}=applyAll(original,grokTargets);
  assert.equal(parseToml(text).subagents.models['apk-worker'],'grok-4.7');
  assert.equal(undoAll(text,edits),original,JSON.stringify(original));
 }
});

test('a replacing edit on top of an undone baseline restores the original bytes',()=>{
 for(const original of originals){
  let current=applyAll(original,grokTargets);
  for(const value of ['grok-build-0.1','grok-4.6']){
   const baseline=undoAll(current.text,current.edits);assert.equal(baseline,original,JSON.stringify(original));
   current=applyAll(baseline,grokTargets.map(([target,old])=>[target,typeof old==='number'?old+1:value]));
  }
  assert.equal(undoAll(current.text,current.edits),original,JSON.stringify(original));
 }
});

test('a line break APK added is recorded only when the file did not end with one',()=>{
 assert.equal(setTomlValue('model = "main"\n',['agents','max'],3).ownership.addedLineBreak,undefined);
 assert.equal(setTomlValue('[agents]\nx = 1\n',['agents','max'],3).ownership.addedLineBreak,undefined);
 assert.equal(setTomlValue('',['agents','max'],3).ownership.addedLineBreak,undefined);
 assert.equal(setTomlValue('model = "main"',['agents','max'],3).ownership.addedLineBreak,true);
 assert.equal(setTomlValue('[agents]',['agents','max'],3).ownership.addedLineBreak,true);
 // Content added later after the owned lines keeps the line break, because TOML needs it between statements.
 const edit=setTomlValue('model = "main"',['agents','max'],3);
 assert.equal(restoreTomlValue(edit.text+'\n[later]\nx = 1\n',edit.ownership),'model = "main"\n\n[later]\nx = 1\n');
});

test('ownership written before 0.5.2 has no line break record and still restores the empty line',()=>{
 // Releases 0.3.0 to 0.5.1 wrote the same file bytes and the same ownership, without addedLineBreak.
 const legacy=edit=>{const ownership={...edit.ownership};delete ownership.addedLineBreak;return {...edit,ownership};};
 for(const original of originals){
  const {text,edits}=applyAll(original,grokTargets),restored=undoAll(text,edits.map(legacy));
  assert.equal(restored,original.length&&!original.endsWith('\n')?original+'\n':original,JSON.stringify(original));
 }
});

test('the empty line before an added table stays while the user keeps a key in that table',()=>{
 const edit=setTomlValue('model = "main"\n',['agents','max'],3),later=edit.text+'mine = 1\n';
 assert.equal(restoreTomlValue(later,edit.ownership),'model = "main"\n\n[agents]\nmine = 1\n');
});
