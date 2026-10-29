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
const names = new Set(files.map(file => file.path));
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version;
for (const file of files) {
  if (file.size > 1024 * 1024 || /(?:^|\/)(?:\.agent-work|\.superpowers|\.idea|artifacts|test|node_modules)(?:\/|$)|\.test\.|\.tgz$/.test(file.path)) throw new Error('Unexpected package content');
  if (file.path.endsWith('.png')) continue;
  const text = fs.readFileSync(path.join(root, file.path), 'utf8');
  if (/\/Users\/|\/home\/[A-Za-z0-9_-]+\/|(?:sk-proj-|sk-ant-api|ghp_)[A-Za-z0-9_-]{15,}/.test(text)) throw new Error('Potential private data in package');
  if (file.path.endsWith('.json')) JSON.parse(text);
  if (file.path.endsWith('.md')) for (const [, link] of text.matchAll(/\]\(([^)]+)\)/g)) {
    if (link.startsWith('https://unpkg.com/agent-policy-kit@')) {
      if (!link.startsWith(`https://unpkg.com/agent-policy-kit@${version}/`) || !names.has(link.split(`@${version}/`)[1])) throw new Error('Invalid versioned package link');
    } else if (!/^[a-z]+:|^#/i.test(link) && !names.has(path.posix.normalize(path.posix.join(path.posix.dirname(file.path), link.split('#')[0])))) {
      throw new Error(`Missing packaged documentation link in ${file.path}`);
    }
  }
}
console.log(`PASS: policy, JavaScript syntax and ${files.length} package files checked.`);
