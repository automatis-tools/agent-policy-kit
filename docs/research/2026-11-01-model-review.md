# Model review of 2026-11-01

This document records the evidence behind the presets and the model catalog of APK 0.4.0. It is for maintainers who prepare the next review and for users who want to know why a preset has its values. It lists the sources per vendor, compares Opus 5.5 with Sonnet 5.5 at different effort levels, compares Fable 5.1 with Opus 5.5, and summarizes what the evidence says about effort and small models. It also lists the decisions of 0.4.0 and the questions that need local verification. The current preset values are in [presets](../reference/presets.md). The catalog fields are in [model catalog](../reference/model-catalog.md). The procedure for the next review is in [model review](../maintainers/model-review.md).

## Scope and method

The review date is 2026-11-01 (UTC). The previous catalog check was on 2026-10-30. The review covers the five assistants that APK configures and the six roles: Coder, Reviewer, Code explorer, Test writer, Docs writer and Task runner. It covers 105 preset cells: 90 cells in Light, Standard and Top-tier (6 roles × 5 assistants × 3 presets) and 15 cells under the top models switch (3 roles × 5 assistants).

These native clients were inspected read-only:

| Assistant | Native client | Version | What was read |
|---|---|---|---|
| ChatGPT | Codex CLI | 0.166.0 | Bundled model catalog (`codex debug models --bundled`), the model catalog that a signed-in client receives from the server, release notes |
| Claude | Claude Code | 2.1.316 | `claude --help`, release notes of 2.1.312 to 2.1.316 |
| Kimi | Kimi Code CLI | 2.4.1 | Release notes, model metadata that Kimi Code provisions (model fields only) |
| Gemini | Antigravity CLI | 1.4.12 | `agy --help`, `agy changelog`, the subagent tier values that the parser accepts |
| Grok | Grok Build | 1.0.70 | The user guide that ships with the client, the client model list |

The review used the vendor documentation that the sections below cite. All pages were read on 2026-11-01. No benchmark or task evaluation was run for this review. Native settings were not changed. Account data, credentials and configuration files are not part of this document. Where a fact depends on the account or plan, this document says so and does not state what one account can use.

The research had one thread for each vendor and one thread for cross-vendor benchmarks and effort studies. A synthesis compared the findings with the 0.3.0 presets and proposed changes. [Decisions for 0.4.0](#decisions-for-040) lists the changes that the release adopted.

## Primary and secondary sources

Each number in this document has a source link and a source type.

- **Primary** sources are vendor documentation, vendor announcements and model cards, the native clients, publications of independent benchmark operators (Artificial Analysis, Vals AI) and research papers. A preset change can rely on primary sources.
- **Secondary** sources are aggregators, blogs and press articles that repeat or summarize other numbers (for example apidog, mindstudio, datacamp, BenchLM, benchmarklist, OfficeChai, BleepingComputer). This document uses secondary numbers only to show a direction when no primary number exists. No preset change of 0.4.0 relies only on secondary sources.

Vendor self-reported benchmark numbers are primary for what the vendor claims. They are not independent measurements.

## Findings per vendor

### OpenAI (ChatGPT, Codex)

No OpenAI model was released or retired for Codex after 2026-10-30. GPT-6.1 Terra (2026-10-26) is the newest model. There is no GPT-6.1 Luna. The current Luna is `gpt-6-luna`.

| Finding | Source |
|---|---|
| The bundled catalog of Codex CLI 0.166.0 has 9 visible selectors and 3 hidden specialized or utility entries. | Codex CLI 0.166.0 (primary) |
| A signed-in Codex CLI catalog observed on 2026-11-01 lists 8 visible models. GPT-5.5 is not in it. The server catalog can vary by account or plan. | Codex CLI 0.166.0 (primary) |
| GPT-5.5 retired from Codex for ChatGPT sign-in on 2026-10-14. It remains available with API-key sign-in. | [Codex models](https://learn.chatgpt.com/docs/models) (primary) |
| The server catalog gives GPT-6 Astra a native default effort of medium. The bundled catalog says low. | Codex CLI 0.166.0 (primary) |
| The server catalog has a hidden, undocumented entry `gpt-reserve`. | Codex CLI 0.166.0 (primary) |
| GPT-6.1 Sol has a context of 500,000 tokens by default in Codex. The bundled metadata says 272K. | [Codex models](https://learn.chatgpt.com/docs/models) (primary) |
| GPT-6.1 Terra is available in Codex on Plus, Pro, Business, Enterprise and Edu plans since 2026-10-26. | [Codex changelog](https://learn.chatgpt.com/docs/changelog) (primary) |
| The `developers.openai.com/codex/*` pages now redirect to `learn.chatgpt.com/docs/*`. | [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) (primary) |

Positioning. OpenAI describes Astra as its most capable model for complex work and GPT-6.1 Sol as "near-Astra performance for complex work at a lower cost than Astra". Terra is "a fast, efficient model for clear writing, visual understanding, and computer use". Luna is for "focused, high-volume tasks", and OpenAI says "Start with High" for Luna. Source: [Codex models](https://learn.chatgpt.com/docs/models) (primary). Launch coverage says that OpenAI still recommends Sol or Astra for the most complex coding tasks. Source: [BleepingComputer](https://bleepingcomputer.com/news/artificial-intelligence/openai-launches-gpt-61-terra-with-3x-faster-ai-agents-50-percent-lower-pricing) (secondary).

Plan usage. Codex credits per 1M tokens (input / cached input / output) are: Astra 250 / 25 / 1,250, GPT-6.1 Sol 50 / 2.5 / 250, GPT-6.1 Terra 25 / 1.25 / 125, GPT-6 Luna 2.5 / 0.25 / 12.5. Relative to Sol, Astra costs 5 times, Terra 0.5 times and Luna 0.05 times per token. Source: [Codex pricing](https://learn.chatgpt.com/docs/pricing) (primary).

Subagent guidance. OpenAI suggests `gpt-6.1-sol` for "ambiguous, multi-step work" and `gpt-6-luna` for "lighter subagent work". For explicit settings it suggests starting at high for Luna and at low for Astra. High is for agents that "trace complex logic, check assumptions, or work through edge cases", and medium "balances speed and depth". The examples use `pr_explorer` on Luna at high and `reviewer` on Sol at medium. The page does not mention Terra. Source: [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) (primary).

Benchmarks:

| Measurement | Value | Source |
|---|---|---|
| Artificial Analysis Coding Agent Index: GPT-6.1 Sol, GPT-6.1 Terra (max), GPT-6 Luna | 54, 48, 31 | [Artificial Analysis: GPT-6.1 Terra](https://artificialanalysis.ai/articles/gpt-6-1-terra-pushes-the-cost-efficiency-frontier) (primary) |
| Terra: low and medium effort are "Pareto-optimal for cost efficiency" | — | same (primary) |
| Terminal-Bench 4.0, Artificial Analysis run: Astra, Sol | 59.1%, 56.1% | [benchmarklist](https://benchmarklist.com/models/openai-gpt-6.1-sol/) (secondary) |
| DeepSWE 1.1: Sol, Astra, Luna | 75.2%, 74.1%, 66.6% | [benchmarklist](https://benchmarklist.com/models/openai-gpt-6.1-sol/), [BenchLM](https://benchlm.ai/md/compare/gpt-6-astra-vs-gpt-6-luna.md) (secondary) |
| Terminal-Bench 4.0, Terra at max (OpenAI claim) | 50.3% | [BleepingComputer](https://bleepingcomputer.com/news/artificial-intelligence/openai-launches-gpt-61-terra-with-3x-faster-ai-agents-50-percent-lower-pricing) (secondary) |

Astra has a small lead over Sol on two of three available measurements. OpenAI publishes no quality figures for Astra at different effort levels.

### Anthropic (Claude, Claude Code)

No Anthropic model was released after 2026-10-30. The current models are Fable 5.1, Opus 5.5, Sonnet 5.5 and Haiku 5.5. Source: [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) (primary). The Anthropic news page showed an untitled item dated 2026-11-01 that could not be identified. Source: [Anthropic news](https://www.anthropic.com/news) (primary).

| Finding | Source |
|---|---|
| API prices per 1M tokens (input / output): Fable 5.1 $10 / $50, Opus 5.5 $4 / $20, Sonnet 5.5 $2 / $10, Haiku 5.5 $0.10 / $0.50 for prompts up to 100K tokens ($0.50 / $2.50 above). | [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) (primary) |
| In Claude Code, Opus 5.5, Sonnet 5.5 and Haiku 5.5 default to medium effort. Fable 5.1 defaults to high. All four support low, medium, high, xhigh and max. | [Model configuration](https://code.claude.com/docs/en/model-config) (primary) |
| On the Claude Platform API, Sonnet 5.5 defaults to high, not medium. | [Sonnet 5.5](https://www.anthropic.com/claude-sonnet-5-5) (primary) |
| Subagent model order: the Agent tool `model` parameter, frontmatter `model`, `CLAUDE_CODE_SUBAGENT_MODEL`, then the main model. The built-in Explore subagent uses the main conversation's model. | [Subagents](https://code.claude.com/docs/en/sub-agents) (primary) |
| Frontmatter `effort` overrides the session effort but not `CLAUDE_CODE_EFFORT_LEVEL`. | [Model configuration](https://code.claude.com/docs/en/model-config) (primary) |
| Claude Code 2.1.316 adds `CLAUDE_CODE_SUBAGENT_EFFORT`. It sets the effort of subagents that name no effort, instead of the session effort. The documentation pages do not describe it yet. | Claude Code 2.1.316 release notes, installed with the client (primary) |
| Sonnet 4.5 (`claude-sonnet-4-5-20250929`) is deprecated and retires on 2026-11-30. Opus 4.5 retires not sooner than 2026-11-24. Haiku 4.5 retires not sooner than 2026-10-15; that date passed without a deprecation notice. | [Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations) (primary) |
| Plans: Pro, Max ($100, 5 times Pro) and Ultra ($200, no 5-hour limit). On Pro, Fable uses usage credits. On Max and Ultra, Fable has a separate weekly limit. | [Claude pricing](https://claude.com/pricing), [Use Claude Code with your Pro or Max plan](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan) (primary) |
| In non-interactive `-p` mode, Fable usage is billed without a consent prompt. | [Model configuration](https://code.claude.com/docs/en/model-config) (primary) |

Anthropic gives no per-role model matrix. Its guidance is in [Anthropic's guidance](#anthropics-guidance).

### Moonshot (Kimi, Kimi Code)

No Kimi model was released after 2026-10-30. K3.1 Pro (fully rolled out on 2026-10-23) is the newest. Kimi Code has six model IDs, and `kimi-for-coding` is still K2.8 Preview. Sources: [Kimi Code models](https://www.kimi.com/code/docs/en/kimi-code/models.html), [What's New](https://www.kimi.com/code/docs/en/kimi-code/whats-new.html) (primary).

| Finding | Source |
|---|---|
| `k3` (1M context) uses about twice the quota of `k3-256k`. Moonshot suggests `k3-256k` for "routine feature work" and `k3` for "large codebase analysis, multi-file refactoring". | [Models](https://www.kimi.com/code/docs/en/kimi-code/models.html), [Overview](https://www.kimi.com/code/docs/en/) (primary) |
| K2.7 Code Highspeed uses about three times the quota. K3.1 Pro Highspeed uses about twice the quota of K3.1 Pro. | [Models](https://www.kimi.com/code/docs/en/kimi-code/models.html) (primary) |
| K3 and K3.1 Pro need Plus (legacy Moderato) or higher. The 1M context and all Highspeed models need Pro (legacy Allegretto) or higher. Go has no coding quota. | [Membership](https://www.kimi.com/code/docs/en/kimi-code/membership.html) (primary) |
| Kimi Code 2.4.1 (2026-10-30) limits one file read to 100,000 characters (before: 500,000). It does not change models or effort. | [Kimi Code releases](https://github.com/MoonshotAI/kimi-code/releases) (primary) |
| A 2.4.1 pre-release listed "limit subagents to the configured model pool". The stable 2.4.1 does not include it. | [Kimi Code releases](https://github.com/MoonshotAI/kimi-code/releases) (primary) |
| The overview page gives `k3.1-pro` a default of max. The models page and What's New give high. | [Overview](https://www.kimi.com/code/docs/en/), [Models](https://www.kimi.com/code/docs/en/kimi-code/models.html) (primary) |

Moonshot gives no guidance on models for subagents. No independent benchmark of K3.1 Pro was found. Moonshot reports 65.7% on Terminal-Bench 4.0 for K3.1 Pro. Source: [datacamp](https://www.datacamp.com/blog/kimi-k3-1-pro) (secondary). The Artificial Analysis Intelligence Index is reported as 55 for K3.1 Pro and 44 for K3. Source: [OfficeChai](https://officechai.com/ai/kimi-k3-1-pro-places-4th-on-artificial-analysis-intelligence-index-ahead-of-gpt-6-astra-gemini-4-argon/) (secondary).

APK sets Kimi effort per model alias, not per role. Roles that share one alias share one effort. [Roles](../reference/roles.md) describes this.

### Google (Gemini, Antigravity)

Antigravity 1.4.12 did not add tiers or per-role effort.

| Finding | Source |
|---|---|
| The agent `model` field of the CLI accepts only `inherit`, `flash_lite`, `flash` and `pro`. | Antigravity CLI 1.4.12 parser (primary) |
| The subagent documentation lists only `inherit`, `flash` and `pro`. `flash_lite` is undocumented. | [Antigravity subagents](https://antigravity.google/docs/subagents) (primary) |
| Effort applies only to the whole session (`--effort`, `/effort`). Agent files have no effort field. | `agy --help`, Antigravity CLI 1.4.12 (primary) |
| The built-in tier text describes `flash` as "suited for simple tasks like research lookups, file reading, or quick searches" and `pro` as "suited for complex tasks requiring deep reasoning, large refactors, or multi-step planning". | Antigravity CLI 1.4.12 (primary) |
| Current models: Gemini 4 Argon (flagship), Gemini 3.8 Flash and Gemini 3.5 Flash-Lite. | [Gemini API models](https://ai.google.dev/gemini-api/docs/models) (primary) |
| Gemini 4 Argon access: the Google blog names AI Ultra subscribers. The Antigravity blog names AI Pro and Ultra subscribers. | [Introducing Gemini 4 Argon](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-argon/), [Gemini 4 Argon in Antigravity](https://antigravity.google/blog/gemini-4-argon-in-google-antigravity/) (primary) |
| Antigravity quotas for Pro and Ultra refresh every five hours. Ultra gives 5 or 20 times the Pro quota. Google publishes no quota per tier. | [Antigravity rate limits](https://blog.google/feed/new-antigravity-rate-limits-pro-ultra-subsribers/), [Google AI Ultra benefits](https://support.google.com/googleone/answer/16286513?hl=en) (primary) |

Google does not document which Gemini model each tier uses. The CLI receives the tier settings from the server. Tier-to-model resolution varies by account and was not verified.

Benchmarks:

| Measurement | Value | Source |
|---|---|---|
| Gemini 3.8 Flash: SWE-Bench Pro, Terminal-Bench 2.1 | 61.6%, 90.8% | [Google Cloud: Gemini 3.8 Flash](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-flash) (primary) |
| Gemini 3.8 Flash: Terminal-Bench 4.0 | 19.1% | [Vellum](https://www.vellum.ai/blog/gemini-3-8-flash-benchmarks-explained), [datacamp](https://www.datacamp.com/blog/gemini-3-8-flash-cyber), [cellcog](https://cellcog.ai/blog/gemini-3-8-flash/) (secondary) |
| Gemini 4 Argon: Terminal-Bench 4.0 (Opus 5.5: 66.4%) | 57.4% | [mindstudio](https://www.mindstudio.ai/blog/gemini-4-argon-benchmark-analysis) (secondary) |
| Gemini 4 Carbon (not publicly available) with Antigravity CLI vs Claude Code with Opus 5.5 (max): Coding Agent Index | 59 vs 62 | [Artificial Analysis: Gemini 4 Carbon](https://artificialanalysis.ai/articles/gemini-4-carbon-new-number-1) (primary) |

No coding benchmark was found for Gemini 3.5 Flash-Lite.

### xAI (Grok, Grok Build)

The xAI model list has no new language model after 2026-10-30 and no deprecated language model. The four catalog IDs (`grok-4.7`, `grok-4.6`, `grok-4.5`, `grok-build-0.1`) are current. Source: [xAI models](https://docs.x.ai/developers/models) (primary).

| Finding | Source |
|---|---|
| API prices per 1M tokens (input / output, prompts below 200K): grok-4.7 $2 / $6, grok-build-0.1 $1 / $2. | [xAI models](https://docs.x.ai/developers/models) (primary) |
| xAI says: "For everything else, including code, use Grok 4.7." | [xAI models](https://docs.x.ai/developers/models) (primary) |
| The Grok Build model list gives grok-4.7 the reasoning levels low, medium, high (default) and xhigh. | Grok Build 1.0.70 (primary) |
| Grok Build resolves subagent effort in this order: spawn override, role default, persona default, parent session. Personas have a `reasoning_effort` field. | Grok Build 1.0.70 user guide, chapter 16 (primary). The public copy is [Grok Build subagents](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/16-subagents.md); it was not compared with the installed copy. |
| `[subagents.models]` entries set only a model string. | Grok Build 1.0.70 configuration reference (primary) |
| grok-build-0.1 always reasons and has no effort setting. | [Vercel AI Gateway: grok-build-0.1](https://vercel.com/ai-gateway/models/grok-build-0.1) (secondary) |
| The user guide of 1.0.70 still says that new sessions start with `grok-4.5`. The client reports grok-4.7 as its default. This is stale upstream documentation. | Grok Build 1.0.70 (primary) |

Benchmarks:

| Measurement | Value | Source |
|---|---|---|
| Grok 4.7 (xhigh) vs Grok 4.6 (high): CursorBench 4.0 | 46.3% vs 40.4% | [xAI: Grok 4.7](https://x.ai/news/grok-4-7) (primary) |
| Grok 4.7 vs Grok 4.6: DeepSWE 1.1 (high) | 71.0% vs 65.2% | [xAI: Grok 4.7](https://x.ai/news/grok-4-7) (primary) |
| Grok 4.7: Terminal-Bench 4.0 | 37.6% in the announcement, 38.0% in the model card | [xAI: Grok 4.7](https://x.ai/news/grok-4-7), [Grok 4.7 model card](https://media.x.ai/v1/website/card4p7-3a96f40b.pdf) (primary) |
| Grok 4.7 (xhigh) with Grok Build: Coding Agent Index | 56 | [Artificial Analysis: Grok 4.7](https://artificialanalysis.ai/articles/benchmarking-grok-4-7) (primary; read through a search summary, not directly) |

No current benchmark was found for grok-build-0.1. No official source describes how Grok Build usage counts per model on xAI plans.

## Opus 5.5 and Sonnet 5.5

This comparison decides the Claude Coder of Standard and Top-tier. The sources seem to disagree. At max or xhigh, Sonnet 5.5 is almost equal to Opus 5.5. At equal high effort, Sonnet 5.5 is clearly behind. The difference comes from effort: Sonnet 5.5 reaches Opus 5.5 only at the levels where one Sonnet task costs more than one Opus task at medium.

### Prices

| Model | Input per 1M tokens | Output per 1M tokens | Source |
|---|---|---|---|
| Opus 5.5 | $4 | $20 | [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) (primary) |
| Sonnet 5.5 | $2 | $10 | [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) (primary) |

Per token, Opus 5.5 costs twice as much as Sonnet 5.5. Subscription plans meter usage differently from API prices. Use the API prices only to compare the two models.

### Results at max and xhigh

| Measurement | Opus 5.5 | Sonnet 5.5 | Source |
|---|---|---|---|
| Artificial Analysis Coding Agent Index v2.0, Claude Code, max effort | 61.7 | 59.3 | [Artificial Analysis](https://x.com/ArtificialAnlys/status/2113424551396934134) (primary) |
| Vals AI Terminal-Bench 4.0 (Mini-SWE-agent harness) | 65.15% | 64.14% | [Vals AI: Terminal-Bench 4.0](https://www.vals.ai/benchmarks/terminal-bench-4) (primary) |
| Anthropic: Terminal-Bench 4.0 (Opus at xhigh, Sonnet at its reported effort) | 66.4% | 70.6% | [Sonnet 5.5](https://www.anthropic.com/claude-sonnet-5-5) (primary) |
| Anthropic: CursorBench 4.0 | 57.8% | 55.5% | [Sonnet 5.5](https://www.anthropic.com/claude-sonnet-5-5) (primary) |
| Anthropic: FrontierCode (Sonnet at max) | 54.4% | 46.2% | [Sonnet 5.5](https://www.anthropic.com/claude-sonnet-5-5) (primary) |
| Anthropic: FrontierCode, Sonnet 5.5 at xhigh | — | 52.1% | [Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5) (primary) |

Caveat for the Terminal-Bench lead of Sonnet 5.5 in Anthropic's numbers: apidog reports, with the system card as its source, that a fallback was used in 1.5% of Sonnet 5.5 trials and in 10% of Opus 5.5 trials. Source: [apidog](https://apidog.com/blog/claude-sonnet-5-5-benchmarks/) (secondary). This review did not check the caveat in the system card.

The two independent measurements put Opus 5.5 ahead by 2.4 index points and by about 1 percentage point. At these effort levels the models are almost equal.

### Results at equal high effort

Only one source compares the two models at the same effort level. It is secondary: apidog cites the Sonnet 5.5 system card. This review did not check these numbers against the system card. The cost is the API cost of one attempt at one task.

| Benchmark | Sonnet 5.5 high | Opus 5.5 high | Source |
|---|---|---|---|
| Terminal-Bench 4.0 | 43.0% ($1.94) | 64.2% ($3.88) | [apidog](https://apidog.com/blog/claude-sonnet-5-5-benchmarks/) (secondary) |
| FrontierCode | 49.4% ($0.42) | 54.0% ($1.09) | [apidog](https://apidog.com/blog/claude-sonnet-5-5-benchmarks/) (secondary) |
| CursorBench | 47.8% ($1.67) | 56.0% ($3.97) | [apidog](https://apidog.com/blog/claude-sonnet-5-5-benchmarks/) (secondary) |

The same source gives two more Terminal-Bench 4.0 results: Opus 5.5 at medium 57.6% ($2.94) and Sonnet 5.5 at xhigh 61.5% ($5.30). Source: [apidog](https://apidog.com/blog/claude-sonnet-5-5-benchmarks/) (secondary). The source has no result for Sonnet 5.5 at medium, which is the Standard Coder setting.

Anthropic gives two primary results for Opus 5.5 at medium: FrontierCode 54.6% and CursorBench 52.5%. Source: [Opus 5.5](https://www.anthropic.com/claude-opus-5-5) (primary). On FrontierCode, Opus 5.5 at medium (54.6%) is above Sonnet 5.5 at xhigh (52.1%) and at max (46.2%) in Anthropic's own numbers. The two Anthropic pages do not say that they used the same harness.

### Cost per solved task

The cost per solved task is derived in this document. It is the cost of one attempt divided by the success rate, from the apidog numbers above. No source publishes these values.

| Benchmark | Setting | Success rate | Cost per attempt | Cost per solved task (derived) |
|---|---|---|---|---|
| Terminal-Bench 4.0 | Sonnet 5.5 high | 43.0% | $1.94 | $4.51 |
| Terminal-Bench 4.0 | Opus 5.5 medium | 57.6% | $2.94 | $5.10 |
| Terminal-Bench 4.0 | Opus 5.5 high | 64.2% | $3.88 | $6.04 |
| Terminal-Bench 4.0 | Sonnet 5.5 xhigh | 61.5% | $5.30 | $8.62 |
| FrontierCode | Sonnet 5.5 high | 49.4% | $0.42 | $0.85 |
| FrontierCode | Opus 5.5 high | 54.0% | $1.09 | $2.02 |
| CursorBench | Sonnet 5.5 high | 47.8% | $1.67 | $3.49 |
| CursorBench | Opus 5.5 high | 56.0% | $3.97 | $7.09 |

What the derived values show:

- At high, Sonnet 5.5 has the lowest cost per solved task on all three benchmarks, but it solves fewer tasks.
- On Terminal-Bench 4.0, Opus 5.5 at medium solves 14.6 percentage points more tasks than Sonnet 5.5 at high. Its cost per solved task is about 13% higher.
- Sonnet 5.5 at xhigh costs more per solved task than Opus 5.5 at high, and it solves fewer tasks (61.5% vs 64.2%).

### The Sonnet 5.5 regression at max

Anthropic reports that Sonnet 5.5 scored lower on FrontierCode at max than at xhigh. At max it ran a subagent-based code-review skill more often. This caused timeouts or edits outside the task. Source: [Sonnet 5.5](https://www.anthropic.com/claude-sonnet-5-5) (primary). This is a direct reason not to use max for subagent roles.

### Anthropic's guidance

| Guidance | Source |
|---|---|
| "Sonnet handles most coding tasks well and costs less than Opus. Reserve Opus for complex architectural decisions or multi-step reasoning." For simple subagent tasks, use `model: haiku`. For agent teams, "Use Sonnet for teammates". | [Costs](https://code.claude.com/docs/en/costs) (primary) |
| Medium "fits day-to-day engineering with a clear scope". High is for "work where verification matters or edge cases are likely". Xhigh gives "deeper reasoning at higher token spend". Max "may show diminishing returns and is prone to overthinking". | [Model configuration](https://code.claude.com/docs/en/model-config) (primary) |
| The example read-only code reviewer uses Sonnet at high. | [Subagents](https://code.claude.com/docs/en/sub-agents) (primary) |
| Sonnet 5.5 is "a faster, lower-cost complement to Claude Opus 5.5" for "well-scoped everyday tasks, bug fixes". | [Sonnet 5.5](https://www.anthropic.com/claude-sonnet-5-5) (primary) |
| A customer (Factory) calls Opus 5.5 "the first model we'd default to at medium effort". This is a customer quote, not Anthropic guidance. | [Opus 5.5](https://www.anthropic.com/claude-opus-5-5) (primary) |

### What this means for the Standard Claude Coder

The Standard Claude Coder stays Sonnet 5.5 at medium in 0.4.0. The reasons:

- The equal-effort data that favors Opus 5.5 at medium comes only from a secondary source.
- No source measures Sonnet 5.5 at medium, so the current cell has no measured position.
- Anthropic's guidance puts Sonnet first for most coding.

The candidates for a local A/B comparison are Sonnet 5.5 at high and Opus 5.5 at medium. On Terminal-Bench 4.0 their derived costs per solved task are close ($4.51 and $5.10), and Opus 5.5 at medium solves more tasks. A test must use representative repository tasks and count the plan usage, not only the API price. The Coder effort also becomes the effort of unnamed subagents in Claude Code 2.1.316 and later (capped at high), so a change to the Coder also changes those subagents. [Roles](../reference/roles.md) describes this default subagent.

## Fable 5.1 and Opus 5.5

This comparison decides the Claude choice of the top models switch. The primary source is clear.

| Measurement | Opus 5.5 | Fable 5.1 | Source |
|---|---|---|---|
| Terminal-Bench 4.0 (Opus at xhigh) | 66.4% | 55.8% | [Opus 5.5](https://www.anthropic.com/claude-opus-5-5) (primary) |
| FrontierCode 1.1 | 54.4% | 50.3% | [Opus 5.5](https://www.anthropic.com/claude-opus-5-5) (primary) |
| CursorBench 4.0 | 57.8% | 51.8% | [Opus 5.5](https://www.anthropic.com/claude-opus-5-5) (primary) |
| OSWorld 2.1 | 81.8% | 80.7% | [Opus 5.5](https://www.anthropic.com/claude-opus-5-5) (primary) |
| DeepSWE 1.1 | 74.2% | 67.4% | [mindstudio](https://www.mindstudio.ai/blog/gemini-4-argon-benchmark-analysis) (secondary) |
| API price per 1M tokens (input / output) | $4 / $20 | $10 / $50 | [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) (primary) |

The strongest argument for Fable 5.1: Anthropic says that the gap is "narrower in its own use than the scores suggest", and it positions Fable 5.1 "for demanding reasoning and long-horizon agentic work". Sources: [Opus 5.5](https://www.anthropic.com/claude-opus-5-5), [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) (primary). But Anthropic suggests Fable 5.1 only "when your evals on Claude Opus 5.5 at higher effort still fall short". Source: [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) (primary). So the next step after Opus 5.5 at high is Opus 5.5 at a higher effort.

Fable 5.1 also has different billing. On Pro it uses usage credits, and on Max and Ultra it has a separate weekly limit. In `-p` mode it bills without a consent prompt. Sources: [Model configuration](https://code.claude.com/docs/en/model-config), [Use Claude Code with your Pro or Max plan](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan) (primary).

The gain of xhigh over high on Opus 5.5 is small: 66.4% (xhigh, primary, [Opus 5.5](https://www.anthropic.com/claude-opus-5-5)) against 64.2% (high, secondary, [apidog](https://apidog.com/blog/claude-sonnet-5-5-benchmarks/)) on Terminal-Bench 4.0. The switch therefore buys more reasoning on the same model, not a different model with separate billing.

## Effort returns

The returns from higher effort decrease quickly.

| Finding | Source |
|---|---|
| Opus 5 on repository tasks: 17 of 25 solved at low, 18 of 25 at high, 16 of 25 at xhigh. Cost per solved task: $0.75 at low, $1.89 at high, $3.62 at xhigh. | [arXiv 2608.01347](https://arxiv.org/pdf/2608.01347) (primary) |
| Opus 4.7, observational study: xhigh gave more first-try perfect results than high (6 of 6 vs 2 of 6) at about 9% higher median cost. The sample is six tasks. | [arXiv 2607.02436](https://arxiv.org/pdf/2607.02436) (primary) |
| GPT-6.1 Terra: low and medium effort are Pareto-optimal for cost efficiency. | [Artificial Analysis: GPT-6.1 Terra](https://artificialanalysis.ai/articles/gpt-6-1-terra-pushes-the-cost-efficiency-frontier) (primary) |
| Anthropic: max "may show diminishing returns and is prone to overthinking". | [Model configuration](https://code.claude.com/docs/en/model-config) (primary) |
| OpenAI: higher effort "increases response time and token usage". High is for checking assumptions and edge cases. Low is for when "speed matters most". | [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) (primary) |
| Sonnet 5.5 scored lower at max than at xhigh on FrontierCode. | [Sonnet 5.5](https://www.anthropic.com/claude-sonnet-5-5) (primary) |

No study compares how sensitive each role (review, test writing, exploration, documentation) is to model size or effort. The effort changes of 0.4.0 therefore rely on consistent vendor guidance, not on a role benchmark. Their confidence is medium.

The 0.4.0 presets apply this evidence where the assistant allows per-role effort. Review and test creation get high. Discovery and writing on a strong model get medium. A small model such as Luna can get high, because that is the vendor's starting level. No preset uses max. Presets pin at most high. The only exception is the Claude top models choice at xhigh. [Presets](../reference/presets.md) states the design principles.

## Small models

Small models are much weaker on multi-step agentic tasks. They are closer to larger models on narrow coding tasks.

| Measurement | Small model | Larger model | Source |
|---|---|---|---|
| Coding Agent Index | GPT-6 Luna 31 | GPT-6.1 Sol 54 | [Artificial Analysis: GPT-6.1 Terra](https://artificialanalysis.ai/articles/gpt-6-1-terra-pushes-the-cost-efficiency-frontier) (primary) |
| Terminal-Bench 4.0 | Haiku 5.5 39.2% (Haiku 4.5: 0.0%) | Sonnet 5.5 70.6% | [Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5) (primary) |
| FrontierCode | Haiku 5.5 46.4% | Sonnet 5.5 at xhigh 52.1% | [Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5) (primary) |
| SWE-Bench Pro | Haiku 5.5 64.8% | Sonnet 5.5 81.3% | [llm-stats](https://llm-stats.com/blog/research/claude-haiku-5-5-launch), [datacamp](https://www.datacamp.com/blog/claude-haiku-5-5) (secondary) |
| Terminal-Bench 4.0 | Gemini 3.8 Flash 19.1% | — | [Vellum](https://www.vellum.ai/blog/gemini-3-8-flash-benchmarks-explained), [datacamp](https://www.datacamp.com/blog/gemini-3-8-flash-cyber), [cellcog](https://cellcog.ai/blog/gemini-3-8-flash/) (secondary) |
| SWE-Bench Pro | Gemini 3.8 Flash 61.6% | — | [Google Cloud: Gemini 3.8 Flash](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-flash) (primary) |

Anthropic says that Haiku 5.5 "pairs well with Opus 5.5 and Sonnet 5.5 as a subagent on coding work". Source: [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) (primary). OpenAI suggests Luna for "lighter subagent work". Source: [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) (primary).

This supports the current design. In Standard, small models do exploration and routine work. In Top-tier, only the Task runner uses a lighter model. In Light, small models do all roles, with a deliberate loss of quality to save plan limits.

## Decisions for 0.4.0

The review proposed seven changes to nine of the 105 preset cells. The 0.4.0 release adopted all seven. [CHANGELOG.md](../../CHANGELOG.md) records them. Confidence is the confidence of the evidence, not a test result.

| Preset | Assistant | Cells | 0.3.0 | 0.4.0 | Main evidence | Confidence |
|---|---|---|---|---|---|---|
| Light | ChatGPT | Coder | Luna · medium | Luna · high | OpenAI says "Start with High" for Luna. Luna costs 0.05 times Sol per token. | Medium |
| Standard | ChatGPT | Docs writer | Sol · medium | Terra · medium | OpenAI positions Terra for clear writing. Terra costs 0.5 times Sol. Coding Agent Index: Terra 48, Luna 31. | Medium |
| Top-tier | ChatGPT | Code explorer | Sol · high | Sol · medium | OpenAI reserves high for edge-case checks and uses Luna for its explorer example. | Medium |
| Top-tier | ChatGPT | Docs writer | Sol · high | Sol · medium | Effort returns decrease. The Standard Docs writer already uses medium. | Medium |
| Top-tier | Claude | Code explorer | Opus 5.5 · high | Opus 5.5 · medium | Medium is the native default and the level for clear scope. Anthropic suggests a cheaper Explore. | Medium |
| Top-tier | Claude | Docs writer | Opus 5.5 · high | Opus 5.5 · medium | Same reasons as for the Code explorer. | Medium |
| Top models switch | Claude | Coder, Reviewer, Test writer | Fable 5.1 · high | Opus 5.5 · xhigh | Opus 5.5 leads Fable 5.1 on all published coding benchmarks at 2.5 times lower price. Anthropic suggests higher Opus effort before Fable. | Medium |

The release also changed setup for Claude. Setup writes `CLAUDE_CODE_SUBAGENT_EFFORT` from the Coder effort, capped at high. Before, subagents without a named role kept the main session effort in Claude, so the Coder effort never reached them. With the cap, the xhigh top models choice does not raise those subagents. Earlier Claude Code versions ignore the setting. This was a design decision based on the 2.1.316 release notes. Its precedence is an open question.

The catalog snapshot of 0.4.0 records these facts from this review: GPT-5.5 retired for ChatGPT sign-in, the GPT-6 Astra server default, the excluded `gpt-reserve`, the client versions, the Opus 4.5 and Haiku 4.5 retirement dates, the Kimi plan requirements, the undocumented Flash Lite tier and the Grok 4.7 reasoning levels. [Model catalog](../reference/model-catalog.md) describes the fields.

### Cells left unchanged on purpose

| Cell | Why it did not change |
|---|---|
| Standard, Claude, Coder: Sonnet 5.5 · medium | The equal-effort evidence is secondary. Anthropic suggests Sonnet for most coding. Candidates for a local A/B test: Sonnet 5.5 · high and Opus 5.5 · medium. See [What this means for the Standard Claude Coder](#what-this-means-for-the-standard-claude-coder). |
| Light, ChatGPT, Code explorer and Docs writer: Luna · low | OpenAI's "start with high" also applies, but Light saves usage on purpose. No data shows that low harms discovery or writing. |
| Top-tier, Kimi, Code explorer and Docs writer: K3 · high | They share the `kimi-code/k3` alias with the Coder, so their effort cannot go down alone. Moonshot suggests `k3` for large-codebase analysis. |
| Top-tier, Kimi, Task runner: K2.8 Preview · high | K2.8 Preview has no medium level. The alias effort is shared. |
| Top-tier, Reviewer at xhigh (all assistants) | The only supporting evidence is a six-task observational study ([arXiv 2607.02436](https://arxiv.org/pdf/2607.02436)). |
| Top models switch, ChatGPT: Astra · high | Astra leads Sol by a small margin on two of three measurements. No measurement of Astra per effort level exists. Unnamed Codex subagents copy the Coder, so they also run Astra · high when the switch is on. |
| Top models switch, Kimi: K3.1 Pro · high | It is the newest Kimi model and is available from Plus. Its 1M context needs Pro. |
| Gemini column | Antigravity has one top tier and no per-role effort. The tier text matches the current split of `pro` and `flash`. |
| Grok column and no Grok top models switch | APK writes only a model per role. A Grok 4.7 · xhigh switch is possible only after role or persona effort is verified. |

## Open questions for local verification

| # | Question | Why it matters | How to check |
|---|---|---|---|
| 1 | How does `CLAUDE_CODE_SUBAGENT_EFFORT` rank against frontmatter `effort`, the Agent tool parameter and `CLAUDE_CODE_EFFORT_LEVEL`? | The 0.4.0 setup writes this setting. | Test on Claude Code 2.1.316 or later. Read the documentation when Anthropic adds it. |
| 2 | Is Sonnet 5.5 · high or Opus 5.5 · medium a better Standard Claude Coder than Sonnet 5.5 · medium? | Only secondary data compares them. | Run an A/B comparison on representative repository tasks. Count solved tasks and plan usage. |
| 3 | Does Grok Build 1.0.70 accept `reasoning_effort` for `[subagents.roles.<name>]`? How does a persona bind to an `apk-*` agent? | Per-role Grok effort and a Grok 4.7 · xhigh switch depend on it. | Use an isolated Grok home directory with a role and a persona. Read the effort of the subagent in the logs. |
| 4 | Does `grok-build-0.1` appear in the Grok Build model picker for signed-in accounts on each plan? | Light and Standard use it for Grok. | Check the model list of signed-in clients on different plans. Record only whether the model is offered, not account details. |
| 5 | Which models do the Antigravity tiers `pro`, `flash` and `flash_lite` use on the Pro and Ultra plans? | `pro` may not mean Gemini 4 Argon on every plan. | Start one subagent per tier and read the resolved model name in the CLI log. |
| 6 | Does `flash_lite` use less Antigravity quota than `flash`? | It decides whether Flash Lite is useful in Light. | No official data exists. Compare usage statistics. |
| 7 | Is Terra available for Codex subagents on all paid plans and in the IDE extension? What do Free and Go plans get? | The Standard ChatGPT Docs writer uses Terra. | Compare the Codex model catalog on different plans. Start a subagent with `gpt-6.1-terra`. |
| 8 | What do the catalog field `multi_agent_reasoning_effort: "xhigh"` and the hidden `gpt-reserve` model mean? | The field may set subagent effort in Codex Ultra mode. | Wait for OpenAI documentation. Compare server catalogs over time. |
| 9 | Is the Opus 4.5 ID `claude-opus-4-5-20251101` (catalog) or `claude-opus-4-5-20251001` (deprecations page as read in this review)? | The catalog ID may be wrong. | Compare with [Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations). |
| 10 | What is the untitled Anthropic item dated 2026-11-01? | It may be a new model after this review. | Read [Anthropic news](https://www.anthropic.com/news) again. |
| 11 | What is the exact Fable limit on Ultra ("50% of weekly limits*")? | The review read it only through a summary tool. | Read [Claude pricing](https://claude.com/pricing) directly. |
| 12 | Will a stable Kimi Code release limit subagents to the configured model pool? Does per-spawn model selection also take an effort? | The APK model pool must then contain every role model. | Watch [Kimi Code releases](https://github.com/MoonshotAI/kimi-code/releases). |
