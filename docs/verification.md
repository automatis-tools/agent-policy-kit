# Verification record

Configuration release/page 0.1.0, macOS arm64, 2026-10-30. Configuration checks, native loading and model execution are separate results.

| Layer | Current evidence |
|---|---|
| Full Node 26.5.1 suite | PASS: 248/248, including both source-denied real-tarball gates, selected-role native generation, v2/v3/v4 ownership and expanded page commands |
| Minimum Node 22.13.0 suite | PASS: 248/248, using the checksum-verified official runtime outside the denied source checkout |
| Two synthetic releases | PASS: actual 0.1.0/0.2.0 tarballs, changed model and shared role/instruction definitions, A to B to A, mixed applied versions, late replacement rollback, drift safety and original-user restoration |
| Page-selected roles via npx | PASS: the shipped page formatter produced explicit Reviewer/Researcher options for selected Codex/Claude fixtures, including independent effort. The actual multiline command ran through a real shell and npx with the local tarball offline. Unselected installed tools stayed unchanged. Later role reduction/removal succeeded. A late failure after role deletion restored the complete prior installation. |
| Package/state removal | PASS: native files and standalone consumer fixtures remain readable without package/source/state |
| Desktop Google Chrome | PASS: approved four-step layout, empty/missing/error/ready states, per-tool modes, append order, automatic All/manual scope, synced role rows, visible per-tool model/effort arguments, actual clipboard copy, denied-clipboard fallback and stale-copy protection |
| Custom input browser regression | PASS: real typing followed directly by effort or Copy clicks, without Tab, works with reduced motion. The earlier lost-click case was reproduced before the fix. Normal/reduced/fallback motion checks are recorded separately from model execution. |
| Independent review | PASS: independent URL codec/controller review and scoped final animation/hover/label-cache review. Preset/role integration review found and verified fixes for six-role schema bounds and live Custom Fable notices. Fresh targeted checks passed 76/76; full suites passed 248/248 on both runtimes. |
| URL/checklist behavior | PASS in local HTTP Chrome tabs: exact command restored from a shared link, imported copy remains incomplete, Reset clears state/hash, no default radio, first mode choice skips warning, Custom-only toggle skips unnecessary overwrite warning while genuine edits/mixed bases/cap remain protected, view-only navigation preserves copy, settings changes clear it, invalid links remain non-applicable. Hint/marker keyframes hold at offsets 0–0.5 and fade by offset 1 over 4000 ms. |
| Current model catalog | Dated release snapshot: Codex 9 selectors, Claude 19 selectors, Kimi 6 preferred aliases, Antigravity CLI 4 tiers. API effort metadata is separate. Account access and model quality are not established by configuration tests. |
| Native Codex/Antigravity loading | Historical parser/listing positive and malformed negative controls only. New subset behavior has file/consumer fixtures, not fresh vendor-client loading proof. |
| Native Claude/Kimi loading and provider execution | NOT CHECKED; no live model tasks used as configuration proof |
| Six-role compatibility | PASS: legacy four-role v2/v3/v4 inspection, owned removal, explicit expansion to six, drift refusal and late rollback; six-alias Kimi v4 plans/inspects/removes 14 bounded operations. |
| npm packaging | PASS: 38-file package-content inspection and real local tarball consumption. No npm publication. |
| Hosted macOS/Linux CI | See the public workflow runs linked from the GitHub release; local results above do not establish hosted CI. |
| Deployment/publication | Public status and downloadable artifacts are recorded in the GitHub release; package checks below concern the reviewed tarball. |

The 0.2.0 packages are synthetic test fixtures, not public releases. Browser evidence, disposable homes, raw configuration fixtures and logs stay outside Git/npm. Expanded commands preserve the selected cap and avoid lists; :native round-trips unpinned effort. A 2835-case preset/role/tool matrix produces identical native role files and routing instructions. Real-shell tests preserve colon/@/bracket IDs and prevent pathname expansion. The same pinned command consumes the published npm release. The verified local tarball supports testing before publication.
