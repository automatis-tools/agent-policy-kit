# Ownership and state

This document describes how APK records the settings that it writes, how it detects changes to them and how it applies and rolls back a change safely. It covers the state directory, the receipt formats v2, v3, v4 and v5, transactions, drift and rollback. It is for advanced users and maintainers who need to know exactly what APK owns.

For the steps to update, remove or recover a setup, see [Updates and removal](../guide/updates-and-removal.md). For the files that APK writes in each assistant, see [AI assistants](assistants.md#files-written).

## Glossary

| Term | Meaning |
|---|---|
| Owned setting | A file, an instruction block or a single value that APK wrote and recorded in a receipt. APK changes or removes only owned settings. |
| Receipt | The record of the owned settings of one assistant. It is the file `installations/<assistant>.json` in the state directory. The receipt is the applied truth. |
| Drift | A change to an owned setting after APK wrote it. For example, a person edits an `apk-*` role file. APK refuses to change or remove a setting that has drift. |
| Applied release | The APK version, source and preset that a receipt records for one assistant. Each assistant has its own applied release. |
| Requested snapshot | The file `policy.json` in the state directory. It holds the preferences of the latest setup request. It is not proof that each assistant applied them. |
| Transaction | One apply operation for one assistant. It changes all files of the plan or, after a failure, restores them. |
| Source | Where the applied preferences came from: `release` (a preset of the release), `custom` (explicit arguments, `--config` or `--policy`) or `saved` (the requested snapshot in the state directory). |

## State directory

The state directory holds receipts, the requested snapshot and transaction data. It is private: directories have the mode `0700` and files the mode `0600`.

APK selects the state directory in this order:

1. `--state-dir PATH`
2. The environment variable `AGENT_POLICY_HOME`
3. `.agent-policy-kit` in the home folder: the `--home` folder when it is given, otherwise your home folder

The path must be absolute. It must not be the home folder or contain the home folder. Use the same `--home` and `--state-dir` values for later inspection and removal, because each receipt records both paths.

| Path | Content | Lifetime |
|---|---|---|
| `installations/<assistant>.json` | The receipt of one assistant | Removed by a successful uninstall |
| `policy.json` | The requested snapshot | Kept after uninstall |
| `.install.lock` | The ID of the running transaction | Removed after the transaction, kept after a failure that needs recovery |
| `pending.json` | The journal of the running transaction | Removed after the transaction, kept after a failure that needs recovery |
| `backups/<transaction-id>/index.json` | A copy of the journal | Kept |
| `backups/<transaction-id>/<n>.before` | The content of each changed file before the transaction | Kept |

Backups can contain existing secrets from native configuration files. Keep the state directory private. Do not publish receipts, journals or backups.

## Receipts

A receipt records, for one assistant:

- The format version (`schemaVersion`) and the kind `native-config`.
- The assistant, the home folder and the state directory.
- A SHA-256 hash of the applied preferences (`policyHash`).
- The warning codes of the setup.
- The applied release: `releaseVersion`, `source` and, for a named preset, `preset`.
- The selected roles (v4 and v5).
- One entry for each owned file.

Each file entry records only what APK owns in that file:

| Entry type | Used for | What APK records |
|---|---|---|
| `role` | `apk-<role>` role files | The SHA-256 hash of the content that APK wrote. A role file never existed before APK. |
| `instructions` | The global instruction file | The exact block between the markers and the line breaks that APK added before it. |
| `json` | Claude `settings.json` | Each owned `env` value: its key, whether it existed, its old value and its new value. Also whether APK created the `env` object. In v5, the same record for the top-level `autoCompactWindow`. |
| `toml` | `config.toml` of ChatGPT, Kimi and Grok | Each owned value: its key path, its old value and its new value. Whether APK added the table of the value (`addedTable`). Since 0.5.2, when APK added a line break at the end of a file that did not end with one, a SHA-256 hash of that last line (`addedLineBreak`); the receipt keeps no config text. For Kimi, also a value that APK removed. |

### Receipt formats

APK writes format v4, or format v5 for a Claude setup that uses `--claude-auto-compact`. Versions after 0.5.2 can read, check and remove v2, v3, v4 and v5. Versions 0.4.0 to 0.5.2 read v2, v3 and v4.

| Format | Written by | Roles it can own | Release fields |
|---|---|---|---|
| v5 | Versions after 0.5.2, only for a Claude setup that uses `--claude-auto-compact` | The selected subset of all six roles (`selectedRoles`) | `releaseVersion`, `source`, `preset` |
| v4 | All releases from 0.1.0, including 0.4.0 | The selected subset of all six roles (`selectedRoles`) | `releaseVersion`, `source`, `preset` |
| v3 | Development versions before 0.1.0 | The four original roles: Coder, Reviewer, Code explorer, Task runner | `releaseVersion`, `source`, `preset` |
| v2 | Development versions before 0.1.0 | The four original roles | None. The applied release is reported as unknown. |

- A v4 receipt must list exactly the files of its selected roles, plus the instruction file and, if the assistant has one, the configuration file.
- Grok receipts exist only in v4.
- A Claude v4 receipt owns two or three `env` values. The third, `CLAUDE_CODE_SUBAGENT_EFFORT`, is new in 0.4.0. It is present only when the effort of the first selected role is pinned. Receipts from 0.3.0 without it stay valid.
- An older APK version can reject a v4 receipt that a newer version wrote. For example, APK 0.3.0 accepts only two owned `env` values in a Claude receipt, so it stops with `INVALID_RECEIPT` on a 0.4.0 Claude receipt that owns `CLAUDE_CODE_SUBAGENT_EFFORT`. Use a version that supports the receipt before you downgrade. For example, remove the Claude settings with 0.4.0 and then run setup with 0.3.0. [Migration boundaries](../guide/updates-and-removal.md#migration-boundaries) lists the known cases.
- A v5 receipt is a Claude v4 receipt with one more owned value at the end: `autoCompactWindow`, an integer, with its old value. Every other setup stays v4. A replacing setup without the option writes v4 again and removes or restores the key.
- APK 0.5.2 and earlier refuse a v5 receipt. `doctor` reports `attention` with `INVALID_RECEIPT`, and `uninstall` exits with code 3. Both change nothing. Remove or replace such a setup with a version that reads v5. [Migration boundaries](../guide/updates-and-removal.md#migration-boundaries) gives the steps.
- The requested snapshot `policy.json` keeps `autoCompactWindow` after a setup with the option, and also after removal. APK 0.5.2 and earlier refuse that file, so `setup` with no preferences input stops with `INVALID_POLICY` until you give it `--release`, `--preset`, `--policy`, `--config` or explicit arguments.
- A `toml` value has `addedLineBreak` only when `config.toml` did not end with a line break before setup. APK 0.5.1 and earlier stop with `INVALID_RECEIPT` on such a receipt.

APK refuses these receipts:

- A receipt with an unknown format or layout stops with `INVALID_RECEIPT`.
- An experimental runtime receipt (format v1, or one that records hooks or a package path) stops with `LEGACY_RUNTIME_RECEIPT`. Remove it with the version that created it. Never delete hooks only because their text looks familiar.
- Receipts are stored under the assistant id. Releases 0.3.0 and later do not read receipts under the old ids `codex` and `agy`. See the 0.3.0 entry in the [changelog](../../CHANGELOG.md).

APK checks a receipt against its recorded hashes, blocks and values. It does not need the current templates, the current catalog or the requested snapshot to check or remove it.

## Drift

APK checks for drift each time it reads a receipt: in `doctor`, in an update and in `uninstall`. For every entry type, a missing file is drift.

| Entry type | Drift means |
|---|---|
| `role` | The hash of the file differs from the recorded hash. |
| `instructions` | The file does not contain each marker exactly once, or the recorded block is not in the file unchanged. |
| `json` | An owned value differs from the value that APK wrote. |
| `toml` | An owned value differs from the value that APK wrote. |

Drift stops the operation with `OWNED_DRIFT`. APK writes nothing. In `doctor`, the assistant gets the status `attention` with the reason.

Edits outside the owned settings are not drift. APK keeps them in every update and in removal.

## Plans and read dependencies

Each setup and uninstall first makes a plan. The plan lists every file that it read, with the SHA-256 hash and mode of the content. These are the read dependencies. The apply step checks them again before and during the transaction. If another process changed one of them, the apply stops with `STALE_PLAN`. Make a new plan.

APK reads only regular files of at most 1 MiB. It refuses symbolic links in the path (`UNSAFE_PATH`) and other file types or larger files (`UNSAFE_FILE`).

## Transactions

A transaction applies one plan for one assistant. The transactions of different assistants are independent. One assistant can therefore advance to a new release while another keeps its applied release.

The apply step does these steps in this order:

1. It creates `.install.lock` exclusively and writes a new transaction ID into it. If the lock exists, the apply stops with `INSTALL_LOCKED`.
2. It checks that no `pending.json` exists, and checks the read dependencies again.
3. For each changed file, it writes the old content to `backups/<transaction-id>/<n>.before`. It writes the new content to a temporary file, `.agent-policy-<transaction-id>-<n>.tmp`, in the folder of the target file.
4. It writes the journal to `backups/<transaction-id>/index.json` and then to `pending.json`. The journal lists each changed file with its old hash, new hash, old mode and backup name.
5. For each file, it checks the read dependencies again and then moves the temporary file over the target, or deletes the target.
6. It deletes `pending.json`, removes the temporary files and removes the lock.

APK syncs each written file and its folder to storage before the next step.

### Rollback

If a step fails after the journal exists, APK keeps the lock and makes sure that `pending.json` exists. It then restores each file that it already changed, in reverse order:

- If the file still has the content that APK wrote, APK restores the old content.
- If the file has other content, APK keeps it. Another process changed it, and APK does not overwrite that change.

If all files were restored, APK removes `pending.json` and the lock. The apply stops with `INSTALL_FAILED`, or with the more specific code `STALE_PLAN`, `RECOVERY_REQUIRED`, `UNSAFE_PATH` or `UNSAFE_FILE`. The previous applied release stays in place.

If APK could not restore a file, the apply stops with `ROLLBACK_CONFLICT`. APK keeps `pending.json` and the lock for recovery.

### Recovery required

Every operation first checks for an unfinished transaction. It stops with `RECOVERY_REQUIRED` when one of these conditions is true:

- `pending.json` exists.
- `.install.lock` contains a transaction ID, and `backups/<transaction-id>/index.json` exists.

The lock ID can find the backup index when APK could not create `pending.json` again. Do not delete the lock or the journal only to let setup continue. Another operation can own them, and a failed transaction can need its backups. For the recovery steps, see [Updates and removal](../guide/updates-and-removal.md).

## Updates

An update replaces the owned settings of one release with those of another. It has no gap in which the assistant has no configuration:

1. APK checks the old receipt for drift.
2. In memory, it removes the owned settings to get the original user baseline.
3. It renders the target settings over that baseline.
4. It commits one final change for each file, against the actual current content.

The role files of roles that the new selection removes are deleted in the same transaction.

Only an explicit input can replace an existing installation: `--release` or `--preset`, `--config`, or explicit assistant arguments. Without one of these inputs:

- If the receipt has the same preferences hash, a preview reports `planned` with no files, and `--apply` reports `unchanged`. If the requested snapshot no longer matches these preferences, setup stops with `OWNED_DRIFT`.
- If the hash differs, setup stops with `INSTALLATION_CONFLICT`.
- If no receipt exists but the requested snapshot differs from the new preferences, setup stops with `POLICY_CONFLICT`.

A prerequisite or drift leaves the applied release unchanged. A late failure rolls back to it. The setup result reports, for each assistant, the target, previous and applied release, source and preset.

## Removal

`uninstall` restores the original user values from the receipt:

- It deletes the owned role files.
- It removes the owned instruction block and the line breaks that APK added. It deletes the instruction file if APK created it and the file is then empty.
- It restores each owned value to its old value, or removes it if it did not exist. It deletes a configuration file if APK created it and the file is then empty.
- When a table that APK added to `config.toml` has no values left, it removes the table header and the empty line that APK wrote before the header. It also removes a line break that APK added at the end of the file, if no lines follow. A `config.toml` then has its original bytes again, also after several updates (since 0.5.2, #34).
- It deletes the receipt.

Removal restores the values from before the first APK setup, also after several updates. It keeps later edits that are not owned. It keeps `policy.json` and the backups. Without `--client`, `uninstall` processes each assistant that has a receipt.

The native files do not depend on the npm package. You can remove the package after setup. To remove the APK settings later, run a compatible APK version again with the same `--home` and `--state-dir`. For the commands, see [Commands](../guide/commands.md).

## Related documents

- [Architecture](../maintainers/architecture.md): the modules that implement these rules.
- [AI operator guide](../../AGENT_INSTALL.md): the guide for an agent that applies or removes APK.
