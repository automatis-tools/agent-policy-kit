# Claude auto-compact window

## Intent

Let a user choose when Claude Code compacts the main conversation, as one explicit setup option that APK owns, restores and reports like its other settings. The default stays the native behavior.

This option changes main-conversation behavior, which the contributor rule on ordinary direct work otherwise forbids. The owner approved this one exception on 2026-11-09, and `AGENTS.md` records it.

## Verified native surface (Claude Code documentation, 2026-11-09)

Source: <https://code.claude.com/docs/en/model-config>

- The top-level `autoCompactWindow` in a settings file sets the window for every model.
- `/autocompact` saves a window for the current model under `modelSettings`. That value wins over the top-level key in the same file. Before Claude Code 2.1.288, the command saved the top-level key.
- `--autocompact` overrides the saved setting for one launch.
- `CLAUDE_CODE_AUTO_COMPACT_WINDOW` wins over the command, the flag and the setting. Claude Code ignores a value that is not a token count, and treats other values outside 100000 to 1000000 as that minimum or maximum.
- `/autocompact` and the flag accept 100K to 1M tokens, as a count or with `k` or `M`.
- Claude Code caps every value at the model's context window. Models with a native 1M window compact at about 967K tokens by default.

## Decisions

- **Opt-in and explicit.** Off by default. No preset sets it. It needs `--claude`.
- **Top-level key, not the variable.** The variable would remove per-model control through `/autocompact`.
- **Input forms.** A plain integer or a `k` or `M` suffix, normalized to an integer. The native bare form `200`, meaning thousands, is out of range here, so it cannot be misread.
- **Ownership through one more value.** The operation `{kind:'value',path:['autoCompactWindow'],existed,before,after}` goes through the existing `undoJson`, so apply, replace, drift refusal and uninstall behave as for the `env` keys. A different integer already in the file is recorded and restored. Any other type stops with `UNSUPPORTED_CONFIG`.
- **Receipt format v5, only for opted-in setups.** Release 0.5.2 accepts only its fixed `env` operations, so it cannot own this key. The owner chose a new format over a v4 shape without a version signal and over a separate ownership file, which 0.5.2 would leave behind. Every setup without the option stays byte-compatible v4. A replacing setup without the option returns to v4.
- **Report, do not block.** The variable and per-model values are valid user choices. Setup warns with `claude-auto-compact-overridden`, and `show` reports them. A variable that Claude Code ignores is not an override.
- **Counts for per-model values.** `show` reports how many model entries have a window, not their names, so an unusual model key cannot make the read fail.

## Migration boundary

Release 0.5.2 and earlier refuse a v5 receipt with `INVALID_RECEIPT` and change nothing: `doctor` reports `attention` and `uninstall` exits with code 3. They also refuse a saved `policy.json` with the field. The owner accepted this for opted-in setups only.

## Non-goals

- No hooks, wrappers or runtime measurement. APK stays a one-shot configurator.
- No per-model option, no `/autocompact` edits and no change to subagent compaction.
- No preset, website control or claim of a saving. The website adds a control after a published APK version has this option.

## Verification

- Unit tests cover validation, the codec round trip, install, replacing setup, drift, uninstall, warnings, `show`, receipt validation and the v4 shape without the option.
- The packed-package gate runs without source access.
- Published 0.5.2 was run in temporary homes against setups from this code: it accepts and removes a setup without the option, and refuses a setup with the option without changing anything.
- Not covered: a real Claude Code session compacting at the configured window. Native configuration, client loading and actual model execution are different evidence.
