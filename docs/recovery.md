# Recovery

Do not remove a lock or pending journal merely to make configuration proceed. Another operation may own it, or a failed transaction may need its backups.

The installer stages changes and rechecks the complete read set. A failed commit restores matching postimages. A competing edit is preserved and yields a recovery conflict.

Private state contains pending.json, .install.lock and backups/TRANSACTION_ID/index.json. Keep the journal and backup index together. The retained lock ID can identify the index if recreating pending.json failed.

For recovery, ensure no configurator is active, make a private copy of affected files/state, compare current files with recorded preimages/postimages, and reconcile only owned changes. Preserve every later unrelated edit. Remove only the resolved transaction's blocking markers, then rerun a plan. Do not publish config bodies or backup indexes.

Owned file/block/scalar drift stops removal. Reconcile that exact change rather than restoring a stale whole-file backup. Unknown experimental runtime receipts require the older version's owned uninstall first; never delete arbitrary hooks based on their text.

Removing or moving the npm package after successful setup is safe. Native files have no package dependency. Reinstall or invoke the configurator with npx for future updates/removal. Preserve private receipts if owned removal is desired.
