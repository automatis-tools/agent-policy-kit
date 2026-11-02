# Verification

This document is the verification log of Agent Policy Kit (APK): the evidence recorded for each configuration release. It is for maintainers who cut a release and for readers who want to know what was checked. [Release](release.md) tells when to add a record.

## How to read a record

A record keeps these results separate:

- **Configuration checks:** tests, package checks and the files that APK writes.
- **Native loading:** a native client reads the files.
- **Model execution:** a provider runs a model with the settings.

A configuration check does not prove native loading. Native loading does not prove model execution, account access or model quality. `NOT CHECKED` means that the record has no evidence for that layer.

Each record names the platform and the date. Browser evidence, temporary homes, raw configuration fixtures and logs stay outside Git and npm.

No record exists yet for 0.4.0.

## 0.3.0

macOS arm64, 2026-11-01.

| Layer | Evidence |
|---|---|
| Full Node 26.5.1 suite | PASS: 368/368. The suite includes the real-tarball tests with source access denied, desktop app bundle detection and the renamed `chatgpt` and `gemini` IDs. A second run with `/Applications` replaced by a missing directory also passed 368/368, so no test depends on apps installed on the host |
| Hosted CI | PASS on main e8c6ac3: macOS Node 22.13.0 and Ubuntu Node 24 suites and the site build ([run](https://github.com/automatis-tools/agent-policy-kit/actions/runs/41348755442)) |
| Two synthetic releases | PASS: the actual 0.3.0 tarball and a synthetic 0.4.0 tarball. A to B to A, mixed applied versions, drift safety and restoration of the original user values |
| Published 0.2.0 to 0.3.0 | PASS in an isolated HOME with the npm 0.2.0 package. ChatGPT (Codex) reports `OWNERSHIP_CONFLICT` in both directions until the creating version removes its settings. Then setup succeeds. Claude upgrades to 0.3.0 and moves back to 0.2.0 in place. Grok upgrades in place. Kimi NOT CHECKED with a provisioned model pool |
| Desktop app detection | PASS with the installed apps and a `PATH` without CLIs: the bundled `codex-cli 0.166.0-alpha.5.1` of ChatGPT Desktop and the bundled Claude Code 2.1.309 of Claude Desktop, both reported as `desktop_app` |
| Browser | PASS in local Chromium previews: the "AI assistants" step empty and with two assistants, its note, the All scope and the generated `--chatgpt` command |
| Native ChatGPT, Claude, Kimi, Gemini and Grok loading and provider execution | NOT CHECKED for 0.3.0. No live model tasks were used as configuration proof |
| npm packaging | PASS: `npm pack --dry-run` and `npm publish --dry-run` list 45 files. No private evidence or configuration |
| Model catalog | Unchanged from 0.2.0, apart from the `chatgpt` and `gemini` keys and the general labels: ChatGPT 9 selectors, Claude 19 selectors, Kimi 6 preferred aliases, Gemini 4 Antigravity tiers, Grok 4 model IDs. Configuration tests do not establish account access or model quality |

## 0.2.0

macOS arm64, 2026-11-01.

| Layer | Evidence |
|---|---|
| Full Node 26.5.1 suite | PASS: 350/350. The suite includes the real-tarball tests with source access denied, native generation for selected roles, Grok Build files under an isolated `GROK_HOME`, per-tool limits and expanded page commands |
| Hosted CI | PASS on main 7f8666d: macOS Node 22.13.0 and Ubuntu Node 24 suites and the site build ([run](https://github.com/automatis-tools/agent-policy-kit/actions/runs/41283600922)) |
| Two synthetic releases | PASS: the actual 0.2.0 tarball and a synthetic 0.3.0 tarball. A to B to A, mixed applied versions, drift safety and restoration of the original user values |
| Page command through npx | PASS: the generated multiline command runs through a real shell and npx with the local tarball. Independent Codex 5 and Claude 2 limits and the Grok Build values are read back from the native files |
| Preset audit | PASS: an independent review compared every preset, tool and role with the catalog and the documentation. It found no data defects. Wording fixes were applied, and a test keeps the documentation tables in sync |
| Grok Build discovery | PASS: `grok inspect --json` with Grok Build 1.0.70 lists an `apk-*` agent from an isolated `GROK_HOME`. Model selection and execution NOT CHECKED |
| Native Codex, Claude, Kimi and Antigravity loading and provider execution | NOT CHECKED for 0.2.0. No live model tasks were used as configuration proof |
| Browser | The owner reviewed local previews manually. No automated browser run for 0.2.0 |
| npm packaging | PASS: `npm pack --dry-run` and `npm publish --dry-run` list 42 files. No private evidence or configuration |
| Model catalog | Codex 9 selectors, Claude 19 selectors, Kimi 6 preferred aliases, Antigravity CLI 4 tiers, Grok Build 4 model IDs. Configuration tests do not establish account access or model quality |

## 0.1.0

macOS arm64, 2026-10-30.

| Layer | Evidence |
|---|---|
| Full Node 26.5.1 suite | PASS: 248/248. The suite includes both real-tarball tests with source access denied, native generation for selected roles, v2, v3 and v4 ownership and expanded page commands |
| Minimum Node 22.13.0 suite | PASS: 248/248, with the checksum-verified official runtime outside the denied source checkout |
| Two synthetic releases | PASS: actual 0.1.0 and 0.2.0 tarballs with a changed model and changed shared role and instruction definitions. A to B to A, mixed applied versions, rollback of a late replacement, drift safety and restoration of the original user values |
| Selected page roles through npx | PASS: the shipped page formatter produced explicit Reviewer and Researcher options (Researcher is now Code explorer) for selected Codex and Claude fixtures, including independent effort. The actual multiline command ran offline through a real shell and npx with the local tarball. Installed tools that were not selected stayed unchanged. A later reduction and removal of roles succeeded. A late failure after a role deletion restored the complete earlier installation |
| Package and state removal | PASS: the native files and standalone consumer fixtures stay readable without the package, the source and the state |
| Desktop Google Chrome | PASS: the approved four-step layout, the empty, missing, error and ready states, per-tool modes, append order, automatic All and manual scope, synchronized role rows, visible per-tool model and effort arguments, actual clipboard copy, the fallback for a denied clipboard and protection against a stale copy |
| Custom input browser regression | PASS: real typing followed directly by an effort click or a Copy click, without Tab, works with reduced motion. The earlier lost-click case was reproduced before the fix. Normal, reduced and fallback motion checks are recorded separately from model execution |
| Independent review | PASS: an independent review of the URL codec and the controller, and a scoped final review of animation, hover and the label cache. The review of the preset and role integration found fixes for the six-role schema bounds and the live Custom Fable notices, and verified them. Fresh targeted checks passed 76/76. Full suites passed 248/248 on both runtimes |
| URL and checklist behavior | PASS in local HTTP Chrome tabs. The exact command is restored from a shared link. An imported copy stays incomplete. Reset clears the state and the hash. No mode is selected by default. The first mode choice shows no warning. Selecting only Custom shows no overwrite warning, while genuine edits, mixed bases and the limit stay protected. Navigation that only changes the view keeps the copy status. Settings changes clear it. Invalid links do not produce a command. Hint and marker keyframes hold at offsets 0 to 0.5 and fade by offset 1 over 4000 ms |
| Model catalog | Dated release snapshot: Codex 9 selectors, Claude 19 selectors, Kimi 6 preferred aliases, Antigravity CLI 4 tiers. API effort metadata is separate. Configuration tests do not establish account access or model quality |
| Native Codex and Antigravity loading | Only historical parser and listing checks with positive and malformed negative controls. The new subset behavior has file and consumer fixtures, not fresh proof that the vendor clients load it |
| Native Claude and Kimi loading and provider execution | NOT CHECKED. No live model tasks were used as configuration proof |
| Six-role compatibility | PASS: inspection of legacy four-role v2, v3 and v4 receipts, owned removal, explicit expansion to six roles, drift refusal and late rollback. Six-alias Kimi v4 plans, inspects and removes 14 bounded operations |
| npm packaging | PASS: inspection of the 38 package files and consumption of the real local tarball. No npm publication |
| Hosted macOS and Linux CI | The public workflow runs are linked from the GitHub release. The local results above do not establish hosted CI |
| Deployment and publication | The GitHub release records the public status and the downloadable artifacts. The package checks in this record apply to the reviewed tarball |

Notes for 0.1.0:

- At 0.1.0, the 0.2.0 packages were synthetic test fixtures, not public releases.
- Expanded commands keep the selected limit and the avoid lists. `:native` round-trips an unpinned effort.
- A matrix of 2835 cases over presets, roles and tools produces identical native role files and routing instructions.
- Real-shell tests keep IDs with colons, `@` and brackets, and prevent pathname expansion.
- The same pinned command consumes the published npm release. The verified local tarball supports tests before publication.
