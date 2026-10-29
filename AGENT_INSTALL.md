# Agent Policy Kit — LLM-first operator guide

Audience: the AI agent that the owner authorized to install, verify, upgrade or remove this package. Perform routine technical steps yourself. Do not hand the owner a checklist of shell commands. Do not open interactive prompts when a documented JSON/CLI path exists.

## Contract

- Install only clients positively detected from working executable/version probes. A config folder alone is not detection.
- Use a stable npm installation, not a source checkout or temporary npx cache, for persistent hooks.
- Default commands produce plans. After reviewing the plan against the owner's request, use --apply without asking again for already authorized routine changes.
- Preserve main models, permissions, other plugins/hooks, native credentials and unrelated settings.
- Never publish packages, log in, accept terms, bypass approval/trust, weaken sandboxes, or transfer credentials. The installer keeps private local backups of settings; those can contain existing secrets and must remain private.
- All normal operations are headless JSON. Distinguish configured files, native trust/load, and model execution. Never promote one layer into another.
- If the host requires an actual approval, use its normal approval mechanism when available. Otherwise return one precise machine-readable blocker; continue unaffected clients. Do not invent a trust hash or use a dangerous bypass flag to claim unattended success.

## 1. Obtain a stable installed CLI

Requires Node.js 22.x (22.13+) or 24+. Use npm normally configured by the owner. Package name: agent-policy-kit; baseline version: 0.1.0.

After npm publication, install to a stable user-owned prefix:

```sh
AGENT_POLICY_PREFIX="$HOME/.local/share/agent-policy-kit"
npm install --prefix "$AGENT_POLICY_PREFIX" agent-policy-kit@0.1.0 --ignore-scripts --no-audit --no-fund
AGENT_POLICY_CLI="$AGENT_POLICY_PREFIX/node_modules/.bin/agent-policy"
"$AGENT_POLICY_CLI" --version
```

Before publication, replace the registry package spec with the verified local .tgz. See docs/npm-release.md. Never publish to make an installation test pass.

Do not use npx for persistent setup: its cache can be removed. npx is suitable for read-only instructions/evaluation only. Do not require a global sudo install or modify shell startup files.

## 2. Detect and review

```sh
"$AGENT_POLICY_CLI" detect
"$AGENT_POLICY_CLI" setup
```

Detection checks PATH and documented host-home locations, using bounded version/help probes without model requests. It returns sanitized status/version/origin. Target --home is a configuration target, not authority to execute arbitrary files found there. Skip not_found/invalid/timeout clients. Never create their config folders just because old files mention them.

Review the setup JSON plan, warnings and requiredActions. Exact-model agy integration is unsupported. Do not represent its tier selection as a guaranteed model split.

## 3. Prepare policy and native prerequisites

The bundled balanced policy is the default. For customization:

```sh
"$AGENT_POLICY_CLI" init --policy "$HOME/.agent-policy-kit/policy.json"
```

init never overwrites. If a policy already exists, read and preserve it. The policy is shared across client integrations. Do not replace an incompatible shared policy silently; inspect receipts and plan a coordinated change.

Kimi requires a native secondary pool. Read only the relevant model metadata in its existing config; do not print provider credentials. Use examples/kimi-pool.toml as a shape, copying capabilities/provider metadata from that installed client's provisioned entries. Merge aliases subagent-code (k3-256k/high) and subagent-light (kimi-for-coding/low), per-entry overrides.default_effort, and secondary_model.models. Preserve native main model/provider/login and unrelated pool choices. Use a TOML-aware editor, validate with the detected client's doctor, and rerun the kit doctor. Do not append duplicate tables or assume an alias proves entitlement. If login/model metadata is absent, report that native prerequisite; do not collect passwords or invent credentials.

## 4. Apply without an interactive installer

```sh
"$AGENT_POLICY_CLI" setup --apply
"$AGENT_POLICY_CLI" doctor
```

The kit configures only detected clients. It may return configured with requiredActions: that is not runtime readiness. Per-client failures remain explicit; do not discard successfully completed independent work or overwrite conflicting settings to force green.

An explicitly selected client can use install --client CLIENT [--apply], but absence must not be treated as authorization to create a phantom integration. --home and --state-dir select explicit canonical targets; plan/apply refuses unsafe symlinks.

## 5. Verify each layer

1. Package: invoke the installed bin. Use evaluate for a permitted profile and a denied model; verify expected JSON and exit code. No model call is needed.
2. Settings: inspect the ownership receipt and plan-only reinstall. Reinstall should be unchanged. Native parser/doctor checks should pass.
3. Native load/trust: use documented client checks. Codex non-managed hooks require native trust review. Do not bypass it. For Claude's optional mod, use the kit's run wrapper, which supplies --plugin-dir and AGENT_POLICY_PATH for the selected shared policy; its local /agent-policy-status command verifies loading without inference. Kimi's doctor validates config; runtime callbacks remain separate evidence.
4. Runtime/model: only run a bounded live smoke task if the owner's scope permits it. Preserve requested versus client/provider-reported models and unavailable evidence. Do not call a provider just to validate package syntax.

Native commands and trust rules differ by version. If a normal load/approval path is unavailable in the host, report a precise required action and its evidence, not a false PASS or a broad request for manual terminal work.

## 6. Use supported launchers

```sh
"$AGENT_POLICY_CLI" run --client codex
"$AGENT_POLICY_CLI" run --client claude
"$AGENT_POLICY_CLI" run --client kimi
```

The run wrapper forwards argv directly. Kimi's native AgentSwarm ramp cap applies through this wrapper or the owned launcher; it is not an ordinary-Agent/lifetime quota limit. Do not change the main model unless the owner asks.

## 7. Audit safely

```sh
"$AGENT_POLICY_CLI" audit --public
```

CLI audit is one private audit.jsonl file without session or agent IDs. --public removes timestamps and aggregates. Unknown model/role strings are masked; missing token evidence is null. The optional native Claude mod uses its own bounded private store; /agent-policy-status audit exports a diagnostic sample, not a complete ledger. Caller-supplied record input is not provider proof. Never attach raw config backups, transcripts, prompts, credentials or private state to an issue/public repository.

## 8. Remove automatically

```sh
"$AGENT_POLICY_CLI" uninstall
"$AGENT_POLICY_CLI" uninstall --apply
```

Auto-removal uses owned receipts, including integrations whose native executable was removed. Do not require that executable to clean an orphaned integration. A selected client can use --client CLIENT. Preserve unrelated later edits. Owned-value drift, pending journals or active locks require reconciliation; never delete markers blindly or restore a stale full backup.

Policy/backups/audit remain private after uninstall. Remove the npm package only after its integrations are removed. Do not delete unrelated vendor configuration, credentials or sessions.

## Return to the owner

Give a concise per-client result with these separate layers: detected, configured, native trust/load, runtime/model. Include exactly what remains blocked/unsupported and why. State whether anything was published (normally nothing). Avoid unsupported savings or provider-model claims.
