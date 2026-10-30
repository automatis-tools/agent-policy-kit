import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const tests = fs.readdirSync('test').filter(f => f.endsWith('.test.mjs') && !f.includes('package')).map(f => `test/${f}`);
const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
