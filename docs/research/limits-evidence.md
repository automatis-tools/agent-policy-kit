# How the limit illustration was measured

This document explains the data behind the subagent limit illustration in the README and on the configuration page. It is for everyone who wants to know where the numbers come from and how far they apply. The data comes from the author's local Codex session logs. It records one developer's work on one plan. It is not a benchmark.

## Method

Codex logs the weekly limit as `rate_limits.primary.used_percent`, together with its reset time. Two limit resets that the vendor granted outside the weekly schedule each started a window at 0%. The illustration compares these two windows:

| | Without APK | With APK |
|---|---|---|
| Subagent setup | No role settings. About half of the subagent tokens ran on GPT-6 Astra, the top model. | Roles put most subagent work on GPT-6.1 Sol and GPT-6 Luna. |
| Subagents started | 67 | 131 |
| Active work until the limit reached 100% | 5.3 h | 25.0 h |
| Credits per 1M tokens after the limit | 35.3 | 3.0 |

Active work counts the 10-minute intervals that contain at least one model response. Idle time, for example nights, is not counted. The illustration shows these hours as 8-hour workdays.

## Limits of the comparison

- The tasks were different in the two windows.
- The main session effort was mostly xhigh in the first window. It was mostly high or lower in the second window.
- Both windows come from one account and the habits of one developer.

## Claude Code observation

The Claude Code logs showed the same pattern. When subagents inherited Opus, they produced 2.7 times as many output tokens as the main session. With roles on Sonnet and Haiku, they produced 0.16 times as many. The sample with roles covers one day.

For the model choices of each preset, see [presets](../reference/presets.md). For the evidence behind those choices, see the [2026-11-01 model review](2026-11-01-model-review.md).
