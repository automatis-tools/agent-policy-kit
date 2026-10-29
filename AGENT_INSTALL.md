# Agent Policy Kit — AI operator guide

This is a configuration-only tool. It writes native configuration and exits. It has no hooks, wrappers, plugins, service or audit process. After setup, the npm package and kit state are not needed for normal client operation.

Perform authorized setup, validation, updates and removal yourself. Do not give the owner a shell checklist. Use JSON commands and continue unaffected clients when one has a prerequisite. Use the owner's normal approval mechanism only when the host actually requires it.

## Boundaries

- Detect working native CLI executables; stale config folders are not presence.
- Preserve main models, permissions, providers, credentials, unrelated hooks/plugins, and later user edits.
- Use native settings and plain agent/instruction files only. Do not install a runtime dependency into client configuration.
- Never log in, collect credentials, accept terms, publish, change sandboxes, or start model tasks as installation shortcuts.
- Shared settings mean the same task roles and preferences adapted to each native client. They do not guarantee identical provider models or universal enforcement.
- Private receipts/backups support future updates/removal only. Backups may contain existing secrets. Do not publish state or raw config.

## 1. Obtain the configurator

Requires Node.js 22.x (22.13+) or 24+. After npm publication, a one-shot invocation is supported:

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.1.0 agent-policy instructions
npx --yes --ignore-scripts --package agent-policy-kit@0.1.0 agent-policy setup
```

Before publication, use the verified local .tgz instead of the registry spec. Never publish to make installation succeed. For several commands, install into a temporary or user-owned prefix:

```sh
AGENT_POLICY_PREFIX="$(mktemp -d)"
npm install --prefix "$AGENT_POLICY_PREFIX" /absolute/path/agent-policy-kit-0.1.0.tgz --ignore-scripts --no-audit --no-fund
AGENT_POLICY_CLI="$AGENT_POLICY_PREFIX/node_modules/.bin/agent-policy"
"$AGENT_POLICY_CLI" --version
```

A stable installation path, shell profile modification, sudo, or a background service is not required. The package is used only while a configuration command runs.

## 2. Detect and prepare preferences

```sh
"$AGENT_POLICY_CLI" detect
"$AGENT_POLICY_CLI" setup
```

Default operations are read-only plans. Review targets, warnings and requiredActions against the owner's request. Missing clients must not receive config files. --home changes the configuration target, not the executable discovery trust root.

Automatic setup supports standard native profiles. If CODEX_HOME, CLAUDE_CONFIG_DIR, or KIMI_CODE_HOME names a different native root, that client receives the zero-write prerequisite native-home-override-unsupported; doctor reports NATIVE_HOME_OVERRIDE_UNSUPPORTED instead of verifying a dormant standard profile. Other clients continue. An environment path resolving to the standard native root is supported. An explicit --home intentionally targets the standard native layout under that home and bypasses this comparison; it does not remap an arbitrary native root.

To customize defaults for a fresh installation, create a preferences file with init --policy FILE, then edit only the requested settings. init never overwrites. Pass that same --policy FILE to setup and doctor, including later read-only checks. The shared shape is schemaVersion:1, maxConcurrent, and per-client code/light model+effort plus avoidModels guidance. See docs/policy.md. Use provisioned model aliases in Kimi, not raw provider IDs. Never infer model entitlement from an alias.

The canonical shared preferences are stateDir/policy.json: stateDir is --state-dir, AGENT_POLICY_HOME, or the selected home's .agent-policy-kit directory. Setup retains this file after uninstall. An external --policy source must remain semantically equal to that canonical file; editing only the external source is not an update.

Kimi requires its native model entries to exist already. Missing aliases, invalid capabilities/effort metadata, or disabled thinking are prerequisites. Read only relevant model metadata, preserve secrets, and use the native client's ordinary setup if the owner has already authorized it. Otherwise report the exact missing prerequisite. Do not invent provider definitions or silently substitute another model.

A Kimi main-effort conflict means a selected alias is also the main model and changing its default could change the main session. Preserve main behavior. Prefer an existing separate native alias, or explicitly prepare a native model variant from provisioned metadata before applying. Never change global main effort to hide the conflict. The reserved pool key primary is invalid.

Claude force-model settings can defeat per-role model selection. Resolve an explicit native force conflict with the owner's intended settings; never claim per-role configuration succeeded while force still overrides it. Environment/project settings can also take native precedence.

## 3. Apply and verify

```sh
"$AGENT_POLICY_CLI" setup --apply
"$AGENT_POLICY_CLI" doctor
```

Already-authorized setup does not need another confirmation after you review the concrete plan. install --client CLIENT selects one detected tool. --home and --state-dir select canonical targets; retain these exact targets for doctor and removal. If using an external preferences file, add the same --policy FILE to both commands above. Symlinks, stale plans and ownership conflicts are refused.

Review every per-client result. A configured result means native files were written, not that a model task executed. Inspect the generated roles and managed instruction block, then verify idempotency with setup. Native clients may need a fresh session to load changes. Do not terminate the owner's active sessions automatically.

Generated roles are apk-worker, apk-reviewer, apk-explorer and apk-routine. Worker/reviewer use code preferences; explorer/routine use light preferences. Native global instructions route delegation and describe the shared parallelism target. No file may invoke/import Agent Policy Kit or refer to its executable, npm installation, source tree or state for normal operation.

After verification, the npm package can be uninstalled or its owned temporary prefix removed. Keep private kit state if future removal is wanted. Normal client use must not launch this package or require a kit launcher.

## 4. Understand native limits

- Codex role files pin requested model/effort and native defaults/cap are configured. Explicit/project settings have native precedence rules.
- Claude role files and native defaults/cap are configured. Force flags, higher-priority settings and some native execution paths have exceptions.
- Kimi uses its existing model pool, per-alias effort and routing guidance. Its role Markdown does not pin model selection. A max-three instruction is guidance, not a universal native cap.
- agy uses native Pro/Flash tiers. Concrete provider identity, per-role effort and a hard concurrency cap are not supplied by these files.

avoidModels is written as instruction guidance. There is no custom gate to block every explicit model override. Report requested native settings separately from actual model/provider execution. Do not add a hook to strengthen these limits.

## 5. Update or remove configuration

```sh
"$AGENT_POLICY_CLI" uninstall
"$AGENT_POLICY_CLI" uninstall --apply
```

Receipts permit removal even when the native CLI or shared preferences are absent. Reinstall or invoke the configurator with npx when needed; it does not have to remain installed between operations. Preserve unrelated later edits. Owned drift, pending journals and active locks require precise reconciliation; never force-delete markers or restore an obsolete whole-file backup.

For a preferences change, coordinate every receipt using the same canonical state preferences:

1. Keep the installation's --home and --state-dir arguments for removal. Plan and apply owned uninstall for all affected configured clients, including clients whose executable is now missing.
2. Confirm all receipts using that shared policy have been removed and no pending journal or active lock remains. Reconcile a blocked removal; do not delete receipts or transaction markers to proceed.
3. Validate the replacement preferences against the shipped schema and validatePolicy. Update stateDir/policy.json to that validated value, preserving private backups. If --policy points to an external custom file, update it to the same value too. init does not overwrite either existing file.
4. Rerun detected setup with the same target arguments and external --policy FILE if used; inspect the plan, apply, then run doctor with the same --policy FILE.

Uninstall deliberately retains stateDir/policy.json, so uninstall followed by editing only an external custom.json still returns POLICY_CONFLICT. Do not weaken this ownership check or reset the entire state directory. Keep backups private and preserve unrelated edits throughout.

Experimental runtime receipts from older unreleased development commits are incompatible. Use that version's owned uninstall before this configurator. Do not guess ownership from a command string or delete other plugins' hooks.

Return a concise per-client report: detected, native configuration saved/verified, prerequisites/limits, and whether a new session is needed. State that no model task or publication was performed. Do not claim runtime/provider acceptance from a parser or fixture.
