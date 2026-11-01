# Model catalog and presets

models/catalog.json is the release snapshot, checked on 2026-11-01 UTC against the installed native clients and current vendor documentation. No vendor released or retired a subagent model between the previous check on 2026-10-30 and this one. It records native selector IDs, effort levels, defaults and primary sources. The same data drives the page and configuration validation. Normal agent work never fetches this catalog.

| Tool | Current selectable inventory | Evidence |
|---|---|---|
| ChatGPT (Codex) | 9 bundled model IDs; the signed-in server catalog shows 8, because GPT-5.5 left Codex for ChatGPT sign-in on 2026-10-14 | CLI 0.166.0 bundled and server catalogs and [official models](https://learn.chatgpt.com/docs/models) |
| Claude (Claude Code) | 14 versioned IDs, 4 family aliases and inherit | [Native model configuration](https://code.claude.com/docs/en/model-config), CLI 2.1.316 |
| Kimi (Kimi Code) | 6 upstream models through preferred native aliases | [Current Kimi Code models](https://www.kimi.com/code/docs/en/kimi-code/models), CLI 2.4.1 provisioned metadata |
| Gemini (Antigravity) | Pro, Flash, Flash Lite and inherit tiers | CLI 1.4.12 parser and [subagent documentation](https://antigravity.google/docs/subagents?tab=cli) |
| Grok (Grok Build) | Grok 4.7, 4.6, 4.5 and Grok Build 0.1 model IDs (checked 2026-11-01) | [xAI models](https://docs.x.ai/developers/models) and [Grok Build subagents](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/16-subagents.md), CLI 1.0.70 |

Hidden security/utility models, session modes and private deployments are separate from this native subagent inventory. Custom IDs remain available where the native format supports them.

## Kimi's six models

| Upstream ID | Native effort levels | Default | Role in this release |
|---|---|---|---|
| k3.1-pro | low / high / max | high | Optional flagship; Top-tier top-models switch for code/review/tests |
| k3.1-pro-highspeed | low / high / max | high | Optional faster-output variant |
| k3 | low / high / max | high | Top-tier code, review, tests, exploration and documentation; 1M context needs the Pro plan |
| k3-256k | low / high / max | high | Standard implementation, review, tests and docs |
| kimi-for-coding | low / high / max | max | K2.8 Preview; Light, Standard exploration and routine work, Top-tier Task runner |
| kimi-for-coding-highspeed | Fixed thinking; no effort override | Unpinned | Optional K2.7 Code Highspeed |

Both K3.1 Pro variants require thinking. Kimi documents approximately twice the quota usage for Pro Highspeed versus regular Pro, and for k3 versus k3-256k. K3 and K3.1 Pro need the Plus (legacy Moderato) plan or higher. The 1M context of k3 and every Highspeed model need Pro (legacy Allegretto) or higher; on Plus, k3 stays at 256K and still uses about twice the quota of k3-256k. Moonshot recommends k3-256k for routine feature work and k3 for large-codebase analysis and multi-file refactoring. See [membership](https://www.kimi.com/code/docs/en/kimi-code/membership.html). The old kimi.ai/help page still lists only four IDs, so it is not the current inventory source. Native aliases use the kimi-code/ prefix; setup still requires an existing provisioned alias or a unique matching upstream model. It never creates provider credentials.

Setup refuses an explicit native thinking-disabled setting for either Pro model, including unpinned-effort requests. It leaves that setting intact rather than relying on undocumented force-on behavior.

## Native and API capabilities

The efforts/defaultEffort fields describe native choices. Separate apiEfforts/apiDefaultEffort fields retain API facts where they differ. Codex 0.166.0 does not advertise none in its picker; this does not prove manual TOML rejection. APK conservatively offers and validates the advertised native subset for known IDs. Ultra is recorded separately as a delegating execution mode, not offered as an ordinary effort level. The signed-in server catalog of 2026-11-01 gives GPT-6 Astra a medium default where the bundled catalog says low; the catalog records the server value and keeps the bundled one as bundledDefaultEffort. A hidden, undocumented gpt-reserve selector is excluded.

Claude Code's native effort matrix omits Opus 4.5 even though its API supports effort. Its page choices therefore omit that override. Alias and inherit rows list possible requested levels; the resolved provider model can clamp or ignore them. Use a versioned ID for predictable model-specific capabilities. Sonnet 4.5 is deprecated on Anthropic-operated platforms, with retirement scheduled for 2026-11-30; partner schedules differ. See [model lifecycle](https://platform.claude.com/docs/en/about-claude/model-deprecations).

The Antigravity subagent documentation lists only inherit, flash and pro. The installed CLI 1.4.12 parser also accepts flash_lite, so presets that use Flash Lite rely on an undocumented tier. Google does not document which Gemini model each tier uses; the server sets it per account. The wider session model inventory cannot be pinned through the role tier field. Per-role effort is unavailable: --effort and /effort apply to the whole session.

Grok 4.7 supports low, medium, high (default) and xhigh. Grok Build resolves subagent effort from a spawn override, a role default, a persona default and then the parent session. The [subagents.models] entries that APK writes carry only a model, so APK leaves Grok effort to the main session.

Account/provider access varies. Custom model IDs remain available for supported native fields. Antigravity accepts only inherit/flash_lite/flash/pro for the native role model field; its broader session model inventory cannot be pinned through this field. Per-role effort is unavailable there. Claude aliases may resolve differently per provider. Unknown defaults are kept as null rather than invented.

## How the presets are designed

These are starting recommendations, reviewed on 2026-11-01. Subagent usage counts against the same plan limits as the main session, and every parallel session adds to it. The presets therefore differ in how much of the plan subagents may use, not in a claimed quality ranking. No comparative task benchmark was run. Vendors' effort labels and subscription usage are not directly comparable, so one role can get different levels in different tools.

- **Light:** light models for every role, so plan limits last longest. It suits entry plans and many parallel sessions. ChatGPT runs Luna at high for code, review and tests, the starting level OpenAI suggests for Luna; Luna stays the cheapest Codex model at any level. In Claude, reviews and test creation receive extra reasoning because checking edge cases differs from executing known steps. Kimi roles share one alias and therefore one effort, kept low to save quota; Gemini has no per-role effort and uses Flash for code and Flash Lite for lighter work.
- **Standard:** stronger implementation, review, test creation and documentation, with light models for fact gathering and mechanical work. Gemini's light tier for exploration and docs is Flash. ChatGPT runs Luna at high for exploration, OpenAI's suggested starting level for Luna, and GPT-6.1 Terra at medium for docs: OpenAI positions Terra for clear writing, at half of Sol's usage. Claude's Haiku explorer uses its native default, medium. No role uses Astra, Fable or K3.1 Pro. Kimi uses K3 256K for code to keep its quota footprint below the full-context K3 variant; larger-context choices remain editable.
- **Top-tier:** Opus 5.5, GPT-6.1 Sol and K3 at high effort for implementation, review and tests. It uses limits fastest and suits top plans with few parallel sessions. Exploration and documentation use the same high-end model; in ChatGPT and Claude they run at medium, because read-only discovery and writing do not need the edge-case checking that high is for. Only the Task runner uses a lighter model. Kimi keeps one effort per shared alias, and because K2.8 has no medium level its Task runner rises from low to high. Gemini has one top tier, Pro, so its Standard and Top-tier differ only in exploration, docs and the Task runner.
- **Top models switch:** under Top-tier, a per-tool switch replaces the Coder, Reviewer and Test writer choice with the tool's top choice: GPT-6 Astra · high, Opus 5.5 · xhigh or K3.1 Pro · high. For Claude, Anthropic's own benchmarks put Opus 5.5 ahead of Fable 5.1 on every published coding benchmark at 2.5 times lower price, and Anthropic suggests a higher Opus effort before Fable, so the switch raises Opus effort. Fable 5.1 stays available in Custom. Gemini and Grok have no such choice. The switch is off by default because these choices use limits much faster. It is part of Top-tier, not a separate preset, and share links keep it.

Presets pin at most high; the only exception is Claude's top choice at xhigh. Native default subagent settings copy the first selected role (the Coder when selected) to subagents started without a named role. Codex and Kimi copy its model and effort. Claude copies the model, and from Claude Code 2.1.316 also its effort through CLAUDE_CODE_SUBAGENT_EFFORT, capped at high, so the xhigh top choice does not raise unnamed subagents; earlier versions ignore the setting and keep the session effort. Grok copies only the model. Higher effort gives quickly diminishing returns: Anthropic reports that Sonnet 5.5 scored lower at max than at xhigh because it started review subagents more often, and OpenAI recommends starting Astra at low. Anthropic describes high as the level for work where verification matters and xhigh as deeper reasoning at higher token spend. Higher levels remain available in Custom.

No preset bans any model. An unselected model remains available in Custom. Explicit personal avoid lists are still supported in user policy/CLI input. Parallelism defaults are Light 2, Standard 3 and Top-tier 2 for each tool. They bound simultaneous delegation rather than starting tasks or measuring quality. Light keeps short work bounded. Standard allows three independent responsibilities to overlap. Top-tier limits concurrent long-running work on heavier models. These are product defaults, not benchmark results. Each tool can override its limit in its details. Native enforcement varies by client.

### Light

| Role | ChatGPT | Claude | Kimi | Gemini | Grok |
|---|---|---|---|---|---|
| Coder | Luna · high | Haiku 5.5 · medium | K2.8 Preview · low | Flash | Grok Build 0.1 |
| Reviewer | Luna · high | Haiku 5.5 · high | K2.8 Preview · low | Flash | Grok Build 0.1 |
| Code explorer | Luna · low | Haiku 5.5 · low | K2.8 Preview · low | Flash Lite | Grok Build 0.1 |
| Test writer | Luna · high | Haiku 5.5 · high | K2.8 Preview · low | Flash | Grok Build 0.1 |
| Docs writer | Luna · low | Haiku 5.5 · low | K2.8 Preview · low | Flash Lite | Grok Build 0.1 |
| Task runner | Luna · low | Haiku 5.5 · low | K2.8 Preview · low | Flash Lite | Grok Build 0.1 |

### Standard

| Role | ChatGPT | Claude | Kimi | Gemini | Grok |
|---|---|---|---|---|---|
| Coder | Sol · medium | Sonnet 5.5 · medium | K3 256K · high | Pro | Grok 4.7 |
| Reviewer | Sol · high | Sonnet 5.5 · high | K3 256K · high | Pro | Grok 4.7 |
| Code explorer | Luna · high | Haiku 5.5 · medium | K2.8 Preview · low | Flash | Grok Build 0.1 |
| Test writer | Sol · high | Sonnet 5.5 · high | K3 256K · high | Pro | Grok 4.7 |
| Docs writer | Terra · medium | Sonnet 5.5 · medium | K3 256K · high | Flash | Grok 4.7 |
| Task runner | Luna · low | Haiku 5.5 · low | K2.8 Preview · low | Flash Lite | Grok Build 0.1 |

### Top-tier

| Role | ChatGPT | Claude | Kimi | Gemini | Grok |
|---|---|---|---|---|---|
| Coder | Sol · high | Opus 5.5 · high | K3 · high | Pro | Grok 4.7 |
| Reviewer | Sol · high | Opus 5.5 · high | K3 · high | Pro | Grok 4.7 |
| Code explorer | Sol · medium | Opus 5.5 · medium | K3 · high | Pro | Grok 4.7 |
| Test writer | Sol · high | Opus 5.5 · high | K3 · high | Pro | Grok 4.7 |
| Docs writer | Sol · medium | Opus 5.5 · medium | K3 · high | Pro | Grok 4.7 |
| Task runner | Sol · medium | Sonnet 5.5 · medium | K2.8 Preview · high | Flash | Grok Build 0.1 |

With the top models switch on, Coder, Reviewer and Test writer use Astra · high in ChatGPT, Opus 5.5 · xhigh in Claude and K3.1 Pro · high in Kimi.

## Reasons and access requirements

OpenAI positions Astra for demanding work, Sol for a capability/usage balance, Terra for fast, clear writing and Luna for focused efficient work. In Codex credits per token, Astra costs 5 times Sol, Terra half of Sol and Luna a tenth of Terra ([pricing](https://learn.chatgpt.com/docs/pricing)). OpenAI's [subagent guide](https://learn.chatgpt.com/docs/agent-configuration/subagents) suggests Sol for demanding agents, Luna for lighter subagent work, high for Luna and high for reviewer or security agents. Terra launched on 2026-10-26 for Plus, Pro, Business, Enterprise and Edu plans. Its [selection guidance](https://developers.openai.com/api/docs/guides/model-selection) treats these as starting points to evaluate on representative tasks. APK's Codex effort values still follow the native CLI catalog, not API-only options.

Anthropic's [model comparison](https://platform.claude.com/docs/en/models/overview) distinguishes Fable, Opus, Sonnet and Haiku by workload and latency. Versioned IDs freeze the recommendation more precisely than moving family aliases. [Claude Code](https://code.claude.com/docs/en/model-config) supports the selected levels and warns of diminishing returns at max. Anthropic's [costs guidance](https://code.claude.com/docs/en/costs) suggests Sonnet for most coding, Opus for complex architectural work and Haiku for simple subagent tasks. Its [Opus 5.5 announcement](https://www.anthropic.com/claude-opus-5-5) reports Opus 5.5 ahead of Fable 5.1 on Terminal-Bench 4.0, FrontierCode, CursorBench and OSWorld, and its [model overview](https://platform.claude.com/docs/en/about-claude/models/overview) suggests Fable only when Opus 5.5 at a higher effort still falls short. Fable 5.1 requires CLI 2.1.257+. On Pro it uses usage credits; on Max and Ultra it has its own weekly limit. Some non-interactive native paths bill those credits without a consent prompt; APK does not change billing settings or promise a later confirmation. Use Custom to choose another available model.

[Kimi's model table](https://www.kimi.com/code/docs/en/kimi-code/models.html) describes K2.8 Preview's efficient thinking and the smaller quota footprint of K3 256K. Pro Highspeed has the same capabilities as regular Pro at a quota premium, so it is optional rather than a default for either economical or quality priorities. Selected aliases must be provisioned and Pro must have thinking enabled. Roles sharing one alias share its native effort setting.

Grok Build 0.1 is xAI's fast coding model and serves light work; Grok 4.7 is the flagship and serves code, review, tests and docs. Light uses Grok Build 0.1 everywhere, Standard adds Grok 4.7 for code, review, tests and docs, and Top-tier also uses it for exploration. Grok 4.6 and 4.5 stay available in Custom. Account access to each model varies by plan. APK sets no per-role effort for Grok, so subagents use the main session effort, and there is no top models switch for Grok.

Gemini recommendations use only the native role tiers of Antigravity. The CLI's Pro/Flash/Flash Lite selectors do not freeze the underlying provider model, and there is no per-role effort field. Account access and native precedence still apply; see [support](compatibility.md).

Native default effort means no explicit override. Unsupported effort fields are omitted. Explicit levels are filtered by model and native client; Kimi additionally checks provisioned support_efforts. It never silently changes the main agent's effort to satisfy a helper's setting.

For the next release, review the native catalogs and current official docs, update sources/date/data, explain model/task/effort changes in CHANGELOG.md, regenerate the page and rerun configuration/release tests. A configuration test is not a model-quality benchmark. See [maintenance](model-updates.md) and [release preparation](npm-release.md).
