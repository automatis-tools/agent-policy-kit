# Agent Policy Kit — AI operator guide

APK is configuration-only. Native files remain independent after npm package/source removal. There is no hook, proxy, launcher, plugin, daemon, runtime audit or background updater. Subagent preferences apply only if the main agent chooses to delegate; preserve ordinary direct work and disabled delegation features.

Perform authorized technical setup/removal yourself; do not hand the owner a shell checklist. Use JSON plans/results, preserve main models, credentials, permissions, unrelated settings and later edits. Never log in, collect credentials, accept terms, start model tasks, publish, weaken sandboxes or bypass trust to force installation success. Private backups can contain existing secrets; keep state private.

## 1. Select the requested release

Package version is configuration-release version. Read that version's CHANGELOG.md or release output for what changed, why and migration limits. Check the installed tool versions, actual provisioned model aliases and current official model/effort documentation before applying. Preserve explicit user choices; a newer package/model is not an instruction to switch silently. See [model maintenance](docs/model-updates.md) and the dated [model catalog/presets](docs/model-catalog.md).

After publication, pinned invocation is supported:

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.1.0 agent-policy release
npx --yes --ignore-scripts --package agent-policy-kit@0.1.0 agent-policy setup --release
```

Before publication, replace the registry spec with the verified local .tgz. For several commands, install to a temporary or user-owned prefix with npm install --prefix PREFIX TARBALL --ignore-scripts --no-audit --no-fund, then invoke PREFIX/node_modules/.bin/agent-policy. No stable runtime prefix, sudo or shell-profile changes are needed.

## 2. Choose the input

- setup --release --preset balanced explicitly applies this executable's named preset and templates (fast/quality are alternatives). It is the supported pinned-release upgrade/downgrade path.
- setup --config BASE64URL explicitly applies custom choices through this version's templates. The configuration page generates this command. Decode/inspect the JSON; it must contain preferences only, never credentials or executable content.
- init --policy FILE creates editable defaults without overwriting. setup --policy FILE is a conservative advanced workflow; ordinary mismatching setup refuses replacement. To deliberately replace saved choices from a file, validate it, encode its JSON with Buffer.from(JSON.stringify(preferences)).toString('base64url'), and use --config.

--release, --config and --policy are mutually exclusive. The --config JSON is canonical unpadded base64url, at most 64 KiB decoded, and validated before any target mutation. Its temporary input file is removed after the command. Optional client roles override code/light recommendations independently. Use model-supported native effort levels; null means no explicit pin. A known catalog model rejects unsupported explicit effort. Keep at most one non-null pin per effective Kimi alias. Preset identity and custom source are reported separately. Other tools omitted from preferences are not selected.

Run detect and inspect the setup plan. Working executable identity is required; stale directories are not presence. Automatic targets use standard native roots. Nondefault CODEX_HOME/CLAUDE_CONFIG_DIR/KIMI_CODE_HOME returns a per-client zero-write prerequisite rather than configuring a dormant folder. Explicit --home selects the standard layout under that intended base; preserve exact --home/--state-dir for later inspection/removal. It does not remap arbitrary native roots.

## 3. Apply the concrete reviewed plan

Already-authorized configuration needs no repeat confirmation. Add --apply to the same selected-release or custom-config command. APK updates existing owned files transactionally without an uninstall gap. It verifies old ownership, virtually restores the original user baseline, then commits the target files/receipt/requested snapshot. Drift or a native prerequisite leaves the existing release intact; a late failure rolls it back. Preserve unrelated edits.

Run doctor afterward. It reports each client's actual saved release/source independently of the current executable, bundle, external source or canonical preferences. A verified config is not model execution proof. Native clients may need a fresh session to load changes; do not terminate active user sessions automatically.

Per-client transactions are independent. A missing/blocked client can retain an older applied release while another advances. Read all results; never label a partial outcome fully updated. stateDir/policy.json is the latest requested snapshot, not the applied truth. Receipts are the applied truth. Canonical preferences may therefore differ from an older client's snapshot. Ordinary saved-file setup still detects unsafe mismatch; --release/--config are deliberate replacement operations.

Kimi needs provisioned aliases/provider metadata and supported effort; do not invent them. If a selected alias also serves the main model, a changed effort default without a valid explicit global override returns kimi-main-effort-conflict. Use a compatible separate native alias or deliberately prepare a native variant while preserving main behavior. Reserved primary cannot be a pool key. Claude force-model conflicts require an explicit native setting decision rather than a false per-role success.

Generated roles are apk-worker/apk-reviewer/apk-explorer/apk-routine. Only when delegation is chosen do the model/effort/routing/parallelism preferences apply. No native file may execute/import the package or refer to its executable/npm/source/state path for normal operation. After verification you may remove the npm package; keep private receipts for future owned undo.

## 4. Native limits

Codex/Claude have native defaults/caps with higher-priority setting and execution-path exceptions. Kimi role-to-pool selection and concurrency are guidance. Antigravity uses native Pro/Flash/Flash Lite/inherit tiers, with no documented per-role effort or universal hard cap. avoidModels is guidance. A pinned configuration does not prove provider identity, entitlement, task quality or unchanged alias resolution. Never add a runtime gate to strengthen a missing native feature.

## 5. Removal and incompatible formats

Run uninstall, review it, then uninstall --apply. Receipts verify ownership without canonical/source preferences or the native executable. Final removal restores original user settings, including after supported release changes, and keeps unrelated later edits. Do not restore stale whole-file backups or force-delete locks/pending journals.

Current native receipt v3 supports the four fixed role filenames and bounded native operations. Historical native v2 snapshots have unknown release provenance but can be inspected/removed within that boundary. Unknown future formats/layouts fail safely and require a documented compatible migration. Experimental runtime v1 receipts need their original owned uninstall first; never delete arbitrary hooks by matching text.

Return concise per-client detected/configured/applied-release/source results, prerequisites, new-session needs and unchecked model/provider evidence. No public release, deployment or live model task is part of configuration acceptance.
