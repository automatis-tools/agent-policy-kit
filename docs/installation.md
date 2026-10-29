# Installation

Use the [AI operator guide](../AGENT_INSTALL.md). The configurator can run from npx, a temporary npm prefix, a packed tarball or a checkout. Generated native files never depend on those locations.

setup/install are plan-only until --apply. Autodetection requires a working CLI identity; a config directory is not enough. A missing CLI receives no files. Existing main models, providers, credentials, permissions and unrelated hooks/plugins are preserved.

Automatic placement supports standard native profiles. A non-default CODEX_HOME, CLAUDE_CONFIG_DIR, or KIMI_CODE_HOME produces a zero-write per-client prerequisite; doctor reports attention rather than verifying the dormant standard profile. Environment paths resolving to the standard root work normally. Explicit --home means an intentional target using the standard native layout under that home; it bypasses the environment-root comparison without adding custom native-root placement.

All clients receive namespaced apk-worker, apk-reviewer, apk-explorer and apk-routine roles plus a managed global instruction block. Existing conflicting files/blocks are not silently adopted. Native settings differ by client; see [support](compatibility.md).

Kimi needs its existing model aliases and supported effort metadata. Its pool defaults/hints and per-model effort overrides are configured without cloning provider credentials. A shared main-model alias with a conflicting effort default returns a zero-write prerequisite; use a separate compatible native alias. Claude force-model conflicts are reported rather than hidden.

After setup, doctor verifies owned native configuration for the supported target profile; it does not run a model. Retain installation --home and --state-dir arguments for doctor and removal, and use the same external --policy file for setup and doctor. Start a new native session if required. The npm package may be removed immediately afterward. Keep the private state for future owned removal, or reinstall the configurator later. No kit launcher is needed.

To remove native configuration, run uninstall, inspect the plan, then uninstall --apply. Receipts permit safe removal after a native executable or preferences file is gone. Drift and transaction conflicts preserve user data and require [reconciliation](recovery.md).

The canonical shared preferences are stateDir/policy.json, retained after uninstall. An external --policy source must match it semantically. To change preferences, remove all receipts using that shared policy, confirm no pending transaction or active lock, validate and update the canonical file and any external source together, then reinstall and check with the same --policy. The [AI guide](../AGENT_INSTALL.md#5-update-or-remove-configuration) gives the coordinated sequence. Editing only an external file after uninstall still conflicts; preserve this safety check and the private backups.
