# AI assistants

This document describes how APK works with each AI assistant: how it detects the assistant, which files it writes, which native limits apply and which prerequisites setup checks. It also covers the desktop apps on macOS. It is for everyone who sets up APK and for agents that install it.

APK configures the coding agent of each assistant. In this document, "assistant" means that coding agent:

| Assistant | Coding agent | APK id | Executable | Native folder | Folder override variable |
|---|---|---|---|---|---|
| ChatGPT | Codex | `chatgpt` | `codex` | `~/.codex` | `CODEX_HOME` |
| Claude | Claude Code | `claude` | `claude` | `~/.claude` | `CLAUDE_CONFIG_DIR` |
| Kimi | Kimi Code | `kimi` | `kimi` | `~/.kimi-code` | `KIMI_CODE_HOME` |
| Gemini | Antigravity | `gemini` | `agy` | `~/.gemini` | none |
| Grok | Grok Build | `grok` | `grok` | `~/.grok` | `GROK_HOME` |

Gemini means Antigravity. APK detects the `agy` executable and writes Antigravity role settings. Gemini CLI also uses `~/.gemini`, but APK does not detect or configure it. Plain chats in the assistants do not change.

## Detection

`detect` and `setup` find each assistant by the identity of its executable. A folder alone is not proof that an assistant is installed. APK checks these locations in this order and uses the first executable that passes the identity check:

1. Each absolute directory in `PATH`. APK ignores empty and relative `PATH` entries.
2. The conventional location: `~/.kimi-code/bin/kimi` for Kimi, `~/.local/bin/claude` and `~/.claude/local/claude` for Claude, and `~/.local/bin/<executable>` for the others.
3. On macOS only, the copy of the CLI inside a desktop app. See [Desktop apps](#desktop-apps).

The identity check runs the executable with `--version` and matches the product name in the output. Kimi and Antigravity can print only a version number. For them, APK also runs `--help` and checks the product text. Each check has a time limit of 5 seconds.

The result of each assistant has a status and an origin:

- Status: `detected`, `not_found`, `invalid` (the file is not the expected executable) or `timeout`.
- Origin: `path`, `known_location` or `desktop_app`.

Only detected assistants that the preferences select receive files. For the command output, see [Commands](../guide/commands.md).

## Files written

APK writes only user-level files in the native folder. `<role>` is one of `worker`, `reviewer`, `explorer`, `tester`, `writer` and `routine`. APK writes a role file only for each selected role.

| Assistant | Role files | Configuration file | Instruction file |
|---|---|---|---|
| ChatGPT | `~/.codex/agents/apk-<role>.toml` | `~/.codex/config.toml` | `~/.codex/AGENTS.md` |
| Claude | `~/.claude/agents/apk-<role>.md` | `~/.claude/settings.json` | `~/.claude/CLAUDE.md` |
| Kimi | `~/.kimi-code/agents/apk-<role>.md` | `~/.kimi-code/config.toml` | `~/.kimi-code/AGENTS.md` |
| Gemini | `~/.gemini/config/agents/apk-<role>.md` | none | `~/.gemini/AGENTS.md` |
| Grok | `~/.grok/agents/apk-<role>.md` | `~/.grok/config.toml` | `~/.grok/AGENTS.md` |

- A role file must not exist before setup. If a file with that name exists and APK does not own it, setup stops with `OWNERSHIP_CONFLICT`.
- In the instruction file, APK adds one block between `<!-- BEGIN agent-policy-kit -->` and `<!-- END agent-policy-kit -->`. It keeps the rest of the file. If the file already has these markers and APK does not own them, setup stops with `OWNERSHIP_CONFLICT`.
- In the configuration file, APK sets only the settings in the next section. It keeps all other settings. TOML edits change only the text of the owned values. Claude's `settings.json` is written again as formatted JSON with two-space indentation.
- New files get the mode `0600`. Existing files keep their mode.

The content of role files and the instruction block is described in [Roles](roles.md). How APK records and removes its changes is described in [Ownership and state](ownership.md).

### Settings in the configuration file

| Assistant | Settings that APK owns |
|---|---|
| ChatGPT | `[agents]` `max_concurrent_threads_per_session`, `default_subagent_model` and, when the effort is pinned, `default_subagent_reasoning_effort` |
| Claude | In `env`: `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, `CLAUDE_CODE_SUBAGENT_MODEL` and, when the effort is pinned, `CLAUDE_CODE_SUBAGENT_EFFORT` |
| Kimi | `[secondary_model]` `default_model`, one `[secondary_model.models]` entry for each selected alias that names the roles that use it, and `[models.<alias>.overrides]` `default_effort` for each alias with a pinned effort |
| Gemini | none |
| Grok | `[subagents]` `max_concurrent`, one `[subagents.models]` entry `apk-<role>` for each selected role, and `[subagents.models]` `general-purpose` |

When a Kimi alias has a pinned effort, APK also removes `secondary_model.default_effort` and records its old value, so that the per-alias setting applies. Removal restores it.

The default model and effort settings apply to subagents that have no named role. See [Roles](roles.md#default-subagent-per-assistant).

## Native limits

APK writes settings through native features. It does not run during agent work and does not enforce a setting on each request. No hook, wrapper or proxy is installed to strengthen a missing native feature.

| Assistant | Parallel limit | Model per role | Effort per role | Precedence |
|---|---|---|---|---|
| ChatGPT | Native setting | Role file | Role file | Project settings, explicit spawn settings and higher-priority instructions follow Codex rules and can override user settings. |
| Claude | Native setting. It applies to ordinary Agent-tool spawns, with documented exceptions. | Role file | Role file | Session, project and managed settings, environment overrides and some spawn paths can override user settings. |
| Kimi | Guidance only. No native cap is set. | Guidance only. The parent selects the pool alias when it spawns. | Per alias, not per role | Native Kimi rules |
| Gemini | Guidance only. There is no universal native cap. | Native tier per role | None | Native Antigravity rules |
| Grok | Native setting | `config.toml` per role | None. Subagents use the main session effort. | Project settings, explicit spawn settings and higher-priority instructions follow Grok Build rules. |

Each assistant adds warning codes to the setup result. The codes tell the person or agent which limits apply:

| Assistant | Warning codes |
|---|---|
| ChatGPT | `chatgpt-native-precedence-limits` |
| Claude | `claude-native-precedence-limits` |
| Kimi | `kimi-concurrency-guidance-only`, `kimi-model-pool-routing-guidance` |
| Gemini | `gemini-concurrency-guidance-only`, `gemini-per-role-effort-unsupported` |
| Grok | `grok-per-role-effort-unsupported`, `grok-native-precedence-limits` |

Other limits apply to all assistants:

- A configured setting is not proof of the provider model that runs, of account access or of task quality.
- Provider aliases and tiers can resolve to other models over time.
- An avoid list is routing guidance, not a block.
- A native client can need a new session to load the changes.

## Prerequisites and refusals

A prerequisite stops setup for one assistant before any write. Other assistants continue. The result names the prerequisite code.

These rules apply to all assistants except Gemini:

- If the folder override variable (for example `CODEX_HOME`) points to a folder other than the standard one, setup returns `native-home-override-unsupported` and writes nothing for that assistant. An explicit `--home` selects the standard layout under that folder instead. See [Commands](../guide/commands.md).

### ChatGPT (Codex)

- If `[agents]` has the older `max_threads` setting, setup stops with `CHATGPT_CAP_ALIAS_CONFLICT`. Decide which setting to keep, then run setup again.
- An existing `max_concurrent_threads_per_session` that is not a positive whole number stops setup with `UNSUPPORTED_CONFIG`.

### Claude (Claude Code)

- If `env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE` is `1`, setup returns `claude-force-model-conflict`. That setting forces one model for all subagents, so the role models cannot apply. Change the native setting first.
- Claude Code 2.1.316 or later reads `CLAUDE_CODE_SUBAGENT_EFFORT`. Earlier versions ignore it.

#### Claude model aliases on other providers

APK writes a Claude alias such as `sonnet` or `haiku` as it is. Claude Code resolves the alias for each provider. The presets use versioned IDs, not aliases. A role that you set to an alias in Custom can resolve to an older model outside the Anthropic API. On 2026-11-02, the Claude Code documentation gave these resolutions:

| Provider | `sonnet` | `haiku` |
|---|---|---|
| Anthropic API | Sonnet 5.5 | Haiku 5.5 |
| Claude Platform on AWS | Sonnet 4.6 | Haiku 4.5 |
| Amazon Bedrock, Google Cloud's Agent Platform | Sonnet 4.5 | Haiku 4.5 |
| Microsoft Foundry | Sonnet 4.5 | Haiku 4.5 |

- On Microsoft Foundry, the `default` model setting is also Sonnet 4.5.
- Sonnet 4.5 is deprecated. On Bedrock and Agent Platform it stays available until the partner's own date: Bedrock lists it as Legacy with end of life on 2027-04-08, and Google announces no date. See [Model catalog](model-catalog.md#lifecycle).
- Haiku 4.5 is active (legacy) and has no deprecation notice.
- **Foundry risk after 2026-11-30:** Foundry follows the Claude API lifecycle, so Sonnet 4.5 retires there on 2026-11-30. Unless Claude Code changes its Foundry defaults, `sonnet` and `default` then name a retired model. Bedrock and Agent Platform show a notice and fall back to an earlier version of an unavailable alias default. Foundry has no such startup check, so Foundry users see errors instead.
- On Foundry, pin a newer Sonnet before 2026-11-30: set `ANTHROPIC_DEFAULT_SONNET_MODEL` to a Sonnet 5.x or Sonnet 4.6 deployment, or choose a full model ID for each role and for the main model.
- Claude Code warns when a requested model has a scheduled retirement date. The check also covers a `model` in subagent frontmatter, so it covers APK role files.

### Kimi (Kimi Code)

Kimi needs provisioned model entries. APK never creates aliases, providers or credentials.

- Each selected alias must exist in `config.toml` with a provider, an upstream model and a context size, and its provider must exist. If not, setup returns `kimi-provisioned-models-required`.
- If a preferred catalog alias is missing, setup looks for exactly one existing alias with the same upstream model and uses it. The result then has the warning `kimi-catalog-alias-resolved`. If more than one alias matches, setup returns `kimi-catalog-alias-ambiguous`.
- If a resolved alias is in the avoid list, setup returns `kimi-resolved-model-avoided`.
- The alias `primary` is reserved and cannot be a pool entry.
- If thinking is off (`thinking.enabled = false`) and a selected alias needs thinking, setup returns `kimi-thinking-disabled`. Both K3.1 Pro variants need thinking. APK does not change the thinking setting.

Kimi sets effort for each alias, not for each role. The effort rules and their refusal codes are in [Roles](roles.md#kimi-alias-effort).

### Gemini (Antigravity)

- APK writes only role files and the instruction block. It accepts only the tiers `pro`, `flash`, `flash_lite` and `inherit`. See [Model catalog](model-catalog.md#gemini-antigravity).

### Grok (Grok Build)

- Existing `[subagents]` or `[subagents.models]` values that are not tables, or a `max_concurrent` that is not a positive whole number, stop setup with `UNSUPPORTED_CONFIG`.
- Grok Build reads `~/.claude/CLAUDE.md` by default. If Claude is also configured, Grok Build can therefore also read the Claude instruction block. APK does not change that behavior.

## Desktop apps

Some desktop apps include their own copy of a CLI and do not put it on `PATH`. On macOS, detection also checks these copies, after `PATH` and the conventional locations:

| App | Checked location | Settings it reads |
|---|---|---|
| ChatGPT Desktop (Codex) | `/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex`, and the same path under `~/Applications` | `~/.codex`, the same as the Codex CLI |
| Claude Desktop (Code tab) | `~/Library/Application Support/Claude/claude-code/<version>/<build>/claude.app/Contents/MacOS/claude` | `~/.claude`, the same as the Claude Code CLI |

- For Claude Desktop, detection checks the newest version first. In one version, it checks the most recently written build first. It checks at most 8 copies.
- An assistant found this way has the origin `desktop_app`. The app must be installed, and the copy of the CLI must pass the identity check.
- The settings apply to new desktop sessions.

These desktop features are not configured:

- Claude Cowork reads instructions and plugins from your Claude account, not from `~/.claude`.
- ChatGPT conversations outside Codex have no subagent settings.

## Platforms

- macOS is the local acceptance host.
- Hosted CI runs the test suites on macOS and Ubuntu. See [Verification](../maintainers/verification.md).
- APK does not write files on Windows. A plan can run, but an apply that has changes stops with `PLATFORM_UNSUPPORTED`.

## Sources

- [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents), [Claude Code model configuration](https://code.claude.com/docs/en/model-config) and [Claude in Microsoft Foundry](https://platform.claude.com/docs/en/build-with-claude/claude-in-microsoft-foundry)
- [Kimi configuration files](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/configuration/config-files.md) and [Kimi agent definitions](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/customization/agents.md)
- [Antigravity subagents](https://antigravity.google/docs/subagents?tab=cli)
- [Grok Build subagents](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/16-subagents.md), observed with Grok Build 1.0.70 and an isolated `GROK_HOME`
