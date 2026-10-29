# Architecture

APK runs only for configuration commands. It detects installed CLIs, reads release/custom preferences, writes native files and exits. Native agent operation never imports or launches APK.

One npm version is one configuration release. src/release.mjs exposes its presets, catalog date and notes. policies contains Fast/Balanced/Quality data; models/catalog.json is the dated native model/effort snapshot. The self-contained page is generated from that same version and data. No browser/backend/provider request is needed to compose a command.

src/policy.mjs validates code/light defaults and optional worker/reviewer/explorer/routine overrides. Native generation uses each effective role independently. Native defaults follow the effective worker. Effort null means no explicit pin; documented levels are model/client-dependent. Kimi aliases merge explicit effort and are resolved only to existing provisioned native entries when a preferred catalog alias is missing; ambiguity fails without writes.

The fixed native role filenames remain apk-worker/reviewer/explorer/routine. Their presence does not require delegation. The main agent decides whether helpers are useful; main models and disabled features are preserved.

Receipt v3 stores bounded fixed-path ownership snapshots and actual release/source/preset provenance. It verifies old hashes/blocks/typed operations without regenerating today's templates or reevaluating today's preference schema. Historical v2 native snapshots have unknown release provenance; unsupported layouts/runtime receipts are refused.

Explicit replacement virtually undoes owned changes to the original user baseline, renders the target, and commits final changes against actual current preimages. The existing transaction protects complete read dependencies, locks, staging, rollback and competing edits. Final uninstall restores original user values and keeps unrelated later edits. Receipts are applied truth; canonical policy is the latest requested snapshot. Per-client partial outcomes are explicit.

There is one TOML parser dependency and no CLI compilation. The static page's data injection is a deterministic release-preparation step. Generated native files have no package/source/state dependency; npm package removal does not remove saved native settings.
