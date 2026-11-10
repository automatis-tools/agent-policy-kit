# Updates and removal

This document shows how to choose a configuration release, upgrade or downgrade to it, remove APK and recover from an interrupted change. It also lists what a release does not freeze. It is for people who already use APK and want to change or remove their setup.

## Configuration releases

A *configuration release* is one version of the APK npm package. Each version freezes these parts:

- The named presets: Light, Standard and Top-tier.
- The model catalog with its effort levels.
- The native role templates and the delegation instructions.
- The release notes and the configurator page.

There is no separate preset version. The package version is the release version. Published versions are not changed later.

Installing or updating the npm package does not change your native files. Only `setup` or `uninstall` with `--apply` changes them.

## Choose a release

1. Read the [release notes](../../CHANGELOG.md). Each entry says why the release exists, who should update and how to migrate or roll back.
2. Show the release and its notes with the `release` command:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.6.0 agent-policy release
   ```

3. Check the installed versions of your assistants and the models that your account can use.

A newer release or model is not always better for your work, your account or your limits. APK never changes your models without a setup command.

A release that is not published yet has the heading `VERSION — Unreleased` in the release notes. Its `npx` command does not work until npm serves the version. To list the published versions, run `npm view agent-policy-kit versions`. The [website document](../maintainers/website.md#release-status-on-the-page) tells what the configurator page shows for a release that is not published.

## Upgrade or downgrade

### To the defaults of a release

1. Preview the setup with the release that you want:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.6.0 agent-policy setup --release
   ```

2. To select another preset, add `--preset fast` (Light) or `--preset quality` (Top-tier). The default is `balanced` (Standard).
3. Read the preview.
4. Run the same command with `--apply`.

To downgrade, use the same steps with an older version in `--package agent-policy-kit@VERSION`. Before you downgrade, read [Migration boundaries](#migration-boundaries). Some changes need a removal first.

### To your own choices

1. Open the configurator page of the release, for example <https://getacc.dev/tools/agent-policy-kit/>.
2. Make your choices and copy the command. The command is pinned to the release of the page.
3. Preview and apply it as described in [Getting started](getting-started.md#set-up-with-the-configurator).

You can also apply a preferences file with `--config`. See [Preferences](preferences.md#replace-an-earlier-setup).

### What happens during an update

Explicit tool arguments, `--release`, `--preset` and `--config` can replace an earlier APK setup in one step. There is no removal before the new setup.

- APK checks that the files it owns still have the values it wrote.
- It rebuilds your original values in memory and writes the new release on top of them.
- If a check fails or a prerequisite is missing, it changes nothing for that assistant. The earlier release stays.
- If a write fails late, it rolls back to the earlier release.
- Unrelated changes that you made later stay.

Each assistant has its own transaction. One assistant can move to the new release while another keeps its earlier release. Read the result of each assistant. Run `doctor` to see the release that each assistant has now.

The [ownership reference](../reference/ownership.md#updates) describes the transaction steps.

### Migration boundaries

A *migration boundary* is a release change that setup cannot do in place. At a boundary, setup stops for the affected assistant and changes nothing. First remove the APK settings of that assistant with a release that can read its receipt. Then set up with the other release. The release notes record each boundary in the entry of the newer release.

These boundaries are known:

| Assistant | Change | Setup without removal | Remove with |
|---|---|---|---|
| Claude | From 0.4.0 or later to 0.3.0 or earlier | `INVALID_RECEIPT` | The installed release, 0.4.0 or later |
| Claude, only with `--claude-auto-compact` | From a version after 0.5.2 to 0.5.2 or earlier | `INVALID_RECEIPT` | The installed release, after 0.5.2 |
| ChatGPT, Kimi and Grok, only if `config.toml` did not end with a line break before setup | From 0.5.2 or later to 0.5.1 or earlier | `INVALID_RECEIPT` | The installed release, 0.5.2 or later |
| ChatGPT and Gemini | From 0.2.0 or earlier to 0.3.0 or later | `OWNERSHIP_CONFLICT` | The release that created the settings, for example 0.2.0 |
| ChatGPT and Gemini | From 0.3.0 or later to 0.2.0 or earlier | `OWNERSHIP_CONFLICT` | The release that created the settings, for example 0.4.0 |

**Claude with `--claude-auto-compact`, to 0.5.2 or earlier.** A setup with this option writes receipt format v5, which 0.5.2 and earlier refuse without changing anything. First run the installed release without the option to return to format v4, or remove the Claude settings with it. The saved `policy.json` also keeps the option, so 0.5.2 needs a preferences input such as `--preset` until a setup without the option replaces that file.

**Claude, 0.4.0 or later to 0.3.0 or earlier.** A Claude receipt from 0.4.0 or later owns `CLAUDE_CODE_SUBAGENT_EFFORT` when the effort of the default subagent role is pinned. Every preset pins it. Releases 0.3.0 and earlier do not know this setting, so they refuse the receipt. To move Claude back to 0.3.0:

1. Remove the Claude settings with the installed release (0.4.0 or later), for example:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.6.0 agent-policy uninstall --client claude --apply
   ```

2. Set up Claude with 0.3.0.

ChatGPT, Kimi, Gemini and Grok move from 0.4.0 to 0.3.0 in place.

**ChatGPT, Kimi and Grok, 0.5.2 or later to 0.5.1 or earlier.** If `config.toml` did not end with a line break before setup, APK adds one before its first new line. Since 0.5.2, the receipt records this as `addedLineBreak`, so that uninstall can remove the line break again (#34). Releases 0.5.1 and earlier do not know this field, so they refuse the receipt. To move such an assistant back to 0.5.1:

1. Remove its settings with the installed release (0.5.2 or later), for example:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.6.0 agent-policy uninstall --client grok --apply
   ```

2. Set up that assistant with 0.5.1.

If `config.toml` ended with a line break, the receipt has no such field, and these assistants move from 0.5.2 to 0.5.1 in place.

**ChatGPT and Gemini, 0.2.0 and 0.3.0.** Release 0.3.0 renamed the assistant IDs `codex` to `chatgpt` and `agy` to `gemini`. Releases 0.3.0 and later do not read receipts under the old IDs, and releases 0.2.0 and earlier do not know the new IDs. To move from 0.2.0 to a later release:

1. Remove the settings with 0.2.0:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.2.0 agent-policy uninstall --client codex --apply
   npx --yes --ignore-scripts --package agent-policy-kit@0.2.0 agent-policy uninstall --client agy --apply
   ```

2. Set up ChatGPT and Gemini with the later release.

In the other direction, remove them with `--client chatgpt` and `--client gemini` and the newer release. Claude, Kimi and Grok keep their IDs.

Preview each removal without `--apply` first. The [ownership reference](../reference/ownership.md#receipt-formats) explains the receipt formats. The [release notes](../../CHANGELOG.md) of 0.3.0 and 0.4.0 give the details.

## What a release does not freeze

A release reproduces the declared settings and templates. It does not control the providers:

- A model alias can resolve to a newer model. For example, Claude documents that its [model aliases update over time](https://code.claude.com/docs/en/model-config#model-aliases).
- An old model ID can be retired.
- Your account access can change.

Where reproducibility is important, use a versioned model ID if the assistant supports it. A configured model ID does not prove which model the provider runs.

APK has no background updater and requests no live model catalog. Your configured values stay until you run another setup.

## Remove APK

1. Preview the removal:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.6.0 agent-policy uninstall
   ```

2. Read the preview.
3. Remove the configuration:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.6.0 agent-policy uninstall --apply
   ```

4. Run `show` to check the current settings.

If you used `--home` or `--state-dir` for setup, use the same values here. To remove APK from one assistant only, add `--client ID`.

Uninstall uses the receipts in the state directory. It needs no assistant executable and no preferences. It restores the values that you had before the first APK setup, also after release changes. It keeps unrelated later changes. It removes the receipts, but keeps the saved preferences and the private backups in the state directory.

You do not need the release that you used for setup. Any release that can read the receipt can remove it. There are two known exceptions:

- Releases 0.3.0 and later do not read the ChatGPT and Gemini receipts of 0.2.0 and earlier. Remove these settings with the release that created them.
- Releases 0.3.0 and earlier cannot read a Claude receipt from 0.4.0 or later that owns `CLAUDE_CODE_SUBAGENT_EFFORT`. Remove these settings with 0.4.0 or a later release.

See [Migration boundaries](#migration-boundaries) and the [ownership reference](../reference/ownership.md#receipt-formats).

## Handle local edits

APK owns these parts:

- The `apk-ROLE` role files that it created.
- The block between `<!-- BEGIN agent-policy-kit -->` and `<!-- END agent-policy-kit -->` in the instructions file of the assistant.
- The settings that it set in the native configuration file of the assistant, if the assistant has one.

If you change one of these parts, APK calls this *drift*. Update and removal then stop for that assistant with `OWNED_DRIFT`. APK does not overwrite your edit.

1. Find your edit in the APK part.
2. Undo the edit, or move your change outside the APK part.
3. Run the command again.

Do not restore an old backup of the whole file. It can remove other changes that you made later. The [assistants reference](../reference/assistants.md#settings-in-the-configuration-file) lists the owned settings for each assistant. The [ownership reference](../reference/ownership.md#drift) explains how APK detects drift.

## Recover from an interrupted change

APK stops with one of these codes if an earlier change did not finish:

- `INSTALL_LOCKED`: another APK operation holds the lock.
- `RECOVERY_REQUIRED`: an interrupted transaction left a journal in the state directory.

Do not delete the lock or the journal only to make APK continue. Another operation can own it, or the backups can be necessary.

1. Make sure that no other APK command runs.
2. Make a private copy of the affected native files and of the state directory.
3. Compare the current files with the before and after values that the transaction recorded.
4. Fix only the changes that APK owns. Keep every unrelated change.
5. Remove only the markers of the transaction that you fixed.
6. Run a preview again.

The state directory can contain secrets from your existing settings. Never publish configuration files, backups or backup indexes. The [ownership reference](../reference/ownership.md) describes the journal, the lock and the backup files.

## Related documents

- [Commands](commands.md): all options of `setup`, `release`, `doctor` and `uninstall`.
- [Release notes](../../CHANGELOG.md): what changed in each release.
- [Ownership reference](../reference/ownership.md): receipts, state, drift and transactions.
