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

The page always prints explicit arguments, including when a preset filled the form:

```sh
agent-policy setup \
  --roles reviewer,explorer \
  --max-concurrent 3 \
  --codex 'reviewer=gpt-6.1-sol:high,explorer=gpt-6-luna:high' \
  --avoid-codex 'gpt-6-astra' \
  --claude 'reviewer=sonnet:high,explorer=haiku:high' \
  --avoid-claude 'opus,fable' \
  --apply
```

Use --codex, --claude, --kimi and/or --antigravity to select tools. Each tool must list every selected role exactly once. --roles and --max-concurrent are required in this mode. :native means effort null. Antigravity accepts role=tier without an effort. Split the model/effort pair at its last colon. Keep the visible shell quotes and line continuations. The optional --avoid-TOOL lists preserve routing guidance. An omitted list is empty.

Explicit arguments are setup/install-only and cannot combine with --client, --release, --preset, --policy or --config. Duplicate flags and incomplete role maps fail before writes. Omit --apply to plan first. Explicit commands allow deliberate owned replacement and record custom source with no named preset provenance. The native files do not retain a dependency on the codec or package.

Other supported inputs remain available:

- setup --release --preset balanced explicitly applies this executable's named preset and templates (fast/quality are alternatives). It is the supported pinned-release upgrade/downgrade path.
- setup --config BASE64URL explicitly applies custom choices through this version's templates. This legacy encoded input remains supported. Decode/inspect the JSON; it must contain preferences only, never credentials or executable content.
- init --policy FILE creates editable defaults without overwriting. setup --policy FILE is a conservative advanced workflow; ordinary mismatching setup refuses replacement. To deliberately replace saved choices from a file, validate it, encode its JSON with Buffer.from(JSON.stringify(preferences)).toString('base64url'), and use --config.

Explicit arguments, --release/--preset, --config and --policy are alternative input modes. The --config JSON is canonical unpadded base64url, at most 64 KiB decoded. APK validates it before target mutation and removes its temporary input file afterward.

Optional top-level selectedRoles selects worker, reviewer, explorer and/or routine. It must be nonempty and contain no duplicates. Omit it to configure all four roles. Optional client roles overrides the selected roles' code/light recommendations. A selected subset creates only those native files and routing instructions. Unselected aliases do not require provisioning or receive effort pins. The first selected role in catalog order supplies the native subagent default.

Use model-supported native effort levels. null means no explicit pin. A known catalog model rejects unsupported explicit effort. Keep at most one non-null pin per selected Kimi alias. Preset identity and custom source are reported separately. Tools omitted from clients are not selected.

Run detect and inspect the setup plan. Working executable identity is required; stale directories are not presence. Automatic targets use standard native roots. Nondefault CODEX_HOME/CLAUDE_CONFIG_DIR/KIMI_CODE_HOME returns a per-client zero-write prerequisite rather than configuring a dormant folder. Explicit --home selects the standard layout under that intended base; preserve exact --home/--state-dir for later inspection/removal. It does not remap arbitrary native roots.

## 3. Apply the concrete reviewed plan

Already-authorized configuration needs no repeat confirmation. Add --apply to the same selected-release or custom-config command. APK updates existing owned files transactionally without an uninstall gap. It verifies old ownership, virtually restores the original user baseline, then commits the target files/receipt/requested snapshot. Drift or a native prerequisite leaves the existing release intact; a late failure rolls it back. Preserve unrelated edits.

Run doctor afterward. It reports each client's actual saved release/source independently of the current executable, bundle, external source or canonical preferences. A verified config is not model execution proof. Native clients may need a fresh session to load changes; do not terminate active user sessions automatically.

Per-client transactions are independent. A missing/blocked client can retain an older applied release while another advances. Read all results; never label a partial outcome fully updated. stateDir/policy.json is the latest requested snapshot, not the applied truth. Receipts are the applied truth. Canonical preferences may therefore differ from an older client's snapshot. Ordinary saved-file setup still detects unsafe mismatch. Explicit tool arguments and --release/--config are deliberate replacement operations.

Kimi needs provisioned aliases/provider metadata and supported effort; do not invent them. K3.1 Pro variants require thinking: explicit native thinking.enabled=false returns a prerequisite even if every requested effort is null. Do not change the main thinking setting to force helper installation. If a selected alias also serves the main model, a changed effort default without a valid explicit global override returns kimi-main-effort-conflict. Use a compatible separate native alias or deliberately prepare a native variant while preserving main behavior. Reserved primary cannot be a pool key. Claude force-model conflicts require an explicit native setting decision rather than a false per-role success.

The available role names are apk-worker/apk-reviewer/apk-explorer/apk-routine. APK creates only the selected names. Changing the selected role set through explicit arguments or --config safely replaces the earlier owned role set. APK preserves unowned files and refuses removal of edited owned roles. Only when delegation is chosen do model/effort/routing/parallelism preferences apply. Native files must not execute/import the package or depend on its executable/npm/source/state path. After verification you may remove the npm package. Keep private receipts for future owned undo.

## 4. Native limits

Codex/Claude have native defaults/caps with higher-priority setting and execution-path exceptions. Kimi role-to-pool selection and concurrency are guidance. Antigravity uses native Pro/Flash/Flash Lite/inherit tiers, with no documented per-role effort or universal hard cap. avoidModels is guidance. A pinned configuration does not prove provider identity, entitlement, task quality or unchanged alias resolution. Never add a runtime gate to strengthen a missing native feature.

## 5. Removal and incompatible formats

Run uninstall, review it, then uninstall --apply. Receipts verify ownership without canonical/source preferences or the native executable. Final removal restores original user settings, including after supported release changes, and keeps unrelated later edits. Do not restore stale whole-file backups or force-delete locks/pending journals.

Current native receipt v4 records selectedRoles and their bounded fixed filenames. It verifies that the owned file set matches the role selection. Historical v3 and v2 native receipts remain inspectable and removable. v2 has unknown release provenance. Older executables can reject v4. Use an executable that supports the receipt before an incompatible downgrade. Unknown formats/layouts fail safely and require a documented compatible migration. Experimental runtime v1 receipts need their original owned uninstall first. Never delete arbitrary hooks by matching text.

Return concise per-client detected/configured/applied-release/source results, prerequisites, new-session needs and unchecked model/provider evidence. No public release, deployment or live model task is part of configuration acceptance.
