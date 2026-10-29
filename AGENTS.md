# Contributor instructions

- Use Node.js 22 or newer. Keep policy evaluation independent of I/O and external classifiers.
- Run the package acceptance gate as well as unit tests before completion.
- Never put account data, credentials, user paths, raw transcripts or local audit logs in tracked files or npm packages.
- Preserve unrelated user settings. Default installer behavior is plan-only. Applying changes requires --apply. Uninstall must detect user drift.
- Do not claim requested models are actual provider models. Record the observation source and uncertainty.
- Separate package, client trust/load, and model/runtime validation results.
- This is a local-only repository. The user will create GitHub; do not create remotes or publish packages.
- Never merge branches or mark draft pull requests ready.
