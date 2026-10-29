import fs from 'node:fs';
import path from 'node:path';
import { evaluate } from './policy.mjs';

async function readToml(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error('unsafe_native_config');
  const { parseTOML, getStaticTOMLValue } = await import('toml-eslint-parser');
  return getStaticTOMLValue(parseTOML(fs.readFileSync(file, 'utf8'), { tomlVersion: '1.0.0' }));
}
function ancestors(cwd, home) {
  const result = []; let current = path.resolve(cwd);
  for (let n = 0; n < 64; n++) {
    result.push(current);
    if (fs.existsSync(path.join(current, '.git')) || current === home || current === path.dirname(current)) break;
    current = path.dirname(current);
  }
  return result;
}
export async function verifyBinding(client, input, context, policy) {
  try {
    if (client === 'kimi') {
      const file = path.join(context.home, '.kimi-code/config.toml');
      if (!fs.existsSync(file)) return { status: 'unsupported', reason: 'native_setup_missing' };
      for (const dir of ancestors(context.cwd, context.home)) {
        const override = path.join(dir, '.kimi-code/local.toml');
        if (fs.existsSync(override)) {
          const local = await readToml(override);
          if (['models', 'secondary_model', 'thinking'].some(k => Object.hasOwn(local, k))) return { status: 'unsupported', reason: 'project_binding_override' };
        }
      }
      const config = await readToml(file); const pool = config.secondary_model;
      const profile = Object.values(policy.clients.kimi.profiles).find(p => p.model === input.model);
      if (!profile || !pool || pool.force === true) return { status: 'invalid', reason: 'native_binding_invalid' };
      const entry = config.models?.[profile.model];
      const offered = pool.models ? Object.hasOwn(pool.models, profile.model) : pool.default_model === profile.model;
      const effort = entry?.overrides?.default_effort ?? entry?.default_effort ?? config.thinking?.effort;
      if (!offered || !entry || (profile.providerModel && entry.model !== profile.providerModel)
        || config.thinking?.enabled === false || effort !== profile.effort) return { status: 'invalid', reason: 'native_binding_invalid' };
      return { status: 'verified', reason: 'global_pool_binding' };
    }
    if (client === 'codex') {
      const role = input.agent_type ?? 'default';
      if (typeof role !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(role)) return { status: 'unsupported', reason: 'role_binding_unverified' };
      const decision = evaluate(policy, { client, role, model: input.model ?? null, effort: input.reasoning_effort ?? null });
      if (decision.action === 'deny') return { status: 'invalid', reason: decision.reason };
      const folders = [...ancestors(context.cwd, context.home).map(d => path.join(d, '.codex/agents')), path.join(context.home, '.codex/agents')];
      for (const folder of new Set(folders)) {
        if (!fs.existsSync(folder)) continue;
        if (fs.lstatSync(folder).isSymbolicLink()) return { status: 'unsupported', reason: 'role_binding_unverified' };
        const names = fs.readdirSync(folder).filter(n => n.endsWith('.toml'));
        if (names.length > 128) return { status: 'unsupported', reason: 'role_binding_unverified' };
        for (const name of names) {
          const binding = await readToml(path.join(folder, name));
          if (binding.name !== role) continue;
          if ((binding.model && binding.model !== decision.model)
            || (binding.model_reasoning_effort && binding.model_reasoning_effort !== decision.effort)) return { status: 'invalid', reason: 'native_binding_invalid' };
          return { status: 'verified', reason: 'role_file_binding' };
        }
      }
      return ['default', 'worker', 'explorer'].includes(role) ? { status: 'verified', reason: 'builtin_request_binding' }
        : { status: 'unsupported', reason: 'role_binding_unverified' };
    }
    return { status: 'unsupported', reason: 'binding_not_observable' };
  } catch { return { status: 'invalid', reason: 'native_binding_invalid' }; }
}
