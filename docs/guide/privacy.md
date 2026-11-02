# Privacy

This document lists what APK reads, what it writes and what it never sends, for the CLI and for the configurator page. It is for everyone who uses APK or wants to check it before use.

## Summary

- APK runs on your computer, writes native settings and exits.
- APK sends no data to a server. It has no telemetry, no proxy and no background process.
- APK does not read your conversations, and it does not sign in or call a model.
- The APK state directory can contain secrets from your existing settings. Keep it private.

## What the CLI reads

| Source | When | Why |
|---|---|---|
| Preferences: a preset of the release, the saved `policy.json`, a `--policy` file or a `--config` value | `setup`, `install` | To know what to configure. |
| Native configuration of each assistant: its settings file, role files and instructions file | `setup`, `install`, `show`, `doctor`, `uninstall` | To plan changes, to show current settings and to verify ownership. |
| The APK state directory: receipts, saved preferences, journal and backups | `setup`, `install`, `show`, `doctor`, `uninstall` | To know what APK owns. |
| Assistant executables | `setup`, `install`, `detect`, `doctor` | To find installed assistants. |
| Environment variables, for example `PATH`, the native-home variables and the Claude subagent variables | All commands that read assistants | To find executables and the active native folders. |

To find an assistant, APK starts each candidate executable with `--version`. For Kimi and Antigravity, it can also use `--help`. These probes have a time limit and an output limit. APK does not start a session or send a task.

APK does not read transcripts, session history, prompts or project files. The [assistants reference](../reference/assistants.md) lists the files that APK reads and writes for each assistant.

## What the CLI writes

The CLI writes only with `--apply`, or with `init`:

- The native settings, role files and instruction block that APK owns, in the user folders of each assistant.
- Private files in the state directory: receipts, saved preferences, a lock, a journal and transaction backups. Folders are readable only by you, and files are readable and writable only by you.
- `init` creates one new preferences file.

With `--config`, APK writes the decoded preferences to a private temporary file. It removes that file when the command ends.

APK does not provision, copy or transfer credentials. It does not change your main model, sign-in, permissions or unrelated settings.

## What the CLI prints

- Paths appear as `~/...` or `<state-dir>/...`, not as full private paths.
- Errors appear as codes, not as raw error text.
- The output does not contain configuration bodies or raw executable output.
- `show` does not print prompts or credentials. It refuses values that look like tokens or private paths and marks the read as incomplete.

## The state directory

The state directory contains copies of earlier versions of your native files. These copies can contain secrets that were already in your settings.

- Keep the state directory private.
- Never publish receipts, backups or backup indexes.
- Do not share the content of the state directory to report a problem. Share the error codes instead.

The [ownership reference](../reference/ownership.md#state-directory) tells where the state directory is and what it contains.

## The configurator page

- The page is one static HTML file. It has no backend.
- It makes no requests while you use it and has no telemetry. Its fonts and data are inside the file.
- Your choices stay in the browser. A share link stores them in the part of the address after `#`. Browsers do not send this part to the server.
- Links to other sites load only when you click them.
- The page never runs the command and has no access to your accounts or files.

Your browser loads the hosted page like any other web page.

## What other software does

APK does not change how other software handles your data:

- `npx` downloads the APK package from the npm registry.
- Each assistant keeps its own provider and account behavior. When it runs a subagent, it uses its own connection to its provider.

## Related documents

- [Getting started](getting-started.md): the first setup.
- [Commands](commands.md): what each command reads and writes.
- [Ownership reference](../reference/ownership.md): receipts, state and backups.
