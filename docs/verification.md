# Verification record

Configuration release/page candidate 0.1.0, macOS arm64, 2026-10-29. Configuration checks, native loading and model execution are separate results.

| Layer | Current evidence |
|---|---|
| Full Node 26.5.1 suite | PASS: 186/186, including both source-denied real-tarball gates |
| Minimum Node 22.13.0 suite | PASS: 186/186, including both package gates, before the later browser-only tool/mode controls update; those controls have current Node 26 and Chrome coverage |
| Two synthetic releases | PASS: actual 0.1.0/0.2.0 tarballs, changed preset/model and role/instruction templates; A→B→A, mixed applied versions, late replacement rollback, drift/prerequisite safety, final original-user restoration |
| Package/state removal | PASS: generated native files/standalone consumer fixtures continue without source/npm/state |
| Real Chrome page | PASS: desktop and 320/390 px Chrome emulation; embedded Public Sans, uniform dropdown arrows, one active tool button and four mode radios. Model/effort edits select Custom; switching tools preserves edits; returning values to a preset keeps Custom until a named mode or Reset. Copy feedback and forced-colors selection remain visible; no horizontal overflow or console errors. Earlier model/tier validation checks remain covered by the unchanged validation logic. |
| Actual page command via npx | PASS: local 0.1.0 tarball, fresh npm cache and disposable CLI identities; fast preset and custom maximum effort persisted, main model and disabled delegation preserved; no live settings or model calls |
| Independent review | PASS after two catalog/provider-ID corrections; later scoped tool/mode/command review also passed after a forced-colors selection fix |
| Native Codex config parser | Earlier positive/malformed negative controls passed; latest catalog additions have fixture coverage, not complete role/model execution |
| Native Antigravity role listing | Earlier four-role positive/malformed-role omission controls passed; latest tier choices have fixture coverage only |
| Native Claude/Kimi loading and provider execution | NOT CHECKED; no live model tasks used as configuration proof |
| npm packaging | PASS: 35-file tarball inspection and publication dry-run; no publication |
| Hosted macOS/Linux CI and publication | NOT RUN; no remote, deployment or npm publication |

The release catalog is dated and sourced; access differs by account/provider. Model quality and price were not benchmarked. Test version 0.2.0 is synthetic, not a public release. Private profiles, logs, source probes and browser payload evidence remain excluded from Git/npm.
