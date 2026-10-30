# Release model catalog

catalog.json is a dated native-subagent selector snapshot shipped with the package. It is not a live/account-universal inventory. Each entry records ID, label, native efforts/default when documented, and a primary source. Custom model/deployment IDs remain available where supported.

The current audit is 2026-10-30 UTC. Codex 0.166.0 has nine visible models and three hidden specialized/utility entries. Native efforts/defaults come from its bundled catalog; separate apiEfforts/apiDefaultEffort metadata records API differences. Ultra is a delegating mode, not an ordinary effort choice. Claude Code has 14 versioned IDs, four family aliases and inherit; alias capabilities depend on the resolved provider model. Kimi has six preferred aliases, including both K3.1 Pro variants, corroborated through whitelisted provisioned metadata. Antigravity CLI 1.4.10 accepts four role tiers, including Flash Lite; its session model picker is a separate surface. See the [audit and preset rationale](../docs/model-catalog.md).

API defaults can differ from CLI defaults. Unknown native defaults are null; unsupported effort lists are empty. Presets are editable priorities, not measured quality/price guarantees. Update sources/date and release notes alongside any changed recommendation, then regenerate the static page and run all configuration/package tests.
