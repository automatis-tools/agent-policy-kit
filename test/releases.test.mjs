import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PACKAGE_VERSION,bundledReleaseInfo} from '../src/release.mjs';

test('one package version identifies its bundled configuration release and notes',()=>{
  const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url)));
  const release=bundledReleaseInfo();assert.equal(release.version,pkg.version);assert.equal(PACKAGE_VERSION,pkg.version);
  assert.equal(release.preset,'balanced');assert.match(release.preferencesHash,/^[a-f0-9]{64}$/);
  assert.match(release.notes,/Why this release/);assert.match(release.notes,new RegExp(pkg.version.replaceAll('.','\\.')));
});
test('release inspection is deterministic and does not select or execute a model',()=>{
  const a=bundledReleaseInfo(),b=bundledReleaseInfo();assert.deepEqual(a,b);
  assert.equal(a.schemaVersion,1);assert.equal(Object.hasOwn(a,'runtime'),false);
});
