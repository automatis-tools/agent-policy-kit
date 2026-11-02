# Preferences

This document describes the preferences JSON format and its validation rules. It also shows how to create, check and apply a preferences file. It is for advanced users who want to keep their APK choices in a file instead of in a configurator command.

## What preferences are

*Preferences* are JSON data that select the roles and, for each assistant, the models, effort levels, parallel limit and models to avoid. APK reads preferences, checks them, and writes native files from them. Preferences contain data only, never commands or credentials.

APK checks preferences in two ways:

- The [JSON Schema](../../schema/policy.schema.json) describes the shape.
- The validator in APK also checks the models and effort levels against the model catalog of the release.

Preferences apply only when the main agent decides to delegate. They do not turn on a subagent feature.

## Create a preferences file

1. Create a file with the Standard preset of the release:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.4.0 agent-policy init --policy ./preferences.json
   ```

2. Edit the file. Use the rules below.

`init` never replaces an existing file. The other presets of the release are in the `policies/` folder of the package: `fast.json` (Light), `balanced.json` (Standard) and `quality.json` (Top-tier).

## Format

### Top level

| Field | Required | Value |
|---|---|---|
| `schemaVersion` | Yes | `1` |
| `maxConcurrent` | Yes | A whole number from 1 to 32. The shared parallel limit. |
| `clients` | Yes | An object with at least one assistant. |
| `selectedRoles` | No | A list of role IDs. If you omit it, APK configures all six roles of the release. |

No other field is allowed.

### Assistants

The keys of `clients` are `chatgpt` (Codex), `claude` (Claude Code), `kimi` (Kimi Code), `gemini` (Antigravity) and `grok` (Grok Build). An assistant that is not in `clients` is not configured. The keys `codex` and `agy` from version 0.2.0 and earlier are not accepted.

Each assistant has these fields:

| Field | Required | Value |
|---|---|---|
| `code` | Yes | A choice. The default for the Coder, Reviewer and Test writer roles. |
| `light` | Yes | A choice. The default for the Code explorer, Docs writer and Task runner roles. |
| `roles` | No | An object with a choice for one or more role IDs. It replaces `code` or `light` for that role. |
| `avoidModels` | Yes | A list of model IDs, at most 32, without duplicates. It can be empty. |
| `maxConcurrent` | No | A whole number from 1 to 32. It replaces the shared `maxConcurrent` for this assistant. |

The [roles reference](../reference/roles.md) describes each role and its ID.

### Choices

A *choice* is an object with exactly two fields:

| Field | Value |
|---|---|
| `model` | A model ID. 1 to 128 characters: letters, digits and `. _ : @ / [ ] -`. It starts with a letter or digit. |
| `effort` | An effort level, or `null`. `null` sets no explicit effort, so the assistant uses its native default. |

### Example

```json
{
  "schemaVersion": 1,
  "maxConcurrent": 3,
  "selectedRoles": ["worker", "reviewer", "explorer"],
  "clients": {
    "claude": {
      "code": {"model": "claude-sonnet-5-5", "effort": "medium"},
      "light": {"model": "claude-haiku-5-5", "effort": "low"},
      "roles": {
        "reviewer": {"model": "claude-sonnet-5-5", "effort": "high"}
      },
      "avoidModels": ["claude-fable-5-1"]
    },
    "gemini": {
      "maxConcurrent": 2,
      "code": {"model": "pro", "effort": null},
      "light": {"model": "flash", "effort": null},
      "avoidModels": []
    }
  }
}
```

This example configures three roles in Claude Code and Antigravity. The Claude Reviewer uses high effort. The other Claude code roles use the `code` choice. Antigravity runs at most two subagents at once, as guidance.

## Validation rules

APK refuses preferences that break one of these rules:

- `selectedRoles`, if present, is not empty, has no duplicates and contains only `worker`, `reviewer`, `explorer`, `tester`, `writer` and `routine`.
- The effort is `null` or a native level of the assistant. Gemini and Grok accept only `null`. The [model catalog reference](../reference/model-catalog.md) lists the levels of each assistant.
- If the model is in the release catalog, the effort is a level of that model. A model that is not in the catalog can use any native level of the assistant. The assistant must still support it.
- A Gemini model is a native tier: `pro`, `flash`, `flash_lite` or `inherit`.
- A Kimi model is not `primary`.
- For Kimi, selected roles that use the same alias do not request different explicit efforts. [Roles](../reference/roles.md#how-effort-applies) gives the full Kimi effort rules.
- No selected role uses a model from `avoidModels` of the same assistant.

`avoidModels` is routing guidance in the APK instructions. It does not block a model in the assistant.

Some conditions can only be checked against the native files, for example missing Kimi aliases. APK reports them as prerequisites when you run setup. The [assistants reference](../reference/assistants.md) lists them.

## Check a preferences file

APK has no separate validation command. A preview checks the file and writes nothing:

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.4.0 agent-policy setup --policy ./preferences.json
```

If the file is not valid, the command fails with `INVALID_POLICY`. The file must be a regular file of at most 64 KiB, not a symbolic link.

## Apply a preferences file

Use one of these methods.

### First setup, or the same values again

1. Preview the setup:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.4.0 agent-policy setup --policy ./preferences.json
   ```

2. Apply it:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.4.0 agent-policy setup --policy ./preferences.json --apply
   ```

`--policy` is conservative. If APK already has a setup with other values, it stops with `INSTALLATION_CONFLICT` or `POLICY_CONFLICT`.

### Replace an earlier setup

To replace saved values with the values of a file, send the file as `--config`:

1. Encode the file as base64url:

   ```sh
   node -e 'process.stdout.write(Buffer.from(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")))).toString("base64url"))' ./preferences.json
   ```

2. Preview the setup with the encoded value:

   ```sh
   npx --yes --ignore-scripts --package agent-policy-kit@0.4.0 agent-policy setup --config ENCODED_VALUE
   ```

3. Run the same command with `--apply`.

The decoded JSON can be at most 64 KiB. For all input modes, see [Commands](commands.md#input-modes).

## Saved preferences

After a setup with `--apply`, APK saves the latest requested preferences as `policy.json` in the state directory. A setup without an input mode uses this file. This file is a request, not proof of what each assistant has. If one assistant failed, its receipt still records its earlier values. The [ownership reference](../reference/ownership.md) explains receipts and the state directory.

## Related documents

- [Commands](commands.md): all input modes and options.
- [Presets reference](../reference/presets.md): the values of the release presets.
- [Model catalog reference](../reference/model-catalog.md): known models and effort levels.
