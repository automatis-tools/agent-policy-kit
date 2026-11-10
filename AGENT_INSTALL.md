# Agent Policy Kit — AI operator guide

This guide is for an AI agent that installs, updates or removes Agent Policy Kit (APK) settings for its owner. It gives the steps in order: select the release, detect, choose the input, plan, apply, verify, remove and report. Flags, output fields and per-assistant details are in the linked documents. `agent-policy instructions` prints this guide.

## Rules

APK is configuration-only. It writes native files and exits. It adds no hook, proxy, launcher, plugin, daemon, runtime audit or background updater. The native files stay independent after the npm package and the source are removed.

Obey these rules in every step:

1. Do the authorized setup or removal yourself. Do not give the owner a shell checklist.
2. Preserve main models, credentials, permissions, unrelated settings and later user edits.
3. Subagent preferences apply only when the main agent decides to delegate. Do not require delegation. Do not enable a disabled delegation feature.
4. Never log in, collect credentials, accept terms, start model tasks or publish anything.
5. Never weaken a sandbox or bypass a trust check to make an installation succeed. Never add a runtime gate to replace a missing native feature.
6. Read JSON. Add `--json` to every command. Captured output is JSON without the flag, but a terminal gets readable text.
7. Read every per-client result. One client can succeed while another fails. Never report a partial result as a full update.
8. Keep the state directory private. Its backups can contain existing secrets.

In the steps below, `agent-policy` means the pinned command for the requested release:

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.6.0 agent-policy
```

## Step 1: Select the release

The package version is the configuration release. Use the version that the owner names, or the version in the command from the configurator.

1. Read the release notes:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.6.0 agent-policy release --json
   ```

2. Read the entry for this version in [CHANGELOG.md](CHANGELOG.md): what changed, why, and the migration limits.
3. For a downgrade, also read the entry of each newer version, up to the version that is applied now. `doctor` shows the applied version of each client. A migration boundary is recorded in the entry of the newer version. The release notes of an older package do not contain newer entries, so run `release --json` with the applied version.
4. Check the installed tool versions, the model aliases that the account actually has, and the current official model and effort documentation.
5. Keep the explicit choices of the owner. A newer package or a newer model is not an instruction to switch.

For several commands, you can install the package into a temporary or user-owned prefix:

```sh
npm install --prefix PREFIX agent-policy-kit@0.6.0 --ignore-scripts --no-audit --no-fund
```

Then run `PREFIX/node_modules/.bin/agent-policy`. If the owner gives you a verified local `.tgz` file of a version that is not on npm, install that file in the same way. You need no sudo, no fixed prefix and no shell profile change.

More: [updates and removal](docs/guide/updates-and-removal.md), [presets](docs/reference/presets.md), [model review procedure](docs/maintainers/model-review.md).

## Step 2: Detect

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.6.0 agent-policy detect --json
```

1. Read the status of each assistant: `detected`, `not_found`, `invalid` or `timeout`.
2. APK needs a working executable. A leftover settings folder is not an installed assistant.
3. On macOS, `origin: desktop_app` means the CLI inside ChatGPT Desktop or Claude Desktop. It uses the standard native folder.
4. If `CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `KIMI_CODE_HOME` or `GROK_HOME` points to a nonstandard folder, setup returns a prerequisite for that client and writes nothing. Do not change the variable to force a setup.
5. `--home PATH` selects the standard layout under another base folder. If you use `--home` or `--state-dir`, use the same values in every later command.

More: [assistants](docs/reference/assistants.md).

## Step 3: Choose the input

Use exactly one input mode. A combination fails before any write.

| Input | Use it when |
|---|---|
| Explicit tool arguments (`--roles`, `--max-concurrent`, `--chatgpt`, `--claude`, `--kimi`, `--gemini`, `--grok` and their options) | The owner gives a command from the configurator. Keep its shell quotes and line continuations |
| `setup --release --preset fast`, `balanced` or `quality` | The owner wants a named preset of this release. This is the supported path to upgrade or downgrade to a pinned release |
| `setup --config BASE64URL` | The owner gives encoded preferences. Decode and inspect the JSON first. It must contain preferences only, never credentials or executable content |
| `setup --policy FILE` | The owner keeps a preferences file. This mode does not replace different saved choices. To replace them deliberately, validate the file and pass it as `--config` |

The configurator command lists every selected role for every selected assistant. The tools that it does not name are not configured.

Some release changes cross a migration boundary. For example, to move Claude from 0.4.0 to 0.3.0, first remove its settings with 0.4.0. Read [migration boundaries](docs/guide/updates-and-removal.md#migration-boundaries) before an upgrade or a downgrade.

More: [commands](docs/guide/commands.md), [preferences](docs/guide/preferences.md).

## Step 4: Plan

1. Run the chosen setup command without `--apply`.
2. Read the overall `status` and each entry in `results`.
3. Read each entry in `requiredActions`.

Exit code 3 means one of these conditions:

- No selected assistant was detected.
- At least one selected assistant returned a prerequisite, an error, or an invalid or timed-out detection.

The other clients still have valid results.

Resolve a prerequisite only in a way that preserves the main behavior:

- Kimi needs provisioned aliases, provider metadata and supported efforts. Do not invent them. Do not change the main thinking setting to install a helper.
- If a selected Kimi alias also serves the main model, a changed effort default returns `kimi-main-effort-conflict`. Use a separate compatible alias, or prepare a native variant that keeps the main behavior.
- `claude-force-model-conflict` means that the Claude settings force one subagent model. It needs an explicit decision about that native setting from the owner.

More: [commands](docs/guide/commands.md), [assistants](docs/reference/assistants.md).

## Step 5: Apply

1. Add `--apply` to the same command that you planned. A configuration that the owner already authorized needs no second confirmation.
2. Read each result. `configured` and `unchanged` are successful results.

APK updates owned files in a transaction for each client, without a removal gap. Drift or a missing prerequisite keeps the existing release of that client. A late failure rolls that client back.

## Step 6: Verify

1. Run `doctor`:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.6.0 agent-policy doctor --json
   ```

   Each client reports its saved release, source and preset from its receipt, independent of the version that runs `doctor`. `verified` means that the owned files match the receipt.

2. Run `show` to read the current user-level subagent settings, including manual edits:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.6.0 agent-policy show --json
   ```

   `show` does not resolve project, managed or session settings. It exits with code 3 when a client needs attention, and it keeps the results of the other clients.

3. Tell the owner that a native client can need a new session to load the changes. Do not stop active sessions.

A verified configuration does not prove that a model runs. After verification, you can remove the npm package or the temporary prefix. Keep the state directory: its receipts are necessary for a later owned removal.

## Step 7: Remove

1. Plan the removal:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.6.0 agent-policy uninstall --json
   ```

2. Review the plan.
3. Run the same command with `--apply`.

The receipts verify ownership. Removal restores the original user settings and keeps unrelated later edits. APK refuses to remove an owned file that someone edited.

- Do not restore old whole-file backups.
- Do not delete locks or pending journals by force.
- Do not delete hooks by text match.
- Use a version that can read the receipt. All versions from 0.1.0 write receipt format v4, but an older version can refuse the content of a newer receipt. A Claude setup with `--claude-auto-compact` writes format v5, which 0.5.2 and earlier refuse. Versions 0.3.0 and earlier cannot read a 0.4.0 Claude receipt that owns `CLAUDE_CODE_SUBAGENT_EFFORT`: remove it with 0.4.0. ChatGPT and Gemini settings from 0.2.0 or earlier need removal with the version that created them. See [migration boundaries](docs/guide/updates-and-removal.md#migration-boundaries).

More: [ownership](docs/reference/ownership.md), [updates and removal](docs/guide/updates-and-removal.md).

## Step 8: Report

Give the owner a short result for each client:

- Detection: status, version and origin.
- Result: the status, for example `configured`, `unchanged`, `prerequisite` or `error`, and its codes.
- Applied release, source and preset, from `doctor`.
- Required actions that remain.
- Whether a new session is necessary.
- What is not checked: model execution, provider identity, entitlement and alias resolution.

Receipts are the applied truth. `policy.json` in the state directory is only the latest requested snapshot, so it can differ from an older client. Kimi and Gemini limits and all avoid lists are guidance, not hard caps. A public release, a deployment or a live model task is not part of this work.
