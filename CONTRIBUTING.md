# Contributing

Read [development](docs/development.md) and [capabilities](docs/compatibility.md). Keep changes small enough to audit. Prefer existing native client features to new infrastructure.

For a behavior change, add a regression that fails first, make the smallest fix, and run the relevant checks plus the package gate. Report package, native-load and model-runtime evidence separately.

Use temporary profiles. Never attach account configuration, backups, prompts or raw logs. Update the AI operator guide when install/removal behavior changes. Keep the human README short and visual.
