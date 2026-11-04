import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the CLI package delegates its web UI and publication to getacc.dev', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.homepage, 'https://getacc.dev/tools/agent-policy-kit/');
  assert.ok(!pkg.files.some(file => file.startsWith('site/')));
  assert.equal(pkg.scripts['build:site'], undefined);
  assert.equal(pkg.scripts['build:host'], undefined);
  assert.equal(fs.existsSync(new URL('../site/template.html', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../.github/workflows/deploy-site.yml', import.meta.url)), false);
});
