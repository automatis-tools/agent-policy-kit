# Verification record

Configuration release/page candidate 0.1.0, macOS arm64, 2026-10-30. Configuration checks, native loading and model execution are separate results.

| Layer | Current evidence |
|---|---|
| Full Node 26.5.1 suite | PASS: 203/203, including both source-denied real-tarball gates, selected-role native generation, v2/v3/v4 ownership and page payloads |
| Minimum Node 22.13.0 suite | PASS: 203/203, using the checksum-verified official runtime outside the denied source checkout |
| Two synthetic releases | PASS: actual 0.1.0/0.2.0 tarballs, changed model and shared role/instruction definitions, A to B to A, mixed applied versions, late replacement rollback, drift safety and original-user restoration |
| Page-selected roles via npx | PASS: the shipped page encoder produced Reviewer/Researcher for selected Codex/Claude fixtures, including independent effort. Real npx used the local tarball offline. Unselected installed tools stayed unchanged. Later role reduction/removal succeeded. A late failure after role deletion restored the complete prior installation. |
| Package/state removal | PASS: native files and standalone consumer fixtures remain readable without package/source/state |
| Desktop Google Chrome | PASS: approved four-step layout, empty/missing/error/ready states, per-tool modes, append order, automatic All/manual scope, synced role rows, model/effort payload, actual clipboard copy, denied-clipboard fallback and stale-copy protection |
| Custom input browser regression | PASS: real typing followed directly by effort or Copy clicks, without Tab, works with reduced motion. The earlier lost-click case was reproduced before the fix. Normal/reduced/fallback motion checks are recorded separately from model execution. |
| Independent review | PASS: read-only code/spec review and 850 payload/catalog combinations validated against CLI policy rules. The focused Custom blur fix passed scoped re-review with Chrome RED/GREEN evidence. |
| Current model catalog | Dated release snapshot: Codex 9 selectors, Claude 19 selectors, Kimi 6 preferred aliases, Antigravity CLI 4 tiers. API effort metadata is separate. Account access and model quality are not established by configuration tests. |
| Native Codex/Antigravity loading | Historical parser/listing positive and malformed negative controls only. New subset behavior has file/consumer fixtures, not fresh vendor-client loading proof. |
| Native Claude/Kimi loading and provider execution | NOT CHECKED; no live model tasks used as configuration proof |
| npm packaging | PASS: 36-file package-content inspection and real local tarball consumption. No npm publication. |
| Hosted macOS/Linux CI, deployment and publication | NOT RUN; repository remains local with no remote |

The 0.2.0 packages are synthetic test fixtures, not public releases. Browser evidence, disposable homes, raw configuration fixtures and logs stay outside Git/npm. The page's pinned registry command becomes downloadable after npm publication. The verified local tarball supports testing before publication.
