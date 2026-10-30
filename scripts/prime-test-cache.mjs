import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// npm ci fetches locked tarballs, but not all registry metadata needed by a
// separate offline tarball consumer. Prime that metadata before isolated gates.
const {dependencies}=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const prefix=fs.mkdtempSync(path.join(os.tmpdir(),'apk-test-cache-'));
try {
  fs.writeFileSync(path.join(prefix,'package.json'),JSON.stringify({private:true,dependencies}));
  const result=spawnSync('npm',['install','--prefix',prefix,'--ignore-scripts','--no-audit','--no-fund'],{stdio:'inherit',timeout:120000});
  if(result.error)throw result.error;
  if(result.status!==0)process.exitCode=result.status??1;
  else console.log('Prepared dependency cache for offline tarball acceptance.');
} finally {
  fs.rmSync(prefix,{recursive:true,force:true});
}
