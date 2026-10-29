# Contributing

Read [development](docs/development.md) and [native limits](docs/compatibility.md). Keep this a one-shot configurator with native files only. Add no custom runtime.

For behavior changes, add a failing regression, make the smallest fix, and run unit plus packed-tarball acceptance. Test temporary homes and preserve unrelated settings. Native configuration must remain independent after npm/source/state removal.

Do not publish private configs, credentials, backups or raw logs. Keep the human README short and the AI operator guide precise. Report configuration/parser evidence separately from actual native/provider execution.
