import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const html=fs.readFileSync(path.join(root,'site/index.html'),'utf8');
const destination=path.join(root,'dist');
// The allowlisted output contains only the public, self-contained page.
fs.mkdirSync(path.join(destination,'v',version),{recursive:true});
fs.writeFileSync(path.join(destination,'index.html'),html);
fs.writeFileSync(path.join(destination,'v',version,'index.html'),html);
fs.writeFileSync(path.join(destination,'_redirects'),`/ /v/${version}/ 302\n`);
fs.writeFileSync(path.join(destination,'_headers'),`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
/v/${version}/*
  Cache-Control: public, max-age=31536000, immutable
`);
console.log(`Built public page and versioned /v/${version}/ snapshot.`);
