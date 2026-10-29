import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validatePolicy } from '../src/policy.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
validatePolicy(JSON.parse(fs.readFileSync(path.join(root, 'policies/balanced.json'))));
for (const folder of ['src', 'bin', 'scripts']) for (const file of walk(path.join(root, folder)).filter(f => f.endsWith('.mjs'))) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status) process.exit(result.status);
}
const packed = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8' });
if (packed.status) { console.error('Package inspection failed.'); process.exit(1); }
const files = JSON.parse(packed.stdout)[0].files;
for (const file of files) {
  if (file.size > 1024 * 1024 || /(?:\.agent-work|\.superpowers|artifacts|\.tgz)(?:\/|$)/.test(file.path)) throw new Error('Unexpected package content');
  const text = fs.readFileSync(path.join(root, file.path), 'utf8');
  if (/\/Users\/|\/home\/[A-Za-z0-9_-]+\/|(?:sk-proj-|sk-ant-api|ghp_)[A-Za-z0-9_-]{15,}/.test(text)) throw new Error('Potential private data in package');
}
console.log(`PASS: policy, JavaScript syntax and ${files.length} package files checked.`);
