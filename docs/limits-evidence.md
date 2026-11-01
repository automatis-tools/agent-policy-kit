# How the limit illustration was measured

The README illustration comes from the author's local Codex session logs (`~/.codex/sessions`). It records one developer's work on one plan. It is not a benchmark.

## Method

Codex logs the weekly limit as `rate_limits.primary.used_percent` together with its reset time. Free limit resets started two separate windows, each from 0%. The illustration compares them:

| | Without APK | With APK |
|---|---|---|
| Subagent setup | No role settings; about half of subagent tokens ran on GPT-6 Astra, the top model | Roles put most subagent work on GPT-6.1 Sol and GPT-6 Luna |
| Subagents started | 67 | 131 |
| Active work until the limit reached 100% | 5.3 h | 25.0 h |
| Credits per 1M tokens after the limit | 35.3 | 3.0 |

Active work counts 10-minute intervals that contain at least one model response. Idle time, such as nights, is excluded. The illustration places these hours on 8-hour workdays.

## Limits of the comparison

- The tasks differed between the two windows.
- Main-session effort was mostly xhigh in the first window and mostly high or lower in the second.
- Both windows come from one account and one developer's habits.

Claude Code logs showed the same pattern. When subagents inherited Opus, they produced 2.7 times as many output tokens as the main session. With roles on Sonnet and Haiku, they produced 0.16 times as many. That "after" sample covers one day.
