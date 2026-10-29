# Recovery

Do not delete a lock or pending journal merely to make a command proceed. Another process may own it, or a failed transaction may need its backups.

## Ordinary failure

The installer stages all writes and rechecks the complete read set. If a later write fails, it restores committed files whose contents still match its postimages. A competing writer's edit is preserved. The command reports an error; success is not inferred from partial files.

## Recovery required

Private state contains `pending.json`, `.install.lock`, and `backups/TRANSACTION_ID/index.json`. The journal, or the lock's transaction ID if journal recreation failed, identifies the backup index. Keep these together.

1. Stop the relevant client and ensure no kit installer is active.
2. Copy the affected settings and private kit state to a separate private archive.
3. Compare current files against the backup index's preimages/postimages. Preserve every competing edit.
4. Restore only the settings you can attribute to the failed transaction. Do not restore an entire old config over later changes.
5. Once the configuration is reconciled, remove only that transaction's blocking marker/lock and rerun a plan. Ask a maintainer for help with a redacted report if ownership is unclear.

Automatic force-unlock and blind whole-file restoration are deliberately not provided. Do not publish the backup index or configuration bodies; they can contain credentials.

## Ownership drift

An uninstall conflict means an owned entry/value changed. Review and remove or reconcile that exact entry, retaining unrelated settings. Repeated installation will not silently adopt altered ownership.

## Package relocation/removal

Uninstall integration before moving or uninstalling the npm package. If the package is already gone, restore it at the original stable prefix, inspect a plan, then uninstall normally. Native client hook crashes can fail open; a missing executable is not an enforcement guarantee.

Generated commands also reference the Node executable used during setup. If a runtime upgrade removes that path, use the current Node/installed CLI to uninstall and reinstall integrations. Run a plan after package/runtime upgrades; do not infer working hooks from a surviving receipt alone.
