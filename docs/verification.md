# Verification record

Baseline: local macOS arm64, 2026-10-29, package 0.1.0. This is a local release candidate, not an npm publication or hosted CI result.

| Layer | Result | What it establishes |
|---|---|---|
| Policy, hooks, audit, detection and installer tests | PASS, 101/101 on Node 22.13.0 and 26.5.1 | Deterministic local behavior and adversarial fixtures |
| Packed installed-bin acceptance | PASS on both runtimes; full suites 102/102 | Real tarball, fresh profiles, denied checkout access, rollback, idempotency, uninstall and privacy |
| Node minimum 22.13.0 | PASS | Supported runtime floor |
| Claude native validator / SDK tests | PASS, strict validator and 35/35 tests | Real native loader contracts and test SDK behavior, without inference |
| Claude control initialization | PASS, 2.1.312 | Package command registration was observed without sending a user/model prompt |
| npm publish dry-run / package inspection | PASS, no publication | Allowed package contents, executable bin, bundled guide and diagram |
| Codex hook trust on a new consumer install | NOT CHECKED | Written files do not grant trust |
| Live provider-model execution | NOT CHECKED | No paid model smoke was used as package validation |
| Hosted macOS/Linux CI | NOT RUN | Workflow prepared; no remote exists |
| Windows settings application | UNSUPPORTED | Explicit refusal |
| agy exact-model enforcement | UNSUPPORTED | Tier selection does not prove concrete provider model |

Observed native CLI versions during preparation: Codex 0.165.0, Claude Code 2.1.312, Kimi Code 2.4.0, agy 1.4.10. Detection means version/help identity, not account entitlement. Client updates require renewed native checks.

The tarball gate uses version/help-only fixture executables. It proves distribution and configuration behavior; it does not impersonate native loading or inference. The optional Claude mod's audit export is a bounded diagnostic sample. Missing model/token evidence remains unknown.

Commands: npm run check; npm run test:unit on both runtimes; npm test on both runtimes; claude plugin validate . --json --strict; claude plugin test .; npm publish --dry-run --ignore-scripts. Native validation reports directory-listing advice (marketplace install line/icon); this is not a claim of marketplace acceptance. Private logs, backups and raw native control payloads are excluded from publication.
