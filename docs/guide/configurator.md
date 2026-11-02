# Configurator

This document describes the configurator page: its four steps, the work modes, the top models switch, the per-assistant limits, the undo command and the share links. It is for people who use the page to make a setup command. For a first setup from start to end, see [Getting started](getting-started.md).

## Open the page

Use one of these pages:

- The hosted page for the current release: <https://agent-policy-kit.trymenow.io/>.
- The hosted page for one release, for example <https://agent-policy-kit.trymenow.io/v/0.4.0/>.
- The local file `site/index.html` from the APK package or repository.

Use a current version of Google Chrome. The page is one self-contained HTML file. It has no backend and makes no requests while you use it. It never runs the command and never grants model access.

Each page belongs to one configuration release. A *configuration release* is one APK package version with its presets, model catalog and role templates. The status line under step 4 shows the release, for example `Configuration release 0.4.0`. While the release notes mark the release as unreleased, the line shows a release-candidate notice instead. The [website document](../maintainers/website.md#release-status-on-the-page) tells when each line is shown.

## Step 1: Subagent roles

All six roles are selected when the page opens.

- Click **×** on a role to remove it.
- Click a role below the field to add it again. Click **Add all** to add all missing roles.
- Click **?** on a role to read its description and the base prompt that APK saves.

A green check on the step means that at least one role is selected. The [roles reference](../reference/roles.md) describes each role.

## Step 2: AI assistants

1. Click an assistant below the field to add it. **Add all** adds every assistant.
2. Click **×** on an assistant to remove it.

Assistants keep the order in which you add them. The command uses the same order.

- With one assistant, you edit that assistant.
- With two or more assistants, an **All** button appears and is active. **All** edits all selected assistants together.
- Click one assistant to edit only that assistant. Its current mode shows under its name.

When you select Gemini, the page shows a note: APK configures Antigravity, not Gemini CLI. The page does not check which assistants are installed. The CLI checks this when you run the command.

## Step 3: Work mode

A *work mode* sets the models, effort levels and parallel limit for an assistant. No mode is selected when the page opens. Each selected assistant needs a mode before the command is available.

| Mode | Use |
|---|---|
| Light | Light models for every role. Limits last longest. |
| Standard | Stronger models for code, review, tests and docs. Fits most plans. |
| Top-tier | High-end models for most roles. Uses limits fastest. |
| Custom | Your own models and effort. |

The values of Light, Standard and Top-tier are in the [presets reference](../reference/presets.md).

### Choose a mode for all assistants

1. Make sure that **All** is active.
2. Select a mode.

If the change replaces edited values, different modes or unfinished choices, the page asks you to confirm. Click **Cancel** to keep your choices. The **All** view does not show the model table. To change models, click one assistant.

### Choose a mode for one assistant

1. Click the assistant in step 2.
2. Select a mode.

The first mode choice needs no confirmation. Later, the page asks you to confirm if other assistants are selected or if you edited this assistant. Other assistants keep their choices.

For some assistants, every mode uses the same models. The page then says that the modes change only how many subagents run at once.

### Change models and effort

The **Models & effort** table shows one row for each selected role. It is visible only when you edit one assistant.

1. Select a model in the **Model** list.
2. To use a model that is not in the list, select **Custom model…** and type the native model ID. Gemini has no custom models. It accepts only its native tiers.
3. Click an effort button. Only the levels that the model supports are shown. A dash (—) means that the model has no native effort setting.

Any change to a model or effort sets the assistant to **Custom**. Selecting **Custom** without a change does not change any value. A model ID can have 1 to 128 ASCII characters and no spaces.

When you edit Kimi, Gemini or Grok, a short note above the table tells how that assistant applies effort. Screen readers read the note with the model and effort controls of each role. The **All** view shows no note, because it has no model table.

For Kimi, roles that use the same model alias share one effort. A change to one of these roles changes all of them. For Grok, the page offers the effort levels of the model: low, medium, high and xhigh for Grok 4.7, and none for Grok 4.6, Grok 4.5 and Grok Build 0.1. A custom Grok model ID offers every level that Grok Build accepts. Grok Build applies an effort only when the model supports effort. A Grok role without an effort runs at the default effort of its model. The [assistants reference](../reference/assistants.md) explains these limits.

### Use the top models switch

The top models switch is shown in Top-tier mode for assistants that have a top model. Its label names each model and effort. When you edit one assistant, the label is `Use <model · effort> for code, review and tests`. In the **All** view, it is `Use top models (…) for code, review and tests` and lists the top model of each assistant.

- Turn the switch on to use the top model for the Coder, Reviewer and Test writer roles.
- Turn the switch off to go back to the Top-tier values.

The switch changes only code roles that have no role-specific Top-tier value. The top model for each assistant is listed in the [presets reference](../reference/presets.md).

### Set the parallel limit

The **Parallel subagents** field sets the maximum number of subagents that run at once in one session. It is visible only when you edit one assistant.

1. Click one assistant in step 2.
2. Type a whole number from 1 to 32, or use **−** and **+**.

Each assistant keeps its own limit. A change sets only that assistant to **Custom**. Selecting a mode restores the limit of that mode. For Kimi and Gemini, the label is **Max per session (advisory)**: these assistants get the limit as guidance, not as a native cap.

## Step 4: Copy setup command

When all steps are complete, the page shows the command and a summary, for example `3 subagent roles · 2 AI assistants`.

1. Click **Copy command**.
2. Paste the command into a terminal or a text editor.

If the clipboard is not available, the page selects the command. Copy it with your keyboard. The green check on step 4 means that you copied the current command. It does not mean that APK is installed. A change to the form removes the check.

If a step is missing, the page names it with a link. If a value is not valid, the page shows `Check your settings.` and the first problem. It then shows no command.

### What the command contains

The command always lists every selected assistant and role with its model and effort. A preset fills the form, but the command does not refer to the preset by name. For this reason, APK records the source of the setup as custom.

A generated command has this form:

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.5.1 agent-policy setup \
  --roles 'reviewer,explorer' \
  --max-concurrent 3 \
  --chatgpt 'reviewer=gpt-6.1-sol:high,explorer=gpt-6-luna:high' \
  --claude 'reviewer=claude-sonnet-5-5:high,explorer=claude-haiku-5-5:medium' \
  --apply
```

- The package version is the release of the page.
- `--roles` lists the selected role IDs.
- `--max-concurrent` is the shared limit. If the limits of the assistants differ, the assistants with a different limit also get `--TOOL-max-concurrent`.
- Each assistant gets one argument with `role=model:effort` entries. Gemini entries have no effort. A Grok entry has an effort only when one is set, so a Grok role without an effort stays `role=model`.
- `--avoid-TOOL` appears only when the list of models to avoid is not empty. A model that you select is removed from that list.
- `--apply` is always the last line.

The [Commands](commands.md#explicit-tool-arguments) reference describes this syntax. To preview without writes, delete the `--apply` line and the ` \` at the end of the line before it.

### Undo the setup

Under step 4, the box **You can undo the setup** shows the command that removes the APK settings. The command is pinned to the release of the page, for example:

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.5.1 agent-policy uninstall --apply
```

The removal restores the settings that you had before APK and keeps your unrelated edits. It uses the receipts that setup saves in the state directory, `~/.agent-policy-kit` by default. Keep this directory.

1. Click **Copy** next to the command. If the clipboard is not available, the page selects the command. Copy it with your keyboard.
2. To preview the removal, run the command without `--apply`.
3. Run the command with `--apply` to remove the APK settings.

To remove the APK settings of one assistant only, add `--client ID`, for example `--client claude`.

The box is always visible. It does not depend on the form. [Updates and removal](updates-and-removal.md#remove-apk) gives the full procedure and the known exceptions.

## Reset the form

Click **Reset form** under step 4. The page selects all six roles again and clears the assistants, the modes and the copy status. It also removes the setup link from the address. Reset does not change files on your computer. To remove the APK settings, use the [undo command](#undo-the-setup).

## Check current settings

At the bottom of the page, **Check current settings** has a **Copy** button. It copies a read-only `show` command for the release of the page. Run it in a terminal to see the roles, models, effort and parallel limits that your assistants use now. See [Commands](commands.md#show).

## Share a setup

The page saves a complete form in the address, in the part after `#setup=`. The form is complete when steps 1, 2 and 3 show their green checks.

- When you open the page without a setup link, the address has no `#setup=` part.
- When steps 1, 2 and 3 are complete, the page writes the form into the address. Each later change replaces the part after `#setup=`.
- When a change makes step 1, 2 or 3 incomplete, the page removes the `#setup=` part. For example, this occurs when you remove the last assistant.
- **Reset form** removes the `#setup=` part.

To share a setup:

1. Complete steps 1, 2 and 3.
2. Copy the page address from the browser.
3. Send the address to the other person.

The link contains the roles, the assistant order, the mode of each assistant, the model and effort choices, each limit and the assistant that you edit. It does not contain the copy status. The link stays in the browser. The page needs no database to open it.

When someone opens the link, the page restores the form, including unfinished choices. The command is still blocked until all values are valid. For a link to an unfinished form, the address keeps the link until the form changes.

- A link contains its release version. A link from another release opens only on the page of that release. The hosted page sends such a link to the page of its release, if that page is hosted. Otherwise, the page shows an error.
- If a link is not valid, the page shows an error. Click **Reset form** to start again.
- A link to a local file works only on the same computer.

## Related documents

- [Getting started](getting-started.md): the first setup from start to end.
- [Commands](commands.md): run, preview and check the command.
- [Presets reference](../reference/presets.md): the values of each mode.
- [Privacy](privacy.md): what the page and the CLI read and send.
