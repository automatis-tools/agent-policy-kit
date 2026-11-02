# Presets

This document lists the three presets of release 0.4.0: Light, Standard and Top-tier. It gives the model and effort that each preset selects for each role and AI assistant, the top models switch, the parallel limits and the design principles. It is for everyone who chooses a preset or wants to know why a preset has its values.

A preset is a named set of preferences that the release supplies. The data is in `policies/fast.json` (Light), `policies/balanced.json` (Standard) and `policies/quality.json` (Top-tier). The CLI uses the ids `fast`, `balanced` and `quality`. The page and this document use the labels. For the roles, see [Roles](roles.md). For model IDs, efforts and access requirements, see [Model catalog](model-catalog.md). The detailed evidence is in the [model review of 2026-11-01](../research/2026-11-01-model-review.md).

## Summary

| Preset | CLI id | Description | Parallel limit per assistant |
|---|---|---|---|
| Light | `fast` | Light models for every role. Limits last longest. | 2 |
| Standard | `balanced` | Stronger models for code, review, tests and docs. Fits most plans. | 3 |
| Top-tier | `quality` | High-end models for most roles. Uses limits fastest. | 2 |

Standard is the default preset. `setup --release` without `--preset` applies it. For the commands, see [Commands](../guide/commands.md).

## Design principles

The presets were reviewed on 2026-11-01. They are starting recommendations, not a quality ranking.

- Subagent usage counts against the same plan limits as the main session. Each parallel session adds to that usage. The presets therefore differ in how much of the plan the subagents can use.
- No comparative task benchmark was run for the presets. Configuration tests check settings, not model quality.
- Vendors' effort labels and subscription usage are not directly comparable. One role can therefore get different effort levels in different assistants.
- Presets pin at most `high`. The only exception is the Claude top choice at `xhigh`. Higher effort gives quickly diminishing returns. Higher levels stay available in Custom.
- No preset bans a model. A model that a preset does not select stays available in Custom. Personal avoid lists stay available in preferences and CLI input.
- Each table cell is `model · effort`. A cell without an effort means that the preset writes no effort, so the native default applies. Gemini cells have no effort because Antigravity has no per-role effort setting. Grok cells keep the native default of each model. See [Roles](roles.md#how-effort-applies).

### Light

| Role | ChatGPT | Claude | Kimi | Gemini | Grok |
|---|---|---|---|---|---|
| Coder | Luna · high | Haiku 5.5 · medium | K2.8 Preview · low | Flash | Grok Build 0.1 |
| Reviewer | Luna · high | Haiku 5.5 · high | K2.8 Preview · low | Flash | Grok Build 0.1 |
| Code explorer | Luna · low | Haiku 5.5 · low | K2.8 Preview · low | Flash Lite | Grok Build 0.1 |
| Test writer | Luna · high | Haiku 5.5 · high | K2.8 Preview · low | Flash | Grok Build 0.1 |
| Docs writer | Luna · low | Haiku 5.5 · low | K2.8 Preview · low | Flash Lite | Grok Build 0.1 |
| Task runner | Luna · low | Haiku 5.5 · low | K2.8 Preview · low | Flash Lite | Grok Build 0.1 |

Light uses light models for every role, so plan limits last longest. It suits entry plans and many parallel sessions.

- ChatGPT runs GPT-6 Luna at high for code, review and tests. OpenAI suggests high as the starting level for Luna. Luna is the cheapest Codex model at any level.
- Claude gives reviews and test creation more reasoning than the Coder. Checking edge cases is different from executing known steps.
- Kimi roles share one alias, and an alias has one effort. Light keeps that effort at low to save quota.
- Gemini uses Flash for code, review and tests, and Flash Lite for lighter work.
- Grok uses Grok Build 0.1, the fast coding model, for every role.

### Standard

| Role | ChatGPT | Claude | Kimi | Gemini | Grok |
|---|---|---|---|---|---|
| Coder | Sol · medium | Sonnet 5.5 · high | K3 256K · high | Pro | Grok 4.7 |
| Reviewer | Sol · high | Sonnet 5.5 · high | K3 256K · high | Pro | Grok 4.7 |
| Code explorer | Luna · high | Haiku 5.5 · medium | K2.8 Preview · low | Flash | Grok Build 0.1 |
| Test writer | Sol · high | Sonnet 5.5 · high | K3 256K · high | Pro | Grok 4.7 |
| Docs writer | Terra · medium | Sonnet 5.5 · medium | K3 256K · high | Flash | Grok 4.7 |
| Task runner | Luna · low | Haiku 5.5 · low | K2.8 Preview · low | Flash Lite | Grok Build 0.1 |

Standard uses stronger models for implementation, review, test creation and documentation. It uses light models for fact gathering and mechanical work.

- ChatGPT runs GPT-6.1 Sol for code, review and tests. Luna runs at high for exploration. GPT-6.1 Terra runs at medium for docs: OpenAI positions Terra for clear writing, at half of Sol's usage.
- Claude runs Sonnet 5.5 at high for code, review and tests. Anthropic's own per-effort results put Sonnet 5.5 at medium far behind high on agentic coding: 28.8% against 43.0% on Terminal-Bench 4.0. Opus 5.5 at medium scores higher than Sonnet 5.5 at high, but it costs 1.5 to 2.3 times more per task and more per solved task on every measurement. That is a Top-tier trade, not a balance. See [the decision of 2026-11-02](../research/2026-11-01-model-review.md#what-this-means-for-the-standard-claude-coder).
- The Claude Coder effort is also the effort of Claude subagents that have no named role (capped at high). In Standard these subagents therefore also run at high, and they use more of the plan than at medium. See [Roles](roles.md#default-subagent-per-assistant).
- Claude's Haiku 5.5 explorer uses medium, its native default.
- Kimi uses K3 256K for code, review, tests and docs. Its quota footprint is smaller than that of the full-context K3. Larger-context choices stay editable.
- Gemini uses Flash for exploration and docs.
- Grok adds Grok 4.7 for code, review, tests and docs.
- No Standard role uses GPT-6 Astra, Fable or K3.1 Pro.

### Top-tier

| Role | ChatGPT | Claude | Kimi | Gemini | Grok |
|---|---|---|---|---|---|
| Coder | Sol · high | Opus 5.5 · high | K3 · high | Pro | Grok 4.7 |
| Reviewer | Sol · high | Opus 5.5 · high | K3 · high | Pro | Grok 4.7 |
| Code explorer | Sol · medium | Opus 5.5 · medium | K3 · high | Pro | Grok 4.7 |
| Test writer | Sol · high | Opus 5.5 · high | K3 · high | Pro | Grok 4.7 |
| Docs writer | Sol · medium | Opus 5.5 · medium | K3 · high | Pro | Grok 4.7 |
| Task runner | Sol · medium | Sonnet 5.5 · medium | K2.8 Preview · high | Flash | Grok Build 0.1 |

Top-tier uses GPT-6.1 Sol, Opus 5.5 and K3 at high effort for implementation, review and tests. It uses limits fastest. It suits top plans with few parallel sessions.

- Exploration and documentation use the same high-end model. In ChatGPT and Claude they run at medium. Read-only discovery and writing do not need the edge-case checking that high is for.
- In Claude, Kimi, Gemini and Grok, only the Task runner uses a lighter model. ChatGPT uses Sol for every role. Its Task runner runs at medium, the same as exploration and documentation.
- Kimi keeps one effort per shared alias. K2.8 Preview has no medium level, so the Kimi Task runner uses high.
- Gemini has one top tier, Pro. Gemini's Standard and Top-tier differ only in exploration, docs and the Task runner.
- Grok also uses Grok 4.7 for exploration. The Grok Task runner keeps Grok Build 0.1.

## Top models switch

The top models switch is an option of Top-tier on the [configurator](../guide/configurator.md). It is not a separate preset. Each assistant has its own switch. The switch is off by default, because the top choices use limits much faster. Share links keep the switch state.

When the switch is on, the Coder, Reviewer and Test writer use the top choice of the assistant:

| Assistant | Top choice |
|---|---|
| ChatGPT | GPT-6 Astra · high |
| Claude | Opus 5.5 · xhigh |
| Kimi | K3.1 Pro · high |

Gemini and Grok have no top choice.

For Claude, the switch raises the Opus 5.5 effort instead of selecting Fable 5.1. Anthropic's own benchmarks put Opus 5.5 ahead of Fable 5.1 on every published coding benchmark, at 2.5 times lower price. Anthropic also suggests a higher Opus effort before Fable. Fable 5.1 stays available in Custom.

The default subagent setting of Claude caps the effort at high. The `xhigh` top choice therefore does not raise subagents that have no named role. See [Roles](roles.md#default-subagent-per-assistant).

## Parallel limits

The parallel limit is the maximum number of subagents that run at the same time in one session. The defaults are Light 2, Standard 3 and Top-tier 2 for each assistant.

- Light keeps short work bounded.
- Standard lets three independent responsibilities overlap.
- Top-tier limits long work on heavier models that runs at the same time.

These values are product defaults, not benchmark results. A limit does not start tasks and does not measure quality. Each assistant can override its limit on the page or with `--TOOL-max-concurrent`. Some assistants enforce the limit natively. For others it is guidance only. See [AI assistants](assistants.md#native-limits).

## Reasons by vendor

These are short reasons. The sources and the detailed comparisons are in the [model review of 2026-11-01](../research/2026-11-01-model-review.md).

- **OpenAI (ChatGPT):** OpenAI positions Astra for demanding work, Sol for a balance of capability and usage, Terra for fast, clear writing and Luna for focused, efficient work. In Codex credits per token, Astra costs 5 times Sol, Terra costs half of Sol and Luna costs a tenth of Terra. OpenAI's subagent guide suggests Sol for demanding agents, Luna for lighter subagent work, high for Luna, and names reviewer or security-focused agents as examples for high. The reviewer example of the same guide uses Sol at medium.
- **Anthropic (Claude):** Anthropic suggests Sonnet for most coding, Opus for complex architectural work and Haiku for simple subagent tasks. Anthropic suggests Fable only when Opus 5.5 at a higher effort still falls short. Anthropic describes high as the level for work where verification matters, such as fixing a bug in an existing codebase, and xhigh as deeper reasoning at higher token spend. For Sonnet 5.5 in agentic coding, Anthropic suggests medium for well-specified tasks and high for harder or longer ones. The Standard Coder uses high because Anthropic's per-effort benchmark data puts Sonnet 5.5 at medium 8.6 to 14.2 points below high on Terminal-Bench 4.0, FrontierCode and CursorBench. Anthropic reports that Sonnet 5.5 scored lower at max than at xhigh, because it started review subagents more often.
- **Moonshot (Kimi):** Kimi describes K2.8 Preview as efficient thinking and K3 256K as a smaller quota footprint than K3. Moonshot recommends K3 256K for routine feature work and K3 for large-codebase analysis and multi-file refactoring. K3.1 Pro Highspeed has the same capabilities as K3.1 Pro at a quota premium, so no preset uses it.
- **Google (Gemini):** The presets use only the native role tiers of Antigravity. The tiers do not fix the underlying model, and there is no per-role effort.
- **xAI (Grok):** Grok Build 0.1 is xAI's fast coding model and serves light work. Grok 4.7 is the flagship and serves code, review, tests and docs. Grok 4.6 and 4.5 stay available in Custom. Release 0.5.0 added a per-role effort for Grok and reviewed the Grok presets again. Every Grok preset keeps the native default effort: `high` for Grok 4.7, and no effort setting for Grok Build 0.1. A pinned `high` would give the same level, and presets pin at most `high`. No task comparison supports another level, so Grok has no top choice in this release. The other Grok 4.7 levels stay available in Custom.

Account access to each model varies by plan. A preset does not grant access. For plan requirements, see [Model catalog](model-catalog.md#access-requirements).

## What a preset does not freeze

A preset fixes the model IDs and effort levels that it writes. It does not fix what a provider alias or tier resolves to, and it does not keep a retired model available. For release selection and updates, see [Updates and removal](../guide/updates-and-removal.md). For the review procedure for the next release, see [Model review procedure](../maintainers/model-review.md).
