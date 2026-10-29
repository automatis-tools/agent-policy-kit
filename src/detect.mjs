import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CLIENTS = ['codex','claude','kimi','agy'];
const OUTPUT_LIMIT = 65536;
const VERSION = String.raw`(\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[A-Za-z0-9][A-Za-z0-9.-]{0,63})?(?:\+[A-Za-z0-9][A-Za-z0-9.-]{0,63})?)`;
function failure(code) { return Object.assign(new Error(code),{code}); }
function options({env=process.env,hostHome=os.homedir(),timeoutMs=5000} = {}) {
  if (!env || typeof env !== 'object' || typeof hostHome !== 'string' || !path.isAbsolute(hostHome) || hostHome.includes('\0') || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw failure('INVALID_DETECTION_OPTIONS');
  return {env,hostHome:path.resolve(hostHome),timeoutMs};
}
function candidates(client,{env,hostHome}) {
  const dirs = typeof env.PATH === 'string' ? env.PATH.split(path.delimiter) : [];
  const names = process.platform === 'win32' ? [client + '.exe',client] : [client];
  const result = [];
  for (const dir of dirs) {
    // Never search the working directory through empty/relative PATH segments.
    if (!path.isAbsolute(dir) || dir.includes('\0')) continue;
    for (const name of names) result.push({file:path.join(dir,name),origin:'path'});
  }
  const conventional = client === 'kimi' ? ['.kimi-code/bin/kimi']
    : client === 'claude' ? ['.local/bin/claude','.claude/local/claude']
    : [`.local/bin/${client}`];
  for (const relative of conventional) result.push({file:path.join(hostHome,relative),origin:'known_location'});
  return result.filter((candidate,index) => result.findIndex(c=>c.file === candidate.file) === index);
}
async function inspect(file) {
  try {
    const executable = await fs.realpath(file);
    const stat = await fs.stat(executable);
    if (!stat.isFile()) return {status:'invalid'};
    await fs.access(executable,constants.X_OK);
    return {status:'executable',executable};
  } catch (error) {
    return {status:error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'not_found' : 'invalid'};
  }
}
function probe(executable,arg,{env,timeoutMs}) {
  return new Promise(resolve => {
    let child, timer, settled = false, size = 0;
    const ownGroup = process.platform !== 'win32';
    const buffers = [];
    const killOwned = () => {
      if (!child?.pid) return;
      try { if (ownGroup) process.kill(-child.pid,'SIGKILL'); else child.kill('SIGKILL'); } catch {}
    };
    const alive = () => {
      if (!child?.pid) return false;
      if (!ownGroup) return child.exitCode === null && child.signalCode === null;
      try { process.kill(-child.pid,0); return true; } catch (error) { return error.code !== 'ESRCH'; }
    };
    const finish = async (status) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      killOwned();
      child?.stdout?.destroy(); child?.stderr?.destroy();
      for (let elapsed = 0; alive() && elapsed < 500; elapsed += 20) await new Promise(done=>setTimeout(done,20));
      if (status === 'ok' && alive()) status = 'invalid';
      resolve({status,output:status === 'ok' ? Buffer.concat(buffers).toString('utf8') : ''});
    };
    try { child = spawn(executable,[arg],{env,stdio:['ignore','pipe','pipe'],shell:false,windowsHide:true,detached:ownGroup}); }
    catch { finish('invalid'); return; }
    timer = setTimeout(()=>finish('timeout'),timeoutMs);
    for (const stream of [child.stdout,child.stderr]) stream.on('data',chunk=>{
      size += chunk.length;
      if (size > OUTPUT_LIMIT) finish('invalid'); else buffers.push(chunk);
    });
    // A wrapper can exit successfully while descendants retain inherited pipes.
    // Its dedicated POSIX group remains ours; stop it before waiting for close.
    child.on('exit',killOwned);
    child.on('error',()=>finish('invalid'));
    child.on('close',code=>finish(code === 0 ? 'ok' : 'invalid'));
  });
}
function identity(client,output) {
  const patterns = {
    codex:[new RegExp(String.raw`^\s*codex(?:-cli)?\s+v?${VERSION}(?:\s|$)`,'im')],
    claude:[new RegExp(String.raw`^\s*v?${VERSION}\s+\(Claude Code\)(?:\s|$)`,'im'),new RegExp(String.raw`^\s*Claude Code\s+v?${VERSION}(?:\s|$)`,'im')],
    kimi:[new RegExp(String.raw`^\s*kimi(?:\s+code(?:\s+cli)?)?(?:,?\s+version)?\s+v?${VERSION}(?:\s|$)`,'im')],
    agy:[new RegExp(String.raw`^\s*(?:Antigravity|agy)\s+v?${VERSION}(?:\s|$)`,'im')],
  };
  for (const pattern of patterns[client]) { const match = output.match(pattern); if (match && match[1].length <= 128) return match[1]; }
  return null;
}
async function verify(client,executable,opts) {
  const version = await probe(executable,'--version',opts);
  if (version.status !== 'ok') return {status:version.status};
  const branded = identity(client,version.output);
  if (branded) return {status:'detected',version:branded};
  if (client !== 'kimi' && client !== 'agy') return {status:'invalid'};
  const number = version.output.match(new RegExp(String.raw`^\s*v?${VERSION}(?:\s|$)`));
  if (!number || number[1].length > 128) return {status:'invalid'};
  const help = await probe(executable,'--help',opts);
  if (help.status !== 'ok') return {status:help.status};
  const known = client === 'kimi' ? /\bKimi (?:Code(?: CLI)?|CLI)\b/i.test(help.output)
      && (/\busage:\s*kimi\b/i.test(help.output) || /moonshotai\.github\.io\/kimi-code\//i.test(help.output))
    : /\bAntigravity\b/i.test(help.output) && /\busage:\s*agy\b/i.test(help.output)
      || /Usage of agy:/i.test(help.output) && /Available subcommands:/i.test(help.output)
        && ['--agent','--model','--effort'].every(flag=>help.output.includes(flag));
  return known ? {status:'detected',version:number[1]} : {status:'invalid'};
}

export async function resolveClient(client,opts = {}) {
  if (!CLIENTS.includes(client)) throw failure('INVALID_CLIENT');
  const settings = options(opts);
  let best = {client,status:'not_found',version:null,origin:null,executable:null};
  const checked = new Set();
  for (const candidate of candidates(client,settings)) {
    const inspected = await inspect(candidate.file);
    if (inspected.status === 'not_found') continue;
    if (inspected.status === 'invalid') {
      if (best.status === 'not_found') best = {...best,status:'invalid',origin:candidate.origin};
      continue;
    }
    if (checked.has(inspected.executable)) continue;
    checked.add(inspected.executable);
    const result = await verify(client,inspected.executable,settings);
    if (result.status === 'detected') return {client,status:'detected',version:result.version,origin:candidate.origin,executable:inspected.executable};
    if (result.status === 'timeout' || best.status === 'not_found') best = {...best,status:result.status,origin:candidate.origin};
  }
  return best;
}
export async function detectClients(opts = {}) {
  return Promise.all(CLIENTS.map(client=>resolveClient(client,opts)));
}
export function summarizeDetection(records) {
  return records.filter(r=>CLIENTS.includes(r?.client)).map(({client,status,version,origin})=>{
    status = ['detected','not_found','invalid','timeout'].includes(status) ? status : 'invalid';
    if (status === 'detected' && (typeof version !== 'string' || version.length > 128 || !new RegExp(`^${VERSION}$`).test(version))) status = 'invalid';
    return {client,status,version:status === 'detected' ? version : null,origin:['path','known_location'].includes(origin) ? origin : null};
  });
}
