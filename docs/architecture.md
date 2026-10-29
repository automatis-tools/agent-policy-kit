# Architecture

The pure evaluator validates the versioned JSON policy and chooses a known profile. It returns `allow`, `rewrite`, `deny`, or `unsupported`; it never invokes a model or receives account credentials. Known roles take their profile. Otherwise an explicitly allowed model selects a profile; an unpinned task takes the configured default. Unknown models and unsupported effort levels are denied.

Native adapters translate decisions to each client's protocol. Codex and classic Claude support `updatedInput`. Kimi's adapter returns a denial with the required alias rather than pretending it can rewrite parameters. agy does not receive an exact-model gate.

The CLI performs supported native-binding checks before approving Codex roles and Kimi aliases. Codex checks standard global/workspace role files. Kimi checks the global secondary pool, upstream model and effective per-entry effort. Relevant project-local overrides that cannot be resolved safely are unsupported. These checks do not verify an opaque provider's internal routing.

The installer reads shared settings through JSON/TOML parsers and applies localized changes. It captures its complete read dependency set, not just files that will change. Application rechecks preimages, takes an exclusive lock, stages writes, records a private journal, and commits atomic replacements. A failed commit restores matching postimages. A competing edit is preserved and forces explicit recovery.

Ownership receipts identify exact inserted hooks and scalar settings. Uninstall uses current settings plus that receipt; it does not restore an obsolete whole-file backup over unrelated edits. Nested additions under an owned Kimi hook are ownership drift.

CLI audit uses one private JSONL file without session or agent identifiers. The optional Claude mod uses the host's bounded native store and has a separate export command. Both distinguish a requested model from a client report. Neither turns a selected model into provider-verified evidence.

The root directory is also the Claude plugin root. Its mod imports only pure relative modules inside that root. Installer-only TOML dependencies are not loaded by the pure evaluator or mod.
