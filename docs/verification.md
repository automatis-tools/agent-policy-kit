# Verification record

Configuration-only release candidate 0.1.0, local macOS arm64, 2026-10-29. Previous runtime-hook/mod results do not validate this redesign.

| Layer | Status | Meaning |
|---|---|---|
| Shared preferences/native generation/installer/detection | PASS, 86/86 unit cases within both full suites | Native file shapes, ownership, preservation and safety |
| Installed tarball with denied source access | PASS on Node 22.13.0 and 26.5.1, full suites 87/87 each | Distribution, rollback, repeat setup and owned removal |
| Package/state removal after setup | PASS on both runtimes | Native files and standalone consumer fixtures have no APK dependency |
| Scoped native installer review | PASS after reserved Kimi alias correction | Independent 56/56 targeted tests |
| Whole-change review | Pending | Configuration-only contract and integration |
| Native Codex config parser | PASS, positive and malformed-config control | Native settings parse, role loading remains unchecked |
| Native agy role discovery | PASS, four roles listed; malformed role omitted | Native definitions load without a model task |
| Native Claude/Kimi role loading | NOT CHECKED | No documented safe role-list/parser-only command found |
| Real native model/provider execution | NOT CHECKED | No model smoke tasks used for configuration validation |
| Hosted macOS/Linux CI | NOT RUN | Workflow prepared; no remote exists |
| Windows settings application | UNSUPPORTED | Explicit refusal |

Native formats were checked against current primary documentation. Last observed CLI versions during preparation: Codex 0.166.0, Claude Code 2.1.312, Kimi 2.4.0, agy 1.4.10. Working identity does not prove account access, model entitlement or native loading in a resumed session. New native sessions may be needed.

The tarball gate uses fixture executable identities and standalone native-file consumers. It does not claim real provider execution. Private logs and profiles stay outside publication.
