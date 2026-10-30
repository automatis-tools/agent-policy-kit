# Model catalog and presets

models/catalog.json is the release-time snapshot (reviewed 2026-10-29), with native selector IDs, labels, compatible effort levels, documented defaults and primary source URLs. The same data drives page choices and configuration validation. It is not fetched or refreshed during normal agent work.

The snapshot covers Codex's nine visible selectors observed in 0.166.0, documented Claude Code aliases/full IDs, Kimi's four documented upstream models through provisioned native aliases, and Antigravity's four native subagent tiers. Hidden Codex security/utility selectors and session-only modes are recorded as exclusions where appropriate. This is a native subagent catalog, not every image/audio/API/session model or every private deployment.

Account/provider access varies. Custom model IDs remain available for supported native fields. Antigravity accepts only inherit/flash_lite/flash/pro for the native role model field; its broader session model inventory cannot be pinned through this field. Per-role effort is unavailable there. Claude aliases may resolve differently per provider. Unknown defaults are kept as null rather than invented.

| Preset | Starting choices | Priority |
|---|---|---|
| Fast & economical | Light models/tiers and lower supported effort | Shorter routine delegated work and resource restraint |
| Balanced | Capable code/review, light search/routine | Mix of capability and resource use |
| Quality first | Capable models/tiers across the roles, high supported effort | More demanding delegated work |

These are editable recommendations, not measured price/quality guarantees. Existing balanced preferences use Sol/Sonnet/K3/Pro for code; Luna/Haiku/Kimi-for-coding/Flash for light work. Each preset is data shipped with the package version. Edited selections are stored as custom configurations through that version's templates.

Native default effort means no explicit override. Unsupported effort fields are omitted. Explicit levels are filtered by model and native client; Kimi additionally checks provisioned support_efforts. It never silently changes the main agent's effort to satisfy a helper's setting.

For the next release, review the native catalogs and current official docs, update sources/date/data, explain model/task/effort changes in CHANGELOG.md, regenerate the page and rerun configuration/release tests. A configuration test is not a model-quality benchmark. See [maintenance](model-updates.md) and [release preparation](npm-release.md).
