# Policy reference

[JSON Schema](../schema/policy.schema.json) describes the file shape. The runtime also validates relationships between profiles; it remains the authority for accepted policies.

Start with `policies/balanced.json`. `schemaVersion` is `1`; unknown fields fail validation. `mode` is `enforce` or `observe`. Observe mode records decisions without rewriting or blocking calls when a valid observe policy is loaded. An unreadable or invalid policy cannot establish observe mode; the command guard returns a fixed denial.

Fresh observe installations add observation hooks and required hook activation, without setting delegated model defaults or concurrency caps. Observe wrappers preserve inherited user limits and defaults. To change an existing installation between enforce and observe, uninstall its owned integration, update the shared policy, and reinstall; changing the mode underneath an existing receipt is not supported.

Each configured client has `defaultProfile`, `maxConcurrent` (1–32), `profiles`, `deniedModels` and `observedModels`. Each profile defines `model`, `effort` (`low`, `medium`, `high`, or `null`) and unique `roles`. Kimi profiles may also specify `providerModel`, which the native binding check compares to the configured alias's upstream model.

Models must be explicitly available in a profile. `observedModels` is an audit allowlist; it does not grant request access. Claude full IDs in that list can resolve to their allowed Sonnet/Haiku family profile. Unknown role names are not copied to audit. Unknown audit model strings are masked.

Known role bindings take precedence over another permitted model. Unknown roles can use an explicitly permitted model. Missing parameters receive a profile recommendation. Explicit unknown or forbidden models and efforts above `high` deny. Kimi's native pool must supply the expected effort because its `Agent` tool has no per-call effort field.

Do not use `maxConcurrent` as a claimed universal limit. Codex/Claude native limits have documented exceptions. Kimi's wrapper caps the AgentSwarm ramp only. agy exact model enforcement and a universal cross-client scheduler are unsupported.

Changing a shared policy can affect every configured adapter. Review a plan before applying it. Existing receipts detect incompatible policy changes; do not silently replace a shared policy beneath other installations.
