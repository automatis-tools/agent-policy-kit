# Architecture

This document describes how Agent Policy Kit (APK) is built: its modules, how data moves from the preset files to the native files, and why one package version is one configuration release. It is for maintainers who change the code. For the files that APK writes per assistant, see [assistants](../reference/assistants.md). For receipts and transactions, see [ownership](../reference/ownership.md).

## Design rules

- APK runs only when a person or an agent starts a configuration command. It detects the installed command-line tools, reads the requested preferences, writes native files and exits.
- APK adds no hook, proxy, launcher, plugin, daemon, runtime audit or background updater. A native client never imports or starts APK.
- Generated native files contain no reference to the npm package, the source checkout or the APK state directory. They keep working after the package is removed.
- The role files and routing instructions apply only when the main agent decides to delegate. APK keeps the main model and does not enable a disabled subagent feature.

## One version is one configuration release

The `version` field in `package.json` identifies one configuration release. That release contains these items:

| Item | Source |
|---|---|
| Presets Light, Standard and Top-tier (ids `fast`, `balanced`, `quality`) | `policies/*.json`, labels and the top models switch in `src/release.mjs` |
| Model catalog snapshot | `models/catalog.json` |
| Role names, descriptions and prompts | `src/roles.mjs` |
| Native file templates and routing instructions | `src/native.mjs` |
| Preferences validation | `src/policy.mjs`, `schema/policy.schema.json` |
| Command codec | `src/explicit.mjs` |
| Release notes | `CHANGELOG.md` |
| Configuration page | `site/index.html`, generated from the items above |

There is no second version number for presets or for the catalog. A change to any of these items needs a new package version. [Release](release.md) explains why the host build enforces this rule.

## Modules

| Module | Responsibility |
|---|---|
| `bin/agent-policy.mjs` | Parses the command line, selects the input mode, writes temporary preferences for `--config` and explicit arguments, and prints JSON or readable text |
| `src/detect.mjs` | Finds each assistant's executable on `PATH`, at known locations and, on macOS, in the ChatGPT Desktop and Claude Desktop bundles. It confirms identity from `--version` and, for Kimi and Gemini, from `--help` |
| `src/policy.mjs` | Validates preferences: schema version, limits 1 to 32, selected roles, model identifiers, efforts that the catalog allows, avoid lists |
| `src/roles.mjs` | Defines the six roles. The page and native generation use the same definitions |
| `src/release.mjs` | Exposes the package version, the presets, the catalog and the release notes |
| `src/explicit.mjs` | Converts explicit tool arguments to preferences (CLI) and preferences to a command (page) |
| `src/share.mjs` | Encodes and decodes the page form state in the URL fragment |
| `src/native.mjs` | Renders role files and the instruction block for each assistant, and gives the native paths |
| `src/install.mjs` | Plans, applies, inspects and removes owned changes in transactions, and writes receipts |
| `src/toml.mjs` | Reads and edits TOML values through the one runtime dependency, `toml-eslint-parser` |
| `src/setup.mjs` | Runs detection, then plans and applies for each selected client in sequence, and collects per-client results |
| `src/inspect.mjs` | Reads current user-level subagent settings for `show`, without writes and without starting executables |
| `src/output.mjs` | Formats readable terminal output. Captured output stays JSON |

The CLI needs no compilation step. Only the configuration page is generated.

## Data flow for a setup command

1. `bin/agent-policy.mjs` accepts one input mode: explicit tool arguments, `--release` with an optional `--preset`, `--config`, or `--policy`. A combination of modes fails with `CONFLICTING_OPTIONS`.
2. The CLI converts the input to preferences and validates them with `validatePolicy`. Explicit arguments always contain a complete map of selected roles. The required `code` and `light` fields copy the first selected role, and the complete map overrides them.
3. `setupDetected` in `src/setup.mjs` detects the clients. Only clients that the preferences list are selected.
4. For each selected and detected client, `planInstall` builds a plan from the native templates. Without `--apply`, the plan is the result.
5. With `--apply`, `applyInstall` commits the plan in a transaction and writes the receipt. Plans and transactions run one client at a time, because one transaction can change shared state that the next plan reads.
6. The result has one entry per client. One client can fail while another succeeds.

The first selected role in catalog order supplies the native default subagent. An effort of `null` means no explicit pin. [Roles](../reference/roles.md) documents the per-assistant details.

## Data flow for the configuration page

1. `npm run build:site` runs `scripts/build-site.mjs`.
2. The script embeds the release data, the presets, the catalog, the role definitions, `src/explicit.mjs`, `src/share.mjs`, `site/base.css`, the font and the limit illustration into `site/template.html`.
3. The result is one self-contained file, `site/index.html`. It needs no backend and sends no request to compose a command.
4. The page always writes the full explicit command, also when a preset filled the form. The CLI validates the command again.

[Website](website.md) covers the page build and the hosted copy.

## Ownership in short

Receipt format v4 stores the selected roles, bounded ownership snapshots and the applied release, source and preset. Receipts are the applied truth. `policy.json` in the state directory is only the latest requested snapshot. A replacement virtually undoes the owned changes to the original user values, renders the target and commits against the current file contents. Removal restores the original user values and keeps unrelated later edits. [Ownership](../reference/ownership.md) is the canonical description.
