# Shared preferences

Start with policies/balanced.json. The [JSON Schema](../schema/policy.schema.json) describes the shape; the runtime validator is authoritative for accepted input during configuration.

- schemaVersion is 1.
- maxConcurrent is a shared target from 1 to 32.
- clients contains codex, claude, kimi and/or agy.
- Each client has code and light, each with model and effort, plus avoidModels.
- effort is low, medium or high. agy uses null because its native role schema does not pin effort.
- avoidModels is instruction guidance, not a universal deny gate.

The installer creates apk-worker and apk-reviewer from code, and apk-explorer and apk-routine from light. Same responsibilities are used across clients, while model identifiers follow each client's native API. Main chat models are preserved.

Codex defaults are Sol high for code and Luna high for light work. Claude defaults are Sonnet high and Haiku high. Kimi uses provisioned aliases kimi-code/k3 high and kimi-code/kimi-for-coding low. agy uses Pro and Flash tiers. Account access is a prerequisite, not something this file grants.

Kimi aliases must exist in native config with compatible model metadata. Different efforts require distinct aliases because overrides apply to a model entry. agy tiers do not prove a concrete provider model. Native precedence and capability limits are described in [support](compatibility.md).

Old enforce/observe modes and audit allowlists are removed. There is no per-launch evaluator. Changing an incompatible installed preference requires an owned uninstall/update/reinstall sequence; the AI guide handles it without resetting unrelated settings.
