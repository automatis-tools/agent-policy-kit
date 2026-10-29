# Architecture

A configuration command reads shared preferences, detects installed native CLIs, generates native settings, writes owned changes and exits. No package code runs during subsequent client operation.

src/policy.mjs validates preferences. src/detect.mjs performs bounded executable identity probes. The native generator/installer writes agent files, native scalar settings and one managed routing block in each client's global instructions. The CLI combines these operations and emits JSON.

The fixed roles are apk-worker/apk-reviewer for code and apk-explorer/apk-routine for light work. Their models and effort values are client-specific. Native clients load these files directly. Generated files contain no imports, commands or paths into the npm package or kit state.

The installer preserves unrelated JSON/TOML values and text outside its managed block. Its transaction captures the complete read set, rejects stale plans, holds a lock, stages writes, records private backups and commits atomic replacements. Rollback restores only matching postimages; a competing edit survives and requires recovery. Uninstall uses granular ownership instead of restoring stale whole files.

Receipts, shared preferences and backups matter only to future configuration/removal commands. After setup, package, source and state can be unavailable while native files remain usable. This independence is part of the tarball acceptance gate.

There is one parser dependency for safe TOML edits. There is no build step, proxy, hook, launcher, plugin, daemon or runtime audit subsystem.
