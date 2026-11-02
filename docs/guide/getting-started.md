# Getting started

This guide shows the first setup of Agent Policy Kit (APK): choose settings on the configurator page, preview the command, apply it, check the result and remove the npm package. It also shows common scenarios. It is for people who use APK with their AI assistants.

## What APK does

APK writes native subagent settings for the coding agent of each AI assistant, then exits:

| AI assistant | Coding agent that APK configures |
|---|---|
| ChatGPT | Codex |
| Claude | Claude Code |
| Kimi | Kimi Code |
| Gemini | Antigravity (not Gemini CLI) |
| Grok | Grok Build |

A *subagent* is a helper agent that your main agent can start for one task. A *role* is a named subagent definition, for example `apk-reviewer`. APK gives each role a model and, where the assistant supports it, an effort level. The [roles reference](../reference/roles.md) describes the six roles.

Your main agent and its model do not change. The main agent still decides when to delegate. The settings apply only when it delegates. APK installs no proxy, hook or background process. For the files APK writes in each assistant, see the [assistants reference](../reference/assistants.md).

## Before you start

Make sure that you have:

- Node.js 22.13 or later in the 22 line, or Node.js 24 or later. The setup command uses `npx`.
- At least one supported AI assistant installed. APK does not install assistants, sign in or accept terms for you.
- A macOS or Linux computer. On Windows, a preview works, but APK refuses to write files. See [Platforms](../reference/assistants.md#platforms).

## Set up with the configurator

1. Open the configurator: <https://agent-policy-kit.trymenow.io/>.
2. In step 1, keep or remove subagent roles. All six roles are selected when the page opens.
3. In step 2, add the AI assistants that you use.
4. In step 3, choose a work mode: **Light**, **Standard** or **Top-tier**. The mode sets how much of your plan limits subagents can use. The [presets reference](../reference/presets.md) lists the values of each mode.
5. In step 4, click **Copy command**.
6. Paste the command into a text editor.
7. To get a preview first, delete the last line (`--apply`). Also delete the ` \` at the end of the line before it.
8. Run the preview command in a terminal. A preview writes no files.
9. Read the result. Each assistant shows what APK would change, or why it cannot continue.
10. Run the full command, with `--apply`.
11. Open a new session in each configured assistant. A session that was open before setup can keep the old settings.

You can undo the setup later. Step 4 of the page shows the `uninstall` command for its release. The removal restores the settings that you had before APK and keeps your unrelated edits. See [Remove APK settings after other changes](#remove-apk-settings-after-other-changes).

For each control on the page, see [Configurator](configurator.md).

## Check the result

1. Run `doctor` to verify the configuration that APK owns:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.5.1 agent-policy doctor
   ```

2. Run `show` to read the subagent settings that your assistants use now, including settings that you made yourself:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.5.1 agent-policy show
   ```

A verified configuration does not prove that a provider runs a specific model. For all command options, see [Commands](commands.md).

## Remove the npm package

The native files do not depend on the APK package. After a successful setup, you can remove the package:

- If you used `npx`, npm keeps a copy in its cache. No global package is installed.
- If you installed APK with `npm install`, uninstall it with npm.

Keep the APK state directory (`~/.agent-policy-kit` by default). It contains private receipts. A *receipt* records what APK owns, so that APK can update or remove only its own changes later. For details, see the [ownership reference](../reference/ownership.md).

## Common scenarios

### Add only some roles

1. In step 1 of the page, remove the roles that you do not want. For example, keep only **Reviewer** and **Code explorer**.
2. Complete the other steps and apply the command.

APK creates files only for the selected roles, for example `apk-reviewer` and `apk-explorer`. A later setup with a different role selection replaces the earlier set of APK roles. It keeps files that APK does not own.

### Use one role scheme across several assistants

1. In step 2, add all the assistants that you use.
2. In step 3, choose a mode for all of them with **All** selected, or click one assistant to give it a different mode.
3. Apply the command.

Each assistant gets its own native role files and instructions. No central service runs between the assistants and their providers.

### Apply the release defaults without the page

Run setup with the release input mode:

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.5.1 agent-policy setup --release
```

This previews the Standard mode. Add `--preset fast` for Light or `--preset quality` for Top-tier. Add `--apply` to write the files. For details, see [Commands](commands.md#release-presets---release-and---preset).

### Choose your own models

Use one of these methods:

- On the page, open one assistant and change its models and effort. The mode changes to **Custom**.
- Write a preferences file. See [Preferences](preferences.md).

Choose only models that your account can use. APK does not grant model access.

### Use the macOS desktop apps

On macOS, APK also finds the Codex copy in ChatGPT Desktop and the Claude Code copy in the Code tab of Claude Desktop. These copies read the same settings as their CLIs. For the limits, see the [assistants reference](../reference/assistants.md).

### Remove APK settings after other changes

Run `uninstall` to preview the removal, then `uninstall --apply`. APK restores your original values and keeps unrelated changes, for example a later theme setting. If you edited a file or block that APK owns, removal stops for that assistant and keeps your edit. For the full procedure, see [Updates and removal](updates-and-removal.md).

## Related documents

- [Configurator](configurator.md): every step and control of the page.
- [Commands](commands.md): the full CLI reference.
- [Updates and removal](updates-and-removal.md): change the release, uninstall and recover.
- [Privacy](privacy.md): what APK reads, writes and never sends.
