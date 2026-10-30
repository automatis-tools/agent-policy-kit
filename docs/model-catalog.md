# Model catalog and presets

models/catalog.json is the release snapshot, checked on 2026-10-30 UTC (2026-10-29 in Toronto). It records native selector IDs, effort levels, defaults and primary sources. The same data drives the page and configuration validation. Normal agent work never fetches this catalog.

| Tool | Current selectable inventory | Evidence |
|---|---|---|
| Codex | 9 visible model IDs | CLI 0.166.0 bundled catalog and [official models](https://learn.chatgpt.com/docs/models) |
| Claude Code | 14 versioned IDs, 4 family aliases and inherit | [Native model configuration](https://code.claude.com/docs/en/model-config), CLI 2.1.312 |
| Kimi Code | 6 upstream models through preferred native aliases | [Current Kimi Code models](https://www.kimi.com/code/docs/en/kimi-code/models), CLI 2.4.0 provisioned metadata |
| Antigravity | Pro, Flash, Flash Lite and inherit tiers | CLI 1.4.10 parser and [subagent documentation](https://antigravity.google/docs/subagents?tab=cli) |

Hidden security/utility models, session modes and private deployments are separate from this native subagent inventory. Custom IDs remain available where the native format supports them.

## Kimi's six models

| Upstream ID | Native effort levels | Default | Role in this release |
|---|---|---|---|
| k3.1-pro | low / high / max | high | Quality first |
| k3.1-pro-highspeed | low / high / max | high | Optional faster-output variant |
| k3 | low / high / max | high | Balanced code/review |
| k3-256k | low / high / max | high | Optional 256K context variant |
| kimi-for-coding | low / high / max | max | K2.8 Preview; Fast and Balanced light work |
| kimi-for-coding-highspeed | Fixed thinking; no effort override | Unpinned | Optional K2.7 Code Highspeed |

Both K3.1 Pro variants require thinking. Kimi documents approximately twice the quota usage for Pro Highspeed versus regular Pro; account tier controls access and context limits. The old kimi.ai/help page still lists only four IDs, so it is not the current inventory source. Native aliases use the kimi-code/ prefix; setup still requires an existing provisioned alias or a unique matching upstream model. It never creates provider credentials.

Setup refuses an explicit native thinking-disabled setting for either Pro model, including unpinned-effort requests. It leaves that setting intact rather than relying on undocumented force-on behavior.

## Native and API capabilities

The efforts/defaultEffort fields describe native choices. Separate apiEfforts/apiDefaultEffort fields retain API facts where they differ. Codex 0.166.0 does not advertise none in its picker; this does not prove manual TOML rejection. APK conservatively offers and validates the advertised native subset for known IDs. Ultra is recorded separately as a delegating execution mode, not offered as an ordinary effort level.

Claude Code's native effort matrix omits Opus 4.5 even though its API supports effort. Its page choices therefore omit that override. Alias and inherit rows list possible requested levels; the resolved provider model can clamp or ignore them. Use a versioned ID for predictable model-specific capabilities. Sonnet 4.5 is deprecated on Anthropic-operated platforms, with retirement scheduled for 2026-11-30; partner schedules differ. See [model lifecycle](https://platform.claude.com/docs/en/about-claude/model-deprecations).

Antigravity's shared documentation has a narrower App table, but the installed CLI 1.4.10 parser explicitly supports flash_lite too. Its wider session model inventory cannot be pinned through the role tier field. Per-role effort is unavailable.

Account/provider access varies. Custom model IDs remain available for supported native fields. Antigravity accepts only inherit/flash_lite/flash/pro for the native role model field; its broader session model inventory cannot be pinned through this field. Per-role effort is unavailable there. Claude aliases may resolve differently per provider. Unknown defaults are kept as null rather than invented.

| Preset | Starting choices | Priority |
|---|---|---|
| Fast & economical | Light models/tiers and lower supported effort | Shorter routine delegated work and resource restraint |
| Balanced | Capable code/review, light search/routine | Mix of capability and resource use |
| Quality first | Capable models/tiers across the roles, high supported effort | More demanding delegated work |

These are editable recommendations, not measured price/quality guarantees. Balanced keeps Sol/Sonnet/K3/Pro for code and Luna/Haiku/K2.8 Preview/Flash for light work. Quality first now uses regular K3.1 Pro at high effort for Kimi, based on the provider's current flagship recommendation; no comparative model benchmark was run. Each preset is shipped with the package version.

Native default effort means no explicit override. Unsupported effort fields are omitted. Explicit levels are filtered by model and native client; Kimi additionally checks provisioned support_efforts. It never silently changes the main agent's effort to satisfy a helper's setting.

For the next release, review the native catalogs and current official docs, update sources/date/data, explain model/task/effort changes in CHANGELOG.md, regenerate the page and rerun configuration/release tests. A configuration test is not a model-quality benchmark. See [maintenance](model-updates.md) and [release preparation](npm-release.md).
