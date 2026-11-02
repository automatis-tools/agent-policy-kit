# Commands

This document is the full reference for the `agent-policy` command line: every command, input mode and option, the output formats and the exit codes. It is for people and AI agents that run APK in a terminal. For a first setup, see [Getting started](getting-started.md).

## Run the CLI

APK needs Node.js 22.13 or later in the 22 line, or Node.js 24 or later.

Run a pinned release with `npx`:

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.5.2 agent-policy <command> [options]
```

- `--package agent-policy-kit@0.5.2` selects the configuration release. The package version is the release version.
- `--ignore-scripts` prevents npm install scripts.
- `--yes` lets npx download the package without a prompt.

The examples below write only `agent-policy <command>`. Put the `npx` prefix in front of them, or use an installed `agent-policy` executable.

APK is a one-shot configurator. Each command runs once and exits. The native files that it writes do not depend on the package.

## Commands

| Command | Purpose | Writes files |
|---|---|---|
| [`setup`](#setup-and-install) | Plan the native configuration for detected assistants. With `--apply`, write it. | Only with `--apply` |
| [`install`](#setup-and-install) | The same as `setup`. | Only with `--apply` |
| [`show`](#show) | Read the current user-level subagent settings of each assistant. | No |
| [`doctor`](#doctor) | Verify the configuration that APK owns. | No |
| [`detect`](#detect) | Find installed assistants from their executables. | No |
| [`release`](#release) | Show the configuration release of this package and its release notes. | No |
| [`uninstall`](#uninstall) | Plan the removal of the configuration that APK owns. With `--apply`, remove it. | Only with `--apply` |
| [`init`](#init) | Create an editable preferences file. | Yes, a new file only |
| [`instructions`](#instructions) | Print the AI operator guide. | No |
| `help` | Print the usage summary. | No |

Each command accepts exactly one command name and no other positional argument. Two more options work without a command:

- `--help` prints the usage summary. No command or `help` does the same.
- `--version` prints the package version.

## Common options

| Option | Value | Used by | Meaning |
|---|---|---|---|
| `--client` | `chatgpt`, `claude`, `kimi`, `gemini` or `grok` | `setup`, `install`, `show`, `doctor`, `detect`, `uninstall` | Limit the command to one assistant. |
| `--home` | A path | `setup`, `install`, `show`, `doctor`, `uninstall` | Use the standard assistant folders under this folder instead of your home folder. |
| `--state-dir` | An absolute path | `setup`, `install`, `show`, `doctor`, `uninstall` | Use this APK state directory. |
| `--apply` | none | `setup`, `install`, `uninstall` | Write the planned changes. Without it, the command is a preview. |
| `--json` | none | all commands except `instructions` and `help` | Print JSON. See [Output](#output). |

Assistant IDs map to coding agents: `chatgpt` is Codex, `claude` is Claude Code, `kimi` is Kimi Code, `gemini` is Antigravity and `grok` is Grok Build. Version 0.2.0 and earlier used `codex` and `agy`. These IDs are not accepted.

### Home folder and state directory

The *state directory* is the private APK folder with receipts, saved preferences and transaction backups. The [ownership reference](../reference/ownership.md#state-directory) gives its default location, the order in which APK selects it, and its content. A path that is not absolute fails with `STATE_PATH_MUST_BE_ABSOLUTE`.

If you use `--home` or `--state-dir` for setup, use the same values for `doctor`, `show` and `uninstall` later.

Automatic setup uses the standard native folders, for example `~/.codex` and `~/.claude`. If `CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `KIMI_CODE_HOME` or `GROK_HOME` points to a different folder, setup writes nothing for that assistant. It reports the prerequisite `native-home-override-unsupported`. With `--home`, APK skips this check and uses the standard layout under `--home`.

## setup and install

`setup` plans the native configuration for each detected and selected assistant. `install` is the same command. Without `--apply`, the command writes nothing. With `--apply`, it writes the plan.

```sh
agent-policy setup [input] [--client ID] [--home PATH] [--state-dir PATH] [--apply] [--json]
```

APK configures only assistants that are installed and selected in the preferences. It finds them as `detect` does. An assistant that is not installed is skipped. Each assistant has its own transaction: one assistant can succeed while another stops.

A repeated setup with the same values changes no file. The preview reports `planned` with no files, and the readable output shows `Already up to date`. With `--apply`, the result is `unchanged`. After a change, open a new session in the assistant to load it.

### Input modes

The input sets the preferences. Use one input mode at a time. A second mode fails with `CONFLICTING_OPTIONS`.

| Mode | Options | Preferences | Recorded source | Replaces an earlier APK setup |
|---|---|---|---|---|
| Default | none | The saved `policy.json` in the state directory, or the Standard preset if there is none | `saved` or `release` | No |
| [Explicit tool arguments](#explicit-tool-arguments) | `--roles`, `--max-concurrent` and one or more tool options | The values in the command | `custom` | Yes |
| [Release presets](#release-presets---release-and---preset) | `--release`, `--preset NAME`, or both | A preset of this release | `release`, with the preset name | Yes |
| [Encoded preferences](#encoded-preferences---config) | `--config BASE64URL` | The decoded JSON | `custom` | Yes |
| [Preferences file](#preferences-file---policy) | `--policy FILE` | The file | `custom` | No |

*Replaces an earlier APK setup* means that APK can change an existing APK configuration to the new values in one step. Modes that do not replace stop with `INSTALLATION_CONFLICT` or `POLICY_CONFLICT` if the request differs from the saved setup. The [ownership reference](../reference/ownership.md) explains receipts and replacement.

### Explicit tool arguments

The configurator generates this mode. You can also write it yourself.

```sh
agent-policy setup \
  --roles 'reviewer,explorer' \
  --max-concurrent 3 \
  --chatgpt 'reviewer=gpt-6.1-sol:high,explorer=gpt-6-luna:high' \
  --avoid-chatgpt 'gpt-6-astra' \
  --claude 'reviewer=claude-sonnet-5-5:high,explorer=claude-haiku-5-5:native' \
  --claude-max-concurrent 2 \
  --gemini 'reviewer=pro,explorer=flash' \
  --grok 'reviewer=grok-4.7:xhigh,explorer=grok-4.7'
```

| Option | Value | Rules |
|---|---|---|
| `--roles` | Comma-separated role IDs: `worker`, `reviewer`, `explorer`, `tester`, `writer`, `routine` | Required. No duplicates. |
| `--max-concurrent` | A whole number from 1 to 32 | Required. The shared parallel limit. |
| `--chatgpt`, `--claude`, `--kimi` | `ROLE=MODEL:EFFORT,...` | One entry for each role in `--roles`, exactly once. |
| `--gemini` | `ROLE=TIER,...` | `TIER` is `pro`, `flash`, `flash_lite` or `inherit`. No effort. |
| `--grok` | `ROLE=MODEL,...`, `ROLE=MODEL:EFFORT,...` or a mix | `ROLE=MODEL` sets no effort, the same as `:native`. APK reads a trailing `:` and an effort word or `native` as the effort. For a model ID that itself ends like that, add `:native`. |
| `--TOOL-max-concurrent` | A whole number from 1 to 32 | Optional. Replaces `--max-concurrent` for one assistant. Needs the `--TOOL` option. |
| `--avoid-TOOL` | Comma-separated model IDs | Optional. At most 32 models. Routing guidance only. Needs the `--TOOL` option. |

`TOOL` is `chatgpt`, `claude`, `kimi`, `gemini` or `grok`. At least one tool option is necessary. Each tool option selects that assistant. Assistants without a tool option are not configured.

Rules for the values:

- `EFFORT` is `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max` or `native`. `native` sets no explicit effort, so the assistant uses its native default.
- APK splits `MODEL:EFFORT` at the last colon. A model ID can contain colons.
- A model ID must follow the rule in [Preferences](preferences.md#choices).
- The effort must be a level that the assistant supports. For a model in the catalog, it must be a level of that model. The [model catalog reference](../reference/model-catalog.md) lists the levels.
- A model in `--avoid-TOOL` cannot also be selected for a role.
- For Kimi, effort applies to a model alias, not to a role. [Roles](../reference/roles.md#how-effort-applies) gives the rules. The alias `primary` is not accepted.
- Each explicit option can appear only once. A duplicate fails with `DUPLICATE_OPTION`.
- This mode works only with `setup` and `install`. It cannot be used with `--client`.

Keep the shell quotes. A value that is not valid fails with `INVALID_EXPLICIT_CONFIG` before APK reads any assistant file.

### Release presets (`--release` and `--preset`)

This mode applies a named preset of the package release that you run.

```sh
agent-policy setup --release
agent-policy setup --release --preset quality --apply
```

| Option | Value | Meaning |
|---|---|---|
| `--release` | none | Use a preset of this release. Without `--preset`, the preset is `balanced`. |
| `--preset` | `fast`, `balanced` or `quality` | Select the preset: Light, Standard or Top-tier. `--preset` alone also selects this mode. |

`--release` takes no version. The package version in the `npx` command selects the release. This mode is the supported way to upgrade or downgrade to the defaults of one release. See [Updates and removal](updates-and-removal.md). Some release changes cross a migration boundary and need a removal first, for example Claude from 0.4.0 to 0.3.0. See [Migration boundaries](updates-and-removal.md#migration-boundaries). An unknown preset fails with `UNKNOWN_PRESET`. The [presets reference](../reference/presets.md) lists the values.

### Encoded preferences (`--config`)

This mode applies a preferences JSON that is encoded as base64url.

```sh
agent-policy setup --config eyJzY2hlbWFWZXJzaW9uIjoxLC...
```

- The value is canonical base64url without padding.
- The decoded JSON is at most 64 KiB.
- The JSON must be valid [preferences](preferences.md). It contains data only.

APK writes the decoded JSON to a private temporary file and removes that file when the command ends. A value that is not valid fails with `INVALID_CONFIG`. To make a value from a file, see [Preferences](preferences.md#apply-a-preferences-file).

### Preferences file (`--policy`)

This mode reads preferences from a file.

```sh
agent-policy setup --policy ./preferences.json
```

- The file must be a regular file, not a symbolic link, and at most 64 KiB.
- The JSON must be valid [preferences](preferences.md). Otherwise the command fails with `INVALID_POLICY`.

This mode is conservative. If APK already has a setup with other values, setup stops with `INSTALLATION_CONFLICT` or `POLICY_CONFLICT`. To replace a saved setup with the values of a file, use `--config`.

### Setup results

Each assistant gets one result status:

| Status | Meaning |
|---|---|
| `planned` | Preview: APK would make the listed changes. A plan with no files means that the configuration is already current. |
| `configured` | APK wrote the changes. |
| `unchanged` | Only with `--apply`: the configuration was already current, and APK wrote nothing. |
| `not_selected` | The preferences do not include this assistant. |
| `not_found` | The assistant is not installed. |
| `invalid` | An executable was found, but its identity could not be verified. |
| `timeout` | Detection did not finish in time. |
| `prerequisite` | A condition outside APK must be fixed first. APK writes nothing for this assistant. |
| `error` | The operation failed for this assistant. |

The overall status is `planned`, `configured`, `partial` or `no_clients`. `no_clients` means that no selected assistant is installed. `partial` means that at least one assistant has `prerequisite`, `error`, `invalid` or `timeout`.

A plan lists files as `~/...` or `<state-dir>/...` with the action `create`, `update` or `remove`. Release fields show the target, previous and applied release, source and preset for each assistant.

If an assistant stops, it keeps its earlier APK configuration. The readable output then shows `Existing configuration retained`.

## show

`show` reads the current user-level subagent settings of each assistant. It also reads settings that you made yourself.

```sh
agent-policy show [--client ID] [--home PATH] [--state-dir PATH] [--json]
```

- It needs no APK receipts and no assistant executables.
- It reads the native folders that the native-home environment variables select. With `--home`, it reads the standard folders under that folder.
- It shows the default subagent model and effort, the parallel limit, each role with its model and effort, and the Kimi model pool.
- For Kimi and Gemini, the parallel limit is guidance from the APK instructions. Kimi role models are routing guidance.
- For Claude, it also shows environment overrides of the subagent model, effort and parallel limit.
- It shows APK files that have local edits with their current values, and marks them.

`show` does not read project settings, managed settings, plugins, session flags or external role files. These can override the values that it shows. It never prints prompts, credentials, raw configuration or private paths. It writes nothing and calls no model.

If `show` cannot read an assistant completely, that assistant has the status `attention` and the command exits with code 3. The readable output shows `incomplete read`. Causes include unsupported role syntax, unsafe files, files that change during the read and APK files with local edits.

`show` does not accept `--apply`, `--policy`, `--preset`, `--release`, `--config` or explicit tool arguments.

## doctor

`doctor` verifies the configuration that APK owns, for each assistant.

```sh
agent-policy doctor [--client ID] [--home PATH] [--state-dir PATH] [--json]
```

For each assistant, it reports:

- The detection result.
- The configuration status: `verified` with the applied release, source and preset, `not_configured`, or `attention` with a reason code.
- What the native settings control: native role settings, native tiers (Gemini) or a native pool with routing guidance (Kimi). It also reports whether the parallel limit is a native setting or guidance only.

`doctor` reads the receipts. It does not need the current presets or saved preferences. It does not run a model, so `modelExecution` is always `not_checked`.

`doctor` exits with code 0 also when an assistant has `attention`. Read the status of each assistant.

## detect

`detect` finds installed assistants.

```sh
agent-policy detect [--client ID] [--json]
```

APK looks for each executable on `PATH` and in the usual install folders. On macOS, it also checks the CLI copies in ChatGPT Desktop and Claude Desktop. It starts each candidate once with `--version`, and for Kimi and Antigravity sometimes with `--help`. A folder alone does not count as an installed assistant.

Each result has a status: `detected` with the version, `not_found`, `invalid` or `timeout`. The `origin` field is `path`, `known_location` or `desktop_app`. The [assistants reference](../reference/assistants.md) lists the executables and locations.

## release

`release` shows the configuration release of the package that you run.

```sh
agent-policy release [--preset NAME] [--json]
```

The JSON output contains the version, the selected preset, all presets with their labels, the catalog review date, a hash of the preset preferences and the full release notes. The readable output shows the version and the preset. `--release` and `--config` are not accepted here.

## uninstall

`uninstall` plans the removal of the configuration that APK owns. With `--apply`, it removes it.

```sh
agent-policy uninstall [--client ID] [--home PATH] [--state-dir PATH] [--apply] [--json]
```

- Without `--client`, it uses every assistant that has a receipt in the state directory.
- It needs no assistant executable and no preferences.
- It restores your original values and keeps unrelated later edits.
- If you edited a file or block that APK owns, it stops for that assistant with `OWNED_DRIFT`.

The overall status is `completed`, `partial` or `not_installed`. If one assistant fails, the command exits with code 3. For the full procedure, see [Updates and removal](updates-and-removal.md#remove-apk).

## init

`init` creates an editable preferences file with the Standard preset.

```sh
agent-policy init --policy ./preferences.json
```

- `--policy` is required. Otherwise the command fails with `POLICY_PATH_REQUIRED`.
- `init` never replaces a file. If the file exists, the command fails with `EEXIST`.
- It creates missing folders and makes the file readable only by you.

To edit and apply the file, see [Preferences](preferences.md).

## instructions

`instructions` prints the AI operator guide ([AGENT_INSTALL.md](../../AGENT_INSTALL.md)) as plain text. An AI agent that installs APK for you follows this guide.

## Output

APK prints readable text or JSON:

- In an interactive terminal, the output is readable text.
- When the output goes to a pipe or a file, it is JSON.
- `--json` always selects JSON.

Readable output starts with `Agent Policy Kit · VERSION`. A setup preview shows `Preview · no files changed`. Other headings are `Configuration applied`, `Already up to date`, `Setup incomplete` and `No supported selected tools found`. Readable output names problems with a short reason and the code, for example `Local edits prevent an update (OWNED_DRIFT)`.

Setup JSON contains `requiredActions`: one entry for each problem, with the assistant and the code. A command error prints only `{"error": "CODE"}`.

No output contains configuration bodies, raw executable output, raw errors or private paths. See [Privacy](privacy.md).

## Exit codes

| Code | Meaning |
|---|---|
| 0 | The command completed. For `setup`, all selected and installed assistants are planned, configured or unchanged. |
| 1 | The command failed before it could produce a result, for example because of an unknown option or input that is not valid. The output contains only an error code. |
| 3 | The result is incomplete. `setup`: no selected assistant is installed, or at least one assistant has `prerequisite`, `error`, `invalid` or `timeout`. `uninstall`: at least one assistant failed. `show`: at least one assistant has `attention`. |

`doctor`, `detect`, `release`, `init` and `instructions` exit with code 0 when they produce a result.

## Error codes

### Command errors

These codes come with exit code 1:

| Code | Cause |
|---|---|
| `UNKNOWN_COMMAND` | The command name is not known. |
| `UNEXPECTED_ARGUMENT` | More than one positional argument. |
| `ERR_PARSE_ARGS_UNKNOWN_OPTION` and other `ERR_PARSE_ARGS_*` codes | An option is not known or has a wrong value type. |
| `CONFLICTING_OPTIONS` | Two input modes, or an option that the command does not accept. |
| `DUPLICATE_OPTION` | An explicit tool option appears twice. |
| `UNSUPPORTED_CLIENT` | `--client` is not a supported assistant ID. |
| `STATE_PATH_MUST_BE_ABSOLUTE` | The state directory path is relative. |
| `UNKNOWN_PRESET` | `--preset` is not `fast`, `balanced` or `quality`. |
| `INVALID_EXPLICIT_CONFIG` | Explicit tool arguments are not valid. |
| `INVALID_CONFIG` | The `--config` value is not valid. |
| `INVALID_POLICY` | The preferences file is not valid. |
| `POLICY_PATH_REQUIRED` | `init` has no `--policy`. |
| `EEXIST` | The `init` target file already exists. |
| `ENOENT` | The `--policy` file of `setup` does not exist. |
| `OPERATION_FAILED` | Another failure. |

### Assistant results

These codes appear in the result of one assistant. `setup` and `uninstall` then exit with code 3. `doctor` reports an error code as the reason of the status `attention` and exits with code 0.

| Code | Meaning |
|---|---|
| `OWNED_DRIFT` | You edited a file or block that APK owns. APK keeps your edit. |
| `INSTALLATION_CONFLICT` | The installed APK preferences differ from this request. |
| `POLICY_CONFLICT` | The saved preferences differ from this request. |
| `OWNERSHIP_CONFLICT` | A file that APK wants to create already exists, or the instructions file already has an APK block that APK does not own. |
| `INVALID_RECEIPT` | The receipt has an unknown format or content, for example a receipt that a newer APK version wrote. See [Migration boundaries](updates-and-removal.md#migration-boundaries). |
| `LEGACY_RUNTIME_RECEIPT` | The receipt comes from an experimental runtime version: format v1, hooks or a package path. Remove it with the version that created it. |
| `RECOVERY_REQUIRED` | An interrupted transaction needs recovery. |
| `INSTALL_LOCKED` | Another APK operation holds the lock. |
| `STALE_PLAN` | A file that the plan read changed before or during the apply. Make a new plan. |
| `INSTALL_FAILED` | A write failed. APK restored the earlier configuration of the assistant. |
| `ROLLBACK_CONFLICT` | APK could not restore a file after a failure. It keeps the lock and the journal for recovery. |
| `UNSAFE_PATH` | A path contains a symbolic link, is outside its expected folder, or has a part with an unexpected file type. |
| `UNSAFE_FILE` | A file that APK reads is not a regular file, or it is larger than 1 MiB. |
| `UNSUPPORTED_CONFIG` | A native configuration file has a structure or a value type that APK cannot change safely. |
| `INVALID_JSON`, `INVALID_TOML` | A native configuration file is not valid JSON or TOML. |
| `UNSUPPORTED_TOML_STRUCTURE`, `UNSUPPORTED_TOML_VALUE` | A TOML file uses a form that APK does not edit. |
| `CHATGPT_CAP_ALIAS_CONFLICT` | The ChatGPT `config.toml` has the older `[agents] max_threads` setting. See the [assistants reference](../reference/assistants.md#chatgpt-codex). |
| `PLATFORM_UNSUPPORTED` | APK cannot write on Windows. |
| `EACCES`, `EPERM`, `ENOENT`, `ENOSPC`, `EIO`, `EROFS` | A file operation failed in the operating system. |
| `SETUP_FAILED` | Another `setup` failure. `uninstall` reports another failure as `OPERATION_FAILED`. |
| `native-home-override-unsupported` | The assistant uses a native folder that is not standard. `doctor` reports it as `NATIVE_HOME_OVERRIDE_UNSUPPORTED`. |
| `client-not-selected` | `--client` names an assistant that the preferences do not include. |
| `claude-force-model-conflict` | Claude Code forces one subagent model. |
| `kimi-provisioned-models-required` and other `kimi-*` codes | Kimi needs model aliases or effort support that are not configured. |

For recovery codes, see [Updates and removal](updates-and-removal.md#recover-from-an-interrupted-change). For the assistant-specific prerequisites, see the [assistants reference](../reference/assistants.md).

## Related documents

- [Getting started](getting-started.md): the first setup.
- [Configurator](configurator.md): the page that generates the setup command.
- [Preferences](preferences.md): the preferences JSON format.
- [Updates and removal](updates-and-removal.md): change the release, uninstall and recover.
