# Model catalog

This document describes `models/catalog.json`, the model catalog of release 0.4.0. It explains the fields, lists the models and effort levels for each AI assistant, and records defaults, lifecycle dates and access requirements. It is for everyone who chooses a model in Custom or wants to know which values a release accepts.

## What the catalog is

The model catalog is a dated snapshot of the native subagent selectors that each AI assistant accepts. A selector is the value that a native role setting takes: a model ID, an alias or a tier. The catalog ships inside the package. One package version has one catalog, as with presets (see [Presets](presets.md)).

- The snapshot date is `reviewedAt`: 2026-11-02 UTC. On that date the lifecycle of the Claude 4.5 models was checked again. See [Lifecycle](#lifecycle). The full review of 2026-11-01 checked the installed native clients and the current vendor documentation. No vendor released or retired a subagent model between the previous check on 2026-10-30 and this one.
- The configurator page and the preferences validation use the same data. For the validation rules, see [Preferences](../guide/preferences.md).
- APK never fetches a catalog at run time. Normal agent work never reads the catalog.
- The catalog is not a live inventory and not a list of what one account can use. Account access and custom deployment IDs vary.

Hidden security and utility models, session modes and private deployments are not in this inventory. Custom model IDs stay available where the native format supports them. Gemini is the exception: its role field accepts only the four tiers.

## Fields

The top level has `schemaVersion` (1), `reviewedAt`, `scope` and `clients`. `clients` has one entry for each assistant: `chatgpt`, `claude`, `kimi`, `gemini` and `grok`.

Each assistant entry has these fields:

| Field | Meaning |
|---|---|
| `label` | Name on the page and in output. |
| `efforts` | The native effort levels of the assistant. A custom model ID can request only these levels. An empty list means no per-role effort. |
| `observedClientVersion` | The native client version that the review checked. |
| `observation`, `note` | How the inventory was checked, and limits of the data. |
| `excluded` | Selectors that the review found but left out, each with a reason. |
| `models` | The known selectors. |

Each model entry has these fields:

| Field | Meaning |
|---|---|
| `id` | The native selector that APK writes. |
| `label` | The name on the page. |
| `kind` | `model`, `alias`, `inherit`, `native-alias` (Kimi) or `tier` (Gemini). |
| `efforts` | Native effort levels for this selector. An explicit effort outside this list is refused. An empty list allows only an unpinned effort. |
| `defaultEffort` | The native default effort. `null` means that the default is not documented. APK does not invent a value. |
| `source` | The primary source for the entry. |

Some entries have optional fields:

| Field | Meaning |
|---|---|
| `apiEfforts`, `apiDefaultEffort`, `apiSource` | Effort facts of the vendor API, where they differ from the native client. APK does not offer these levels. |
| `bundledDefaultEffort` | The default in the catalog that is bundled with the Codex CLI, where the signed-in server catalog differs. |
| `delegationModes` | Execution modes such as `ultra`. These are not effort levels. |
| `nativeSource` | A second source for the native behavior. |
| `effortResolution` | How an alias or `inherit` resolves effort. |
| `lifecycle` | Status (`active`, `deprecated` or `retired`), a retirement date (`retirementDate`) or earliest retirement date (`earliestRetirement`), the scope and the source. Optional: the deprecation date (`deprecationDate`), the recommended replacement ID (`replacement`), a `note`, and `partners`, a list of partner platforms that set their own schedule. Each partner entry has `platform`, `source` and, where announced, the partner's own `status`, `earliestRetirement` or `endOfLife`, or a `note`. |
| `upstreamModelId`, `thinkingRequired`, `planRequirement` | Kimi: the upstream model, whether thinking must be on, and the plan that the model needs. |
| `documented` | `false` when the native client accepts a selector that the vendor documentation does not list. |

## Native and API capabilities

The `efforts` and `defaultEffort` fields describe native choices. The `apiEfforts` and `apiDefaultEffort` fields keep API facts where they differ. APK offers and validates only the native set for known IDs.

An effort level that the native picker does not show is not proof that the native file rejects it. For example, Codex 0.166.0 does not show `none` in its picker. APK still does not offer `none` for known Codex models.

`ultra` is a delegating execution mode in Codex. The catalog records it in `delegationModes`. APK does not offer it as an effort level.

## ChatGPT (Codex)

The inventory has 9 model IDs from the catalog that is bundled with Codex CLI 0.166.0. The signed-in server catalog of 2026-11-01 shows 8, because GPT-5.5 left Codex for ChatGPT sign-in on 2026-10-14. Efforts follow the bundled catalog. Defaults follow the server catalog where it differs.

| ID | Label | Native efforts | Native default |
|---|---|---|---|
| `gpt-6-astra` | GPT-6 Astra | low, medium, high, xhigh, max | medium (bundled: low) |
| `gpt-6.1-sol` | GPT-6.1 Sol | low, medium, high, xhigh, max | low |
| `gpt-6.1-terra` | GPT-6.1 Terra | low, medium, high, xhigh, max | low |
| `gpt-6-sol` | GPT-6 Sol | low, medium, high, xhigh, max | medium |
| `gpt-6-luna` | GPT-6 Luna | low, medium, high, xhigh, max | medium |
| `gpt-5.6-sol` | GPT-5.6 Sol | low, medium, high, xhigh, max | low |
| `gpt-5.6-terra` | GPT-5.6 Terra | low, medium, high, xhigh, max | medium |
| `gpt-5.6-luna` | GPT-5.6 Luna | low, medium, high, xhigh, max | medium |
| `gpt-5.5` | GPT-5.5 (API key only) | low, medium, high, xhigh | medium |

- The ChatGPT level set for custom IDs is none, minimal, low, medium, high, xhigh and max.
- `ultra` is a delegation mode of Astra, both Sol models, both Terra models and GPT-5.6 Sol.
- Excluded: the hidden specialized selectors `gpt-daybreak-blue-latest` and `gpt-daybreak-red-latest`, the internal utility `codex-auto-review`, and the hidden, undocumented `gpt-reserve` from the server catalog.

## Claude (Claude Code)

The inventory has 14 versioned IDs, 4 family aliases and `inherit`. The review checked Claude Code 2.1.316.

| ID | Label | Native efforts | Native default |
|---|---|---|---|
| `claude-fable-5-1` | Fable 5.1 | low, medium, high, xhigh, max | high |
| `claude-opus-5-5` | Opus 5.5 | low, medium, high, xhigh, max | medium |
| `claude-sonnet-5-5` | Sonnet 5.5 | low, medium, high, xhigh, max | medium |
| `claude-haiku-5-5` | Haiku 5.5 | low, medium, high, xhigh, max | medium |
| `claude-fable-5` | Fable 5 | low, medium, high, xhigh, max | high |
| `claude-opus-5` | Opus 5 | low, medium, high, xhigh, max | high |
| `claude-sonnet-5` | Sonnet 5 | low, medium, high, xhigh, max | high |
| `claude-opus-4-8` | Opus 4.8 | low, medium, high, xhigh, max | high |
| `claude-opus-4-7` | Opus 4.7 | low, medium, high, xhigh, max | xhigh |
| `claude-opus-4-6` | Opus 4.6 | low, medium, high, max | high |
| `claude-sonnet-4-6` | Sonnet 4.6 | low, medium, high, max | high |
| `claude-opus-4-5-20251101` | Opus 4.5 | none | not documented |
| `claude-sonnet-4-5-20250929` | Sonnet 4.5 (retires 2026-11-30) | none | not documented |
| `claude-haiku-4-5-20251001` | Haiku 4.5 | none | not documented |
| `fable` | Fable (alias) | low, medium, high, xhigh, max | high |
| `opus` | Opus (alias) | low, medium, high, xhigh, max | not documented |
| `sonnet` | Sonnet (alias) | low, medium, high, xhigh, max | not documented |
| `haiku` | Haiku (alias) | low, medium, high, xhigh, max | not documented |
| `inherit` | Inherit main model | low, medium, high, xhigh, max | not documented |

- The native effort table of Claude Code omits Opus 4.5, although the API supports effort for it (`apiEfforts`: low, medium, high). The page therefore offers no effort for Opus 4.5.
- Alias and `inherit` rows list the levels that a role can request. The resolved provider model can clamp or ignore them. Aliases can resolve to a different model over time and per provider. Use a versioned ID when you need predictable capabilities.
- Excluded: `best`, `default`, `opus[1m]`, `opusplan` and `sonnet[1m]`. These are session or context selectors, not distinct subagent models. A custom native ID stays available.

## Kimi (Kimi Code)

The inventory has 6 upstream models through preferred native aliases. The review checked Kimi Code 2.4.1 and corroborated the aliases through provisioned metadata. Native aliases use the `kimi-code/` prefix.

| ID | Label | Upstream ID | Native efforts | Native default |
|---|---|---|---|---|
| `kimi-code/k3.1-pro` | K3.1 Pro | `k3.1-pro` | low, high, max | high |
| `kimi-code/k3.1-pro-highspeed` | K3.1 Pro Highspeed | `k3.1-pro-highspeed` | low, high, max | high |
| `kimi-code/k3` | K3 | `k3` | low, high, max | high |
| `kimi-code/k3-256k` | K3 · 256K | `k3-256k` | low, high, max | high |
| `kimi-code/kimi-for-coding` | K2.8 Preview | `kimi-for-coding` | low, high, max | max |
| `kimi-code/kimi-for-coding-highspeed` | K2.7 Code HighSpeed | `kimi-for-coding-highspeed` | none | not documented |

- Both K3.1 Pro variants require thinking (`thinkingRequired`).
- K2.8 Preview has no medium level.
- The old kimi.ai help page lists only four IDs. It is not the inventory source.
- An alias must exist in the native configuration before setup. For how setup resolves a missing preferred alias, see [AI assistants](assistants.md#kimi-kimi-code).

## Gemini (Antigravity)

The native role field takes a tier, not a model ID. The review checked the Antigravity CLI 1.4.12.

| ID | Label | Documented |
|---|---|---|
| `pro` | Pro | yes |
| `flash` | Flash | yes |
| `flash_lite` | Flash Lite | no |
| `inherit` | Inherit main model | yes |

- The Antigravity subagent documentation lists only `inherit`, `flash` and `pro`. The parser of CLI 1.4.12 also accepts `flash_lite`. Presets that use Flash Lite therefore rely on an undocumented tier.
- Google does not document which Gemini model each tier uses. The server sets it for each account.
- The session model inventory of Antigravity is a different surface. The role tier field cannot select it.
- There is no per-role effort. `--effort` and `/effort` apply to the whole session.

## Grok (Grok Build)

The inventory has 4 model IDs from the documented xAI model list. The review checked Grok Build 1.0.70.

| ID | Label | Native efforts | API efforts |
|---|---|---|---|
| `grok-4.7` | Grok 4.7 | none | low, medium, high (default), xhigh |
| `grok-4.6` | Grok 4.6 | none | not recorded |
| `grok-4.5` | Grok 4.5 | none | not recorded |
| `grok-build-0.1` | Grok Build 0.1 | none | not recorded |

The Grok 4.7 levels are API capabilities. APK writes only a model for each Grok role, so the catalog has no native efforts for Grok. For how Grok Build resolves subagent effort, see [Roles](roles.md#how-effort-applies).

## Lifecycle

| Model | Status | Date | Scope |
|---|---|---|---|
| GPT-5.5 | retired | 2026-10-14 | Codex with ChatGPT sign-in. API-key sign-in keeps access. |
| Sonnet 4.5 | deprecated since 2026-09-30 | retirement 2026-11-30 | Claude API, Claude Platform on AWS, Claude Models on Google Cloud (Anthropic managed) and Microsoft Foundry. Replacement: `claude-sonnet-5-5`. |
| Opus 4.5 | active (legacy) | earliest retirement 2026-11-24 | Anthropic-operated platforms and Microsoft Foundry. No deprecation notice. |
| Haiku 4.5 | active (legacy) | earliest retirement 2026-10-15 | Anthropic-operated platforms and Microsoft Foundry. No deprecation notice. |

Partner platforms set their own schedules:

| Model | Amazon Bedrock | Google Cloud (Google managed) |
|---|---|---|
| Sonnet 4.5 | Legacy. End of life 2027-04-08. | No retirement date announced. The earliest retirement date, 2026-09-29, passed. |
| Opus 4.5 | Not on the legacy list | Earliest retirement 2026-11-24 |
| Haiku 4.5 | Not on the legacy list | Earliest retirement 2026-12-07 |

- This is the state on 2026-11-02. Sonnet 4.5 still works for organizations that already have access, so the catalog records it as deprecated, not retired. The Anthropic Models API describes a deprecated model as closed to new adopters, so a new account can already fail with it.
- The page offers Sonnet 4.5 with the label "Sonnet 4.5 (retires 2026-11-30)". After that date, a role that names `claude-sonnet-4-5-20250929` fails on the Claude API, Claude Platform on AWS, Claude Models on Google Cloud (Anthropic managed) and Microsoft Foundry. Choose Sonnet 5.5 instead.
- Anthropic gives at least 60 days' notice before it retires a model. Opus 4.5 and Haiku 4.5 had no deprecation notice, so their earliest retirement dates are floors, not scheduled dates. The date for Haiku 4.5, 2026-10-15, passed without an announcement.
- The Claude Code aliases `sonnet`, `haiku` and `default` can resolve to these 4.5 models on some providers. See [AI assistants](assistants.md#claude-model-aliases-on-other-providers).

A release does not keep a retired model available. See [Updates and removal](../guide/updates-and-removal.md).

## Access requirements

A catalog entry does not grant access. The account plan and the provider decide access.

- **GPT-6.1 Terra** launched on 2026-10-26 for the Plus, Pro, Business, Enterprise and Edu plans.
- **Fable 5.1** requires Claude Code 2.1.257 or later. On Pro it uses usage credits. On Max and Ultra it has its own weekly limit. Some non-interactive native paths bill those credits without a consent prompt. APK does not change billing settings.
- **K3 and K3.1 Pro** need the Kimi Plus plan (legacy name Moderato) or higher.
- **The 1M context of K3 and every Highspeed model** need the Kimi Pro plan (legacy name Allegretto) or higher. On Plus, K3 stays at 256K context and still uses about twice the quota of K3 256K.
- **Quota:** Kimi documents about twice the quota usage for K3.1 Pro Highspeed compared with K3.1 Pro, and for K3 compared with K3 256K. K2.7 Code HighSpeed uses about three times the quota.
- **Grok:** account access to each model varies by plan.

## Sources

Each entry has a `source` URL in `models/catalog.json`. The main sources are:

- ChatGPT: [OpenAI models](https://learn.chatgpt.com/docs/models) and the Codex CLI 0.166.0 bundled and server catalogs.
- Claude: [Claude Code model configuration](https://code.claude.com/docs/en/model-config), [model lifecycle](https://platform.claude.com/docs/en/about-claude/model-deprecations), [Bedrock legacy models](https://docs.aws.amazon.com/bedrock/latest/userguide/model-lifecycle-legacy.html) and [Google partner model deprecations](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/deprecations/partner-models).
- Kimi: [Kimi Code models](https://www.kimi.com/code/docs/en/kimi-code/models) and [membership](https://www.kimi.com/code/docs/en/kimi-code/membership.html).
- Gemini: [Antigravity subagents](https://antigravity.google/docs/subagents?tab=cli) and the CLI 1.4.12 parser.
- Grok: [xAI models](https://docs.x.ai/developers/models) and [Grok Build subagents](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/16-subagents.md).

For how maintainers update the catalog for a release, see [Model review procedure](../maintainers/model-review.md).
