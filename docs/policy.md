# Shared preferences

Start with policies/balanced.json. The [JSON Schema](../schema/policy.schema.json) describes the shape; the configuration validator is authoritative for accepted input.

- schemaVersion is 1.
- maxConcurrent is a shared target from 1 to 32.
- clients contains codex, claude, kimi and/or agy.
- Each client has code and light, each with model and effort, plus avoidModels.
- effort is low, medium or high. agy uses null because its native role schema does not pin effort.
- avoidModels is instruction guidance, not a universal deny gate.

The installer creates apk-worker and apk-reviewer from code, and apk-explorer and apk-routine from light. Same responsibilities are used across clients, while model identifiers follow each client's native API. Main chat models are preserved.

Role selection is conditional on the main agent choosing to delegate. These settings do not require subagents or enable a disabled agent feature. [Model maintenance](model-updates.md) describes how to review changing model recommendations without a background updater.

Codex defaults are Sol high for code and Luna high for light work. Claude defaults are Sonnet high and Haiku high. Kimi uses provisioned aliases kimi-code/k3 high and kimi-code/kimi-for-coding low. agy uses Pro and Flash tiers. Account access is a prerequisite, not something this file grants.

Kimi aliases must exist in native config with compatible model metadata. Different efforts require distinct aliases because overrides apply to a model entry. agy tiers do not prove a concrete provider model. Native precedence and capability limits are described in [support](compatibility.md).

Old enforce/observe modes and audit allowlists are removed. There is no per-launch evaluator.

The canonical shared preferences are stateDir/policy.json, where stateDir is --state-dir, AGENT_POLICY_HOME, or the selected home's .agent-policy-kit directory. Uninstall retains this file and private backups. An external --policy custom.json is a source for configuration and must remain semantically equal to the canonical file; pass the same --policy to setup and doctor.

Before changing preferences, remove every affected receipt sharing that canonical policy with owned uninstall, using the installation's --home and --state-dir targets. Confirm no pending transaction or active lock remains. Validate the replacement against the shipped schema and validatePolicy, update the canonical file and any external source to the same value, then rerun setup and doctor with the same --policy. Editing only custom.json after uninstall still returns POLICY_CONFLICT. Do not bypass this check by deleting receipts, resetting state, or discarding backups. See the [AI operator guide](../AGENT_INSTALL.md#5-update-or-remove-configuration) for the coordinated sequence.
