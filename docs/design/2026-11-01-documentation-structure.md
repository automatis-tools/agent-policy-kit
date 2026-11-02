# Documentation structure

## Intent

The documentation grew as a set of notes: one flat `docs/` folder for four audiences, documents that mix several topics, the same facts repeated in up to eight places, and stale statements from before the first publication. The goal is a set of independent documents. Each document answers one question for one audience, can be read without the others, and links to the single place where a related fact is documented.

The research behind the presets is also documented, so a reader can check why a preset has its values.

## Decisions

- Documents move into audience folders. Old paths are removed without redirect stubs (owner decision). Links in code, tests, the page template and the changelog are updated to the new paths.
- The work is a separate pull request, stacked on the 0.4.0 preset pull request (#22).
- Language stays English. Style follows ASD-STE100 principles: short sentences, active voice, present tense, one instruction per step, terms defined on first use.
- Every fact has one canonical document. Other documents link to it instead of restating it. Short summaries with a link are allowed where a reader needs the context.
- Every document starts with a title and a short paragraph that says what it covers and who it is for.
- No account data, private paths, raw configuration, credentials or test evidence from a real account goes into Git. Research describes product facts and public sources, not what one account can access.

## Structure

| Path | Audience | Covers | Main sources |
|---|---|---|---|
| `README.md` | Everyone | What APK is, quick start, links | current README |
| `AGENT_INSTALL.md` | AI agent that installs APK | Step-by-step runbook: select release, detect, plan, apply, verify, remove, report. Details are links. | current AGENT_INSTALL |
| `CONTRIBUTING.md`, `SECURITY.md` | Contributors, reporters | Refreshed, no pre-publication statements | current files |
| `docs/README.md` | Everyone | Index: which document answers which question | new |
| `docs/guide/getting-started.md` | People who use APK | Configurator → command → check → remove the package; common scenarios | installation, use-cases |
| `docs/guide/configurator.md` | People who use APK | The page: steps, modes, top models switch, per-tool limits, share links | configuration-page (user parts) |
| `docs/guide/commands.md` | People and agents | CLI reference: every command, input mode and flag, output formats, exit codes | AGENT_INSTALL §2, installation, releases, `bin/` and `src/` |
| `docs/guide/preferences.md` | Advanced users | Preferences JSON format and validation rules | policy |
| `docs/guide/updates-and-removal.md` | People who use APK | Choose a release, upgrade, downgrade, uninstall, recover from an interrupted change, what a release does not freeze | releases, recovery, model-updates (user part) |
| `docs/guide/privacy.md` | Everyone | What APK reads, writes and never sends | privacy |
| `docs/reference/assistants.md` | Everyone | Per assistant: detected executable, files written, native limits, desktop apps, prerequisites | compatibility, AGENT_INSTALL §4, installation, design/grok |
| `docs/reference/roles.md` | Everyone | The six roles, their prompts and permissions, the default subagent per assistant, how effort applies | `src/roles.mjs`, `src/native.mjs`, `src/install.mjs`, architecture |
| `docs/reference/presets.md` | Everyone | Light, Standard, Top-tier matrices, top models switch, parallel limits, design principles, short reasons with links to research | model-catalog (preset parts) |
| `docs/reference/model-catalog.md` | Everyone | What `models/catalog.json` contains: fields, inventory per assistant, efforts, defaults, lifecycle | model-catalog (catalog parts), models/README |
| `docs/reference/ownership.md` | Advanced users, maintainers | Receipts v2–v4, state directory, transactions, drift, rollback; glossary of owned, drift, receipt | architecture, releases, recovery, AGENT_INSTALL §5 |
| `docs/research/2026-11-01-model-review.md` | Maintainers, curious users | Evidence for the 0.4.0 presets: sources by vendor, Opus vs Sonnet by effort, Fable vs Opus, effort returns, small models, open questions | `.agent-work` research report and notes |
| `docs/research/limits-evidence.md` | Everyone | How the README limit illustration was measured | limits-evidence |
| `docs/maintainers/architecture.md` | Maintainers | Modules, data flow, release = version | architecture |
| `docs/maintainers/development.md` | Maintainers | Setup, tests, hooks, sandbox requirements | development |
| `docs/maintainers/model-review.md` | Maintainers | How to review models and presets for a release | model-updates, model-catalog maintenance text |
| `docs/maintainers/release.md` | Maintainers | Prepare, verify and publish a configuration release | npm-release |
| `docs/maintainers/website.md` | Maintainers | Page build, hosting, versioned pages, automatic deployment, credentials | configuration-page (build parts), deployment |
| `docs/maintainers/verification.md` | Maintainers | Verification log per release | verification |
| `models/README.md` | Maintainers | Two lines: what the file is, link to the catalog reference | models/README |
| `docs/design/` | Maintainers | Dated design specs, unchanged | — |

## Constraints

- `test/catalog.test.mjs` parses the preset tables (`### Light`, `### Standard`, `### Top-tier`, rows `| Coder | … |`). The tables move to `docs/reference/presets.md` in the same format, and the test reads that path.
- `scripts/build-site.mjs` links the page to the limits evidence; the link moves to `docs/research/limits-evidence.md`.
- The packaged `README.md` must keep `# Agent Policy Kit` as its first line and the `docs/assets/subagent-limits.svg` image.
- `CHANGELOG.md` keeps its entries; only link targets change. The 0.4.0 entry notes the reorganization.
- Facts must match the code on this branch. Where a document and the code disagree, the code wins and the difference is reported.

## Out of scope

Code behavior, presets, catalog values, the page interface and the changelog wording of released versions.
