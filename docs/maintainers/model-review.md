# Review models and presets

This document gives the procedure to review the model catalog and the presets for a configuration release. It is for maintainers. It tells you which inputs to collect, what to check for each assistant, how to record sources and dates, and which files to update together. The [2026-11-01 model review](../research/2026-11-01-model-review.md) is an example of the result.

## Principles

- The six roles stay stable: Coder, Reviewer, Code explorer, Test writer, Docs writer and Task runner. Models and effort levels are data in `policies/*.json`, `src/release.mjs` and `models/catalog.json`. A review changes this data, not the role responsibilities.
- The presets and the catalog belong to one npm version. A changed preset is a new configuration release. See [release](release.md).
- A newer model is not automatically better for every role, account or plan limit. Each change needs evidence.
- Native choices and API capabilities are different facts. Record them in different catalog fields. Aliases and session modes are not additional versioned models.
- A configuration test is not a model-quality evaluation. Do not present test results as quality results.
- Installed configurations do not change after a release. Users apply a release explicitly. See [updates and removal](../guide/updates-and-removal.md).

## When to review

Do a review in these cases:

- Before a release that changes presets or the catalog.
- When a vendor releases, retires or renames a model that a native client offers for subagents.
- When a native client changes how subagents get a model or an effort.

## Inputs

Collect these inputs before you compare anything:

1. The installed version of each native client: Codex CLI, Claude Code, Kimi Code CLI, Antigravity CLI and Grok Build.
2. The current vendor documentation for models, subagents, effort, pricing, plans and model lifecycle. The table in [Checks per assistant](#checks-per-assistant) lists the pages.
3. The current repository data: `policies/fast.json`, `policies/balanced.json`, `policies/quality.json`, the `topModels` entry of `PRESETS` in `src/release.mjs`, and `models/catalog.json`.
4. The previous research document in `docs/research/`.
5. Independent benchmark publications, for example Artificial Analysis and Vals AI, for the models that the presets use.

## Privacy rules

- Do not record account data. Do not write what one signed-in account can or cannot use.
- Record product facts. For example, "a signed-in catalog observed on 2026-11-01 lists 8 visible models" is a product fact. When a fact depends on the account or plan, write that it varies and whether you verified it.
- Do not record credentials, raw configuration files, home-directory paths or local cache contents.
- When you read provisioned metadata, read only the model fields. Do not print credentials.
- `npm run check` refuses packaged files that contain private paths or token patterns. This check does not replace your own review.

## Checks per assistant

Read client data only. Do not change native settings during the review.

| Assistant | Client data to read | Documentation to read | What to check |
|---|---|---|---|
| ChatGPT (Codex) | `codex --version`; the bundled catalog (`codex debug models --bundled`); the catalog that a signed-in client receives from the server; release notes | [Codex models](https://learn.chatgpt.com/docs/models), [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [Codex pricing](https://learn.chatgpt.com/docs/pricing), [Codex changelog](https://learn.chatgpt.com/docs/changelog), [API pricing](https://developers.openai.com/api/docs/pricing) | Visible and hidden selectors, native efforts, default effort in the bundled and server catalogs, retirements, credits per token, subagent guidance |
| Claude (Claude Code) | `claude --version`; `claude --help`; release notes of each version since the last review | [Model configuration](https://code.claude.com/docs/en/model-config), [Subagents](https://code.claude.com/docs/en/sub-agents), [Costs](https://code.claude.com/docs/en/costs), [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview), [Pricing](https://platform.claude.com/docs/en/about-claude/pricing), [Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations), [Claude pricing](https://claude.com/pricing) | Model IDs, efforts and defaults, subagent model and effort order, new environment variables, lifecycle dates, plan billing for each model |
| Kimi (Kimi Code) | `kimi --version`; release notes; provisioned model metadata (model fields only) | [Models](https://www.kimi.com/code/docs/en/kimi-code/models.html), [Membership](https://www.kimi.com/code/docs/en/kimi-code/membership.html), [What's New](https://www.kimi.com/code/docs/en/kimi-code/whats-new.html), [Kimi Code releases](https://github.com/MoonshotAI/kimi-code/releases) | Model IDs and aliases, efforts and defaults, quota multipliers, plan requirements, subagent changes |
| Gemini (Antigravity) | `agy --version`; `agy --help`; `agy changelog`; the tier values that the agent parser accepts | [Antigravity subagents](https://antigravity.google/docs/subagents), [Gemini API models](https://ai.google.dev/gemini-api/docs/models) | Accepted tiers against documented tiers, per-role effort, whether Google documents the tier-to-model resolution |
| Grok (Grok Build) | `grok --version`; the user guide that ships with the client (subagents and configuration reference chapters); the client model list | [xAI models](https://docs.x.ai/developers/models), [Grok Build subagents](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/16-subagents.md) | Model IDs, reasoning levels, subagent effort order, what `[subagents.models]` can set |

Vendor pages can disagree with each other or lag behind the clients. Older help pages are a known risk. For example, an old Kimi help page listed only four models while the current Kimi Code documentation and the provisioned metadata listed six. When two sources disagree, record both and say which one the catalog follows.

## Procedure

1. Record the review date (UTC) and the client versions.
2. For each assistant, do the checks in [Checks per assistant](#checks-per-assistant). Compare the results with `models/catalog.json`.
3. List each catalog fact that changed: new or retired models, efforts, defaults, lifecycle dates, plan requirements and notes.
4. Collect benchmark and guidance evidence for each preset cell that a change could affect. Mark each source as primary or secondary. See [Record sources and dates](#record-sources-and-dates).
5. Compare the evidence with the current [presets](../reference/presets.md). For each proposed change, write the old value, the new value, the evidence and a confidence level (high, medium or low).
6. Do not change a preset cell on secondary sources alone. Mark such a cell as a candidate for local verification instead.
7. Write the cells that you leave unchanged on purpose, with the reason.
8. Write the open questions that need local verification.
9. Get the owner decision on the proposed changes.
10. Update the files in [Files to update together](#files-to-update-together).
11. Do the checks in [Verify](#verify).

## Record sources and dates

- Write the research result to `docs/research/<YYYY-MM-DD>-model-review.md`. Use the review date.
- Give each number a source URL and the type primary or secondary. Primary sources are vendor documentation and announcements, the native clients, independent benchmark operators and research papers. Secondary sources are aggregators, blogs and press.
- Say when a value is derived. For example, cost per solved task is the cost per attempt divided by the success rate.
- Say when you read a page only through a summary or did not read it directly.
- Do not link to private notes or to files outside Git.
- In `models/catalog.json`, set `reviewedAt` to the review date. Update `observedClientVersion`, `observation`, `note`, `source` and `lifecycle` where they changed.

## Files to update together

| File | What to update |
|---|---|
| `policies/fast.json`, `policies/balanced.json`, `policies/quality.json` | Preset models, efforts and parallel limits |
| `src/release.mjs` | The `topModels` choices of the top models switch |
| `models/catalog.json` | Review date, client versions, models, efforts, defaults, exclusions, lifecycle, notes and sources |
| [docs/reference/presets.md](../reference/presets.md) | Preset tables, design principles and short reasons. `test/catalog.test.mjs` compares every table cell with the preset data. |
| [docs/reference/model-catalog.md](../reference/model-catalog.md) | Inventory per assistant and catalog fields |
| [docs/reference/assistants.md](../reference/assistants.md) | Native limits and prerequisites, when a client changed them |
| `docs/research/<YYYY-MM-DD>-model-review.md` | The new research document |
| [CHANGELOG.md](../../CHANGELOG.md) | The changed cells, the reasons, who should update, client requirements, and migration and rollback limits |
| Website dependency pin | Update the separate ACC website to the published APK version after publication |

Use the release process in [release](release.md) for the version number and the changelog date. The page build is in [website](website.md).

## Verify

Run these commands in the repository root:

1. Run the checks: `npm run check`.
2. Run the tests: `npm test`.
3. After publication, verify the website against its updated dependency pin.

`npm test` includes the comparison of the preset tables with the preset data. For setup and hooks, see [development](development.md). Record native format checks in [verification](verification.md).
