# Keeping model choices current

The task roles stay stable: worker for implementation, reviewer for findings, explorer for discovery, tester for tests, writer for documentation and routine for prescribed execution. Models and effort values are separate data in policies and models/catalog.json and can evolve without changing those responsibilities.

Named presets and the dated model/effort catalog follow the npm package version. Record model-choice changes and their review date/sources in CHANGELOG.md when releasing a revised preset. Version 0.1.0 is a starting example, not a live ranking or a benchmark of model quality. Native format checks are recorded in [verification](verification.md).

## Before setup or an authorized update

The installing AI agent should:

1. Read the saved preferences and installed client versions. Preserve explicit user choices.
2. Cross-check the provider's current dedicated model docs with native catalogs or schemas. Older official help pages can lag: Kimi's old help page omitted K3.1 Pro while its current Code Docs and provisioned metadata included it. Keep API capabilities separate from native choices; aliases and session modes are not additional versioned models. Check provisioned aliases without printing credentials.
3. Compare proposed choices with the saved setup. A newer model is not automatically better for every task, account or usage constraint.
4. Apply requested changes through the coordinated [preferences update procedure](../AGENT_INSTALL.md). Package installation alone must not rewrite native settings.

No background updater, live model catalog request, or automatic model replacement runs during normal client use. Existing configured values stay saved until another configuration operation changes them.

Provider aliases can still resolve to a newer model independently of APK. For example, Claude documents that its [model aliases update over time](https://code.claude.com/docs/en/model-config#model-aliases). Use available versioned identifiers where reproducibility matters and the client/provider supports them. A configured identifier remains distinct from proof of the actual provider model.

## Maintainer release check

Update the preset data, source/date notes and configuration fixtures together. Recheck native schemas, preserve main-session behavior, and run unit plus packed-package acceptance. Do not present configuration tests as model-quality evaluations. All preferences continue to apply only when the main agent chooses to delegate.
