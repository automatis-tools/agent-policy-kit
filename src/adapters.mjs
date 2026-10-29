import { evaluate } from './policy.mjs';

const targets = { codex: ['spawn_agent', 'Agent'], claude: ['Agent'], kimi: ['Agent', 'AgentSwarm'], agy: ['invoke_subagent'] };
export function denial(reason = 'invalid_input') {
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny',
    permissionDecisionReason: `Agent Policy Kit: ${reason}. Check the configured policy and client setup.` } };
}
function plain(value) { return value && typeof value === 'object' && !Array.isArray(value); }
export function handleHook(client, event, policy) {
  if (!plain(event)) return { output: denial(), exitCode: 0, audit: null };
  const input = event.tool_input;
  const pre = event.hook_event_name === 'PreToolUse';
  const target = targets[client]?.includes(event.tool_name);
  if (!pre) {
    if (!['SubagentStart', 'SubagentStop', 'PostToolUse'].includes(event.hook_event_name)
      || (event.hook_event_name === 'PostToolUse' && !target)) return { output: null, exitCode: 0, audit: null };
    // Only an explicit event model is a client report. Never infer it from tool_input.
    const reported = typeof event.model === 'string' ? event.model : null;
    return { output: null, exitCode: 0, audit: { client, kind: 'observation', action: 'unsupported',
      reason: reported ? 'client_reported' : 'model_unavailable', source: reported ? 'client_reported' : 'unavailable',
      reportedModel: reported, requestedModel: null, role: event.agent_type ?? null,
      sessionId: event.session_id, agentId: event.agent_id, enforced: false } };
  }
  if (!target) return { output: null, exitCode: 0, audit: null };
  if (!plain(input)) return { output: denial(), exitCode: 0,
    audit: { client, kind: 'decision', action: 'deny', reason: 'invalid_input', enforced: policy.mode === 'enforce' } };
  const request = { client, role: input.agent_type ?? input.subagent_type ?? input.TypeName ?? null,
    model: input.model ?? null, effort: input.reasoning_effort ?? input.effort ?? null };
  const decision = evaluate(policy, request);
  const audit = { client, kind: 'decision', action: decision.action, reason: decision.reason,
    profile: decision.profile, role: request.role, requestedModel: request.model, reportedModel: null,
    source: 'requested', requestedEffort: request.effort, expectedModel: decision.model,
    sessionId: event.session_id, agentId: event.agent_id, enforced: policy.mode === 'enforce' };
  if (policy.mode === 'observe' || decision.action === 'allow') return { output: null, exitCode: 0, audit };
  if (decision.action === 'deny' || decision.action === 'unsupported') return { output: denial(decision.reason), exitCode: 0, audit };
  if (client === 'kimi') {
    // Agent has no effort parameter. The CLI separately verifies the native model-pool binding.
    if (request.model === decision.model) return { output: null, exitCode: 0, audit: { ...audit, action: 'allow', reason: 'native_pool_binding_required' } };
    return { output: denial(`retry_with_model=${decision.model}`), exitCode: 0, audit };
  }
  const updatedInput = { ...input, model: decision.model };
  if (decision.effort !== null) updatedInput[client === 'codex' ? 'reasoning_effort' : 'effort'] = decision.effort;
  return { output: { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput } }, exitCode: 0, audit };
}
