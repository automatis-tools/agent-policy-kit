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
| k3.1-pro | low / high / max | high | Optional flagship; Quality uses explicit max for code/review/tests |
| k3.1-pro-highspeed | low / high / max | high | Optional faster-output variant |
| k3 | low / high / max | high | Quality exploration/documentation |
| k3-256k | low / high / max | high | Balanced implementation/review/tests |
| kimi-for-coding | low / high / max | max | K2.8 Preview; Fast and lighter Balanced work |
| kimi-for-coding-highspeed | Fixed thinking; no effort override | Unpinned | Optional K2.7 Code Highspeed |

Both K3.1 Pro variants require thinking. Kimi documents approximately twice the quota usage for Pro Highspeed versus regular Pro; account tier controls access and context limits. The old kimi.ai/help page still lists only four IDs, so it is not the current inventory source. Native aliases use the kimi-code/ prefix; setup still requires an existing provisioned alias or a unique matching upstream model. It never creates provider credentials.

Setup refuses an explicit native thinking-disabled setting for either Pro model, including unpinned-effort requests. It leaves that setting intact rather than relying on undocumented force-on behavior.

## Native and API capabilities

The efforts/defaultEffort fields describe native choices. Separate apiEfforts/apiDefaultEffort fields retain API facts where they differ. Codex 0.166.0 does not advertise none in its picker; this does not prove manual TOML rejection. APK conservatively offers and validates the advertised native subset for known IDs. Ultra is recorded separately as a delegating execution mode, not offered as an ordinary effort level.

Claude Code's native effort matrix omits Opus 4.5 even though its API supports effort. Its page choices therefore omit that override. Alias and inherit rows list possible requested levels; the resolved provider model can clamp or ignore them. Use a versioned ID for predictable model-specific capabilities. Sonnet 4.5 is deprecated on Anthropic-operated platforms, with retirement scheduled for 2026-11-30; partner schedules differ. See [model lifecycle](https://platform.claude.com/docs/en/about-claude/model-deprecations).

Antigravity's shared documentation has a narrower App table, but the installed CLI 1.4.10 parser explicitly supports flash_lite too. Its wider session model inventory cannot be pinned through the role tier field. Per-role effort is unavailable.

Account/provider access varies. Custom model IDs remain available for supported native fields. Antigravity accepts only inherit/flash_lite/flash/pro for the native role model field; its broader session model inventory cannot be pinned through this field. Per-role effort is unavailable there. Claude aliases may resolve differently per provider. Unknown defaults are kept as null rather than invented.

## How the presets are designed

These are starting recommendations for different priorities, reviewed on 2026-10-30. No comparative task benchmark was run. The four vendors' effort labels and subscription usage are not directly comparable.

- **Fast & economical:** bounded tasks on lighter models. Reviews and test creation receive extra reasoning because checking edge cases differs from executing known steps. Kimi uses one efficient alias at one coherent effort; Antigravity uses Flash for code and Flash Lite for lighter work.
- **Balanced:** stronger implementation, review and test creation, with lighter fact gathering and mechanical work. Kimi uses K3 256K for code to keep its quota footprint below the full-context K3 variant; larger-context choices remain editable.
- **Quality first:** demanding implementation, review and tests get frontier models and deeper supported reasoning. Exploration, documentation and mechanical steps use choices suited to those roles rather than automatically selecting the largest model everywhere. Kimi keeps one effort per shared alias; Pro max is reserved for code/review/tests, while K3 handles exploration and docs at high effort.

No preset bans any model. An unselected model remains available in Custom. Explicit personal avoid lists are still supported in user policy/CLI input. The shared concurrency ceiling of three is a modest operational default, not a claim that a particular parallelism level improves quality; native enforcement varies by client.

### Fast & economical

| Role | Codex | Claude Code | Kimi Code | Antigravity |
|---|---|---|---|---|
| Coder | Luna · medium | Haiku 5.5 · medium | K2.8 Preview · low | Flash |
| Reviewer | Luna · high | Haiku 5.5 · high | K2.8 Preview · low | Flash |
| Code explorer | Luna · low | Haiku 5.5 · low | K2.8 Preview · low | Flash Lite |
| Test writer | Luna · high | Haiku 5.5 · high | K2.8 Preview · low | Flash |
| Docs writer | Luna · low | Haiku 5.5 · low | K2.8 Preview · low | Flash Lite |
| Task runner | Luna · low | Haiku 5.5 · low | K2.8 Preview · low | Flash Lite |

### Balanced

| Role | Codex | Claude Code | Kimi Code | Antigravity |
|---|---|---|---|---|
| Coder | Sol · medium | Sonnet 5.5 · medium | K3 256K · high | Pro |
| Reviewer | Sol · high | Sonnet 5.5 · high | K3 256K · high | Pro |
| Code explorer | Luna · high | Haiku 5.5 · medium | K2.8 Preview · low | Flash |
| Test writer | Sol · high | Sonnet 5.5 · high | K3 256K · high | Pro |
| Docs writer | Sol · medium | Sonnet 5.5 · medium | K2.8 Preview · low | Flash |
| Task runner | Luna · low | Haiku 5.5 · low | K2.8 Preview · low | Flash Lite |

### Quality first

| Role | Codex | Claude Code | Kimi Code | Antigravity |
|---|---|---|---|---|
| Coder | Astra · xhigh | Fable 5.1 · xhigh | K3.1 Pro · max | Pro |
| Reviewer | Astra · xhigh | Fable 5.1 · xhigh | K3.1 Pro · max | Pro |
| Code explorer | Sol · high | Opus 5.5 · high | K3 · high | Pro |
| Test writer | Astra · xhigh | Fable 5.1 · xhigh | K3.1 Pro · max | Pro |
| Docs writer | Sol · high | Opus 5.5 · high | K3 · high | Pro |
| Task runner | Sol · medium | Sonnet 5.5 · medium | K2.8 Preview · high | Flash |

## Reasons and access requirements

OpenAI positions Astra for demanding work, Sol for a capability/usage balance and Luna for focused efficient work. Its [selection guidance](https://developers.openai.com/api/docs/guides/model-selection) treats these as starting points to evaluate on representative tasks. APK's Codex effort values still follow the native CLI catalog, not API-only options.

Anthropic's [model comparison](https://platform.claude.com/docs/en/models/overview) distinguishes Fable, Opus, Sonnet and Haiku by workload and latency. Versioned IDs freeze the recommendation more precisely than moving family aliases. [Claude Code](https://code.claude.com/docs/en/model-config) supports the selected levels and warns of diminishing returns at max. Fable 5.1 requires CLI 2.1.257+ and may consume usage credits depending on the plan. Some non-interactive native paths bill those credits without a consent prompt; APK does not change billing settings or promise a later confirmation. Use Custom to choose another available model.

[Kimi's model table](https://www.kimi.com/code/docs/en/kimi-code/models.html) describes K2.8 Preview's efficient thinking and the smaller quota footprint of K3 256K. Pro Highspeed has the same capabilities as regular Pro at a quota premium, so it is optional rather than a default for either economical or quality priorities. Selected aliases must be provisioned and Pro must have thinking enabled. Roles sharing one alias share its native effort setting.

Antigravity recommendations use only its native role tiers. The CLI's Pro/Flash/Flash Lite selectors do not freeze the underlying provider model, and there is no per-role effort field. Account access and native precedence still apply; see [support](compatibility.md).

Native default effort means no explicit override. Unsupported effort fields are omitted. Explicit levels are filtered by model and native client; Kimi additionally checks provisioned support_efforts. It never silently changes the main agent's effort to satisfy a helper's setting.

For the next release, review the native catalogs and current official docs, update sources/date/data, explain model/task/effort changes in CHANGELOG.md, regenerate the page and rerun configuration/release tests. A configuration test is not a model-quality benchmark. See [maintenance](model-updates.md) and [release preparation](npm-release.md).
