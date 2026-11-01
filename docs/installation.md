# Configuration commands

Follow the [AI operator guide](../AGENT_INSTALL.md). npx, a temporary prefix or an installed tarball can run this one-shot configurator. Native files never depend on those locations afterward.

Use setup --release --preset balanced to preview a version's default choices; add --apply to configure. Fast and Quality are alternative named presets. The [page](../site/index.html) generates explicit role, model, effort and concurrency arguments. Commands are pinned to that page's APK version.

Interactive terminals show readable results. Captured output remains JSON, and --json always requests JSON. A preview writes nothing. A repeated application reports unchanged clients. Partial results identify the clients that need attention.

Run `agent-policy show` to read current user-level native subagent settings before or after APK setup. Add `--client codex` for one tool or `--json` for machine output. It needs neither client executables nor APK receipts. Relevant native-home environment variables select the active user profile. An explicit --home selects standard client directories under that home. The command never changes files or calls a model.

Show reads Codex TOML roles, Claude/Antigravity Markdown role fields, and Kimi's native secondary-model pool. Kimi APK role mappings and APK concurrency instructions are labeled as guidance. Missing pins stay unspecified. Supported Markdown fields use plain, single-quoted or JSON-compatible double-quoted scalar values. Unsupported role syntax, unsafe files and incomplete reads produce explicit attention statuses and exit code 3. External role-file references, project/managed settings, plugins and session overrides are not resolved. Show displays supported current values even when APK-managed files have local edits. It does not print prompts, credentials, raw configuration or private paths.

Only genuine detected and selected clients receive files. A standard native profile is required for automatic setup; nondefault native-home environment roots get a zero-write prerequisite. Explicit --home selects the standard layout under an intentional target. Preserve original --home/--state-dir for later removal.

Named APK roles and a managed global instruction block configure optional delegation. Main models, credentials, permissions, disabled agent features and unrelated hooks/plugins/settings are preserved. Native capabilities still differ; see [support](compatibility.md).

Kimi requires provisioned model entries. A missing preferred catalog alias may resolve once to one unambiguous existing alias for the documented upstream model. No aliases/providers/credentials are invented. Actual alias effort capability and main-session behavior are checked before writes. Native model access is not granted by a dropdown.

Explicit release/custom replacement has no physical uninstall gap. Old ownership is verified, desired files are rendered over the original user baseline, and rollback protects the installed release. Doctor inspects actual applied version/source/preset without needing current presets or canonical preferences.

After success the npm package can be removed. Native clients may need fresh sessions; no kit launcher is needed. Reinvoke a compatible APK for owned uninstall. Keep private receipts/backups if future removal is desired. [Recovery](recovery.md) handles drift or interrupted transactions without overwriting later user edits.

The configuration page keeps per-tool limits in individual tool details. Fast starts at 2, Balanced at 3 and Quality at 2. A manual limit marks only that tool Custom. Explicit commands can use --TOOL-max-concurrent overrides alongside the shared --max-concurrent fallback. Preset selection restores its cap as well as its models and effort.
