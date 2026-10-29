# Installation

Use the [AI operator guide](../AGENT_INSTALL.md). The configurator can run from npx, a temporary npm prefix, a packed tarball or a checkout. Generated native files never depend on those locations.

setup/install are plan-only until --apply. Autodetection requires a working CLI identity; a config directory is not enough. A missing CLI receives no files. Existing main models, providers, credentials, permissions and unrelated hooks/plugins are preserved.

All clients receive namespaced apk-worker, apk-reviewer, apk-explorer and apk-routine roles plus a managed global instruction block. Existing conflicting files/blocks are not silently adopted. Native settings differ by client; see [support](compatibility.md).

Kimi needs its existing model aliases and supported effort metadata. Its pool defaults/hints and per-model effort overrides are configured without cloning provider credentials. A shared main-model alias with a conflicting effort default returns a zero-write prerequisite; use a separate compatible native alias. Claude force-model conflicts are reported rather than hidden.

After setup, doctor verifies owned native configuration; it does not run a model. Start a new native session if required. The npm package may be removed immediately afterward. Keep the private state for future owned removal, or reinstall the configurator later. No kit launcher is needed.

To remove native configuration, run uninstall, inspect the plan, then uninstall --apply. Receipts permit safe removal after a native executable or preferences file is gone. Drift and transaction conflicts preserve user data and require [reconciliation](recovery.md).
