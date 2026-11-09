# Claude Coder cache lifetime

## Intent

A Claude Code subagent uses a five-minute prompt cache by default. A subagent that pauses for longer writes its whole context to the cache again on the next request. Long pauses come from waiting for a reply from the main conversation, from polling and from long commands. APK should let a user request a one-hour cache for the role that pauses like this, without changing anything for other users.

## Verified native surface (Claude Code documentation, 2026-11-08)

- A subagent file accepts `experimental.cacheTtl` with `5m` or `1h`. It needs Claude Code 2.1.248 or later. Claude Code ignores other values and ignores `1h` while a subscription uses usage credits.
- The order is `FORCE_PROMPT_CACHING_5M=1`, `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL`, `subagentPromptCacheTtl`, the role frontmatter, `ENABLE_PROMPT_CACHING_1H=1`, and the native default.
- `subagentPromptCacheTtl` and its variable also cover workflows, forks, compaction and session titles.
- A one-hour write costs 2× the base input price. A five-minute write costs 1.25×.

## Decisions

- **Opt-in, off by default.** Long pauses are specific to a working style. A short subagent that never pauses pays more for a one-hour write. No preset sets the option.
- **Coder only.** Read-only and short roles rarely pause for more than five minutes, so the higher write price is not returned. The policy rejects the field on other roles, on `code` and on `light`.
- **One value, `1h`.** Absence means the native lifetime. The explicit option names its role (`worker=1h`) so that its shape stays valid if another role is added later.
- **Role frontmatter, not `settings.json`.** Role files are already owned whole by hash, so install, update, drift and uninstall work without a new owned value. Receipt format v4 and older APK versions keep working. A user's own global setting still wins, and the setting is not changed.
- **Report, do not block.** A higher-priority control leaves the role field without effect, but is a valid user choice. Setup warns and `show` reports the value that wins.

## Non-goals

- No hooks, wrappers or runtime measurement. APK stays a one-shot configurator.
- No change to the main conversation cache, to `general-purpose` subagents or to other assistants.
- No claim of a saving. Native configuration, client loading and actual provider behavior are different evidence.

## Verification

- Unit tests cover validation, the role file, the explicit codec, install, replacing setup, drift, uninstall, warnings and `show`.
- `doctor` and `uninstall` of 0.5.2 accept an installation with the field.
- Live acceptance needs a real Claude Code session: transcripts of `apk-worker` show `ephemeral_1h_input_tokens` and other roles keep `ephemeral_5m_input_tokens`.

## Website

The configurator belongs to the getacc.dev repository. It adds the control after an APK version with this option is published and pinned.
