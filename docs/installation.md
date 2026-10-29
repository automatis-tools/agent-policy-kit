# Installation

Follow [the operator guide](../AGENT_INSTALL.md) to install a registry release or local tarball. Keep the installation in a stable prefix; generated hooks reference that installed package. Moving/removing the package before uninstalling client integration breaks those hooks. Use `doctor` after upgrades.

Examples use `agent-policy`; replace it with the quoted `AGENT_POLICY_CLI` variable from the operator guide when the bin is not on PATH.

1. Run the client's normal setup/login. The kit does not copy credentials or test paid entitlement.
2. Run `init --policy PATH`, then edit the models to match the account.
3. Run `install --client CLIENT`. The plan prints target files and warnings, without configuration bodies.
4. Review the plan and run the same command with `--apply`.
5. Complete the native client's hook trust/load review and start a fresh client session. Run `doctor`; a written config is not model-execution evidence.

`--home` selects the base containing `.codex`, `.claude` or `.kimi-code`; `--state-dir` selects private kit data. Use canonical absolute paths. The installer refuses symlink ancestors and unsafe structures instead of guessing. Non-default vendor configuration layouts require a compatible explicit base; they are not discovered by scraping credentials.

## Codex

The installer adds owned command hooks, enables hooks, and sets `agents.max_concurrent_threads_per_session` from policy. Existing `agents.max_threads` produces an explicit conflict instead of duplicate native fields. Main-model and permission settings are preserved.

Review the command definitions in Codex's `/hooks`. Installing does not trust them automatically. Specialized tool paths may bypass ordinary hooks; this is not a security boundary.

## Claude Code

Classic installation adds the `Agent` command hook and native subagent default/concurrency environment settings. It does not replace main Opus/effort settings, installed plugins or role definitions. Explicit Agent parameters are checked; the classic hook alone does not govern Workflow agents.

Load the optional native mod with `agent-policy run --client claude`. The wrapper supplies the installed plugin directory and selected shared policy. Direct `claude --plugin-dir INSTALLED_PACKAGE_ROOT` is also possible, but needs an explicit plugin policyPath or AGENT_POLICY_PATH for a custom policy. Use `/agent-policy-status` and the native plugin UI to confirm loading. It handles `agent.spawn`, including supported workflow/team starts; it does not claim per-step or resume coverage. Native audit uses a bounded host store, distinct from the CLI audit file.

## Kimi

Merge `examples/kimi-pool.toml` into the native config after login. The aliases must exist in the pool, point at the expected upstream models, and have the expected effective effort. Preserve the metadata provisioned by the native client. The example is configuration, not proof of account quota.

The installer appends an owned PreToolUse hook and creates a quoted launcher. Use that launcher or `agent-policy run --client kimi` to set the supported AgentSwarm ramp cap. Ordinary Agent concurrency is not universally capped by this kit. Relevant project-local model overrides are unsupported by the global binding checker and fail safely in enforce mode.

## agy

Exact model installation returns `unsupported` without modifying live settings. Native tier selection remains client/account-controlled. Caller-supplied normalized observations can be recorded, but they are not automatic provider proof.
