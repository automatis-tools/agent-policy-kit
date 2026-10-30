# Architecture

APK runs only for configuration commands. It detects installed CLIs, reads release/custom preferences, writes native files and exits. Native agent operation never imports or launches APK.

One npm version is one configuration release. src/release.mjs exposes its presets, catalog date and notes. policies contains Fast/Balanced/Quality data; models/catalog.json is the dated native model/effort snapshot. The self-contained page is generated from that same version and data. src/explicit.mjs supplies the pure command codec to Node and is embedded in the page at build time. Commands always expand selected role values, even for presets. The CLI converts complete maps to normal validated policy. Required code/light fallbacks copy the first explicit role and are unused by the complete per-role map. No browser/backend/provider request is needed to compose a command.

src/roles.mjs supplies the shared role descriptions/prompts for the page and native generation. src/policy.mjs validates code/light defaults, optional selectedRoles and per-client role overrides. Native generation uses selected roles only. The first selected role in catalog order supplies the native subagent default. Effort null means no explicit pin. Documented levels depend on model and client. Selected Kimi aliases merge explicit effort and resolve only to provisioned entries. Ambiguity fails without writes.

The fixed native role filenames remain apk-worker/reviewer/explorer/routine. Their presence does not require delegation. The main agent decides whether helpers are useful; main models and disabled features are preserved.

Receipt v4 stores the selected role set, bounded ownership snapshots and actual release/source/preset provenance. It verifies that the owned file set matches selectedRoles. Inspection/removal checks old hashes, blocks and typed operations without current templates or catalog validation. Historical v3 and v2 native snapshots remain supported. v2 has unknown release provenance. Unsupported layouts/runtime receipts are refused.

Explicit replacement virtually undoes owned changes to the original user baseline, renders the target, and commits final changes against actual current preimages. The existing transaction protects complete read dependencies, locks, staging, rollback and competing edits. Final uninstall restores original user values and keeps unrelated later edits. Receipts are applied truth; canonical policy is the latest requested snapshot. Per-client partial outcomes are explicit.

There is one TOML parser dependency and no CLI compilation. The static page's data injection is a deterministic release-preparation step. Generated native files have no package/source/state dependency; npm package removal does not remove saved native settings.
