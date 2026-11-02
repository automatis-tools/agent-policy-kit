# Changelog

Each npm version is one configuration release: its presets, native role definitions, instructions and configuration page. Published versions are not rewritten. Applying another release is explicit; package installation alone changes no settings.

## 0.5.2 — Unreleased

### Why this release

Uninstall did not give back `config.toml` byte for byte when APK had added a table to it (#34). When APK adds a table, such as `[subagents.models]` for Grok, it writes one empty line before the table header. Uninstall removed the header but kept this empty line. Each replacing setup, for example with another preset, removed the table in memory the same way and then wrote the table again with a new empty line. After a Grok setup, one replacing setup and an uninstall, two empty lines stayed after the `[subagents]` table. Settings and values were always restored. Only the bytes of the file were different. The undo logic reaches your setup only through a new release.

### Who should update

- Anyone who uses Grok Build with APK. APK always adds the `[subagents.models]` table for Grok.
- Anyone who uses ChatGPT or Kimi with APK and whose `config.toml` did not have the table that APK writes to: `[agents]` for ChatGPT, or `[secondary_model]` and `[models."ALIAS".overrides]` for Kimi. A ChatGPT file that had an `[agents]` table was restored exactly before.
- Claude and Gemini get no change. They have no `config.toml`.
- Role files, presets, instructions and the model catalog are the same as in 0.5.1.

### Migration and rollback

Assistant IDs, preset ids, share-link format v2 and receipt format v4 are unchanged. `doctor`, `show`, setup and `uninstall` of 0.5.2 read receipts from 0.4.0, 0.5.0 and 0.5.1. These releases wrote the same file layout, so uninstall of 0.5.2 also removes the empty line before a table that they added. This was checked for Grok with the published 0.4.0, 0.5.0 and 0.5.1 packages in isolated homes.

- An empty line that a replacing setup of 0.5.1 or earlier already left in the file stays. APK cannot tell it from your own lines. Remove it by hand if you want.
- If your `config.toml` did not end with a line break, APK must add one before it writes the first new line. 0.5.2 records this in the receipt as `addedLineBreak`, a hash of that last line, and removes the line break again on uninstall when the file ends with that line again. A line that you added after it keeps its line break. Releases 0.5.1 and earlier do not know this field and stop with `INVALID_RECEIPT`. To move such an assistant back to 0.5.1, first remove it with 0.5.2: `npx --yes --ignore-scripts --package agent-policy-kit@0.5.2 agent-policy uninstall --client grok --apply`. Then set up with 0.5.1. A receipt from 0.5.1 or earlier for such a file has no record, so uninstall keeps the line break at the end of the file.
- All other 0.5.2 receipts have the same fields as before. Setup with 0.5.1 moves them back in place, and uninstall with 0.5.1 removes them, with the old empty line behavior.

See the [migration boundaries](docs/guide/updates-and-removal.md#migration-boundaries).

### What changed

- Fixed: uninstall and replacing setups remove the empty line that APK wrote before a table it added, together with the table (#34). APK removes the empty line with the line ending of the table header, so an empty line that you added with another line ending stays. A setup, any number of replacing setups and an uninstall give back the original bytes of `config.toml` for Grok, ChatGPT and Kimi. Empty lines that you added stay.
- Fixed: uninstall removes a line break that APK added at the end of a `config.toml` that did not end with one. If you added lines after the APK settings, the line break stays, because TOML needs it.
- A replacing setup writes the same `config.toml` bytes as a first setup on the original file.

## 0.5.1 — 2026-11-01

### Why this release

The Grok Reviewer and Code explorer roles were not read-only (#30). Releases 0.4.0 and 0.5.0 wrote `permission_mode: plan` in their role files. Grok Build reads the fields of an agent file in camelCase, so it ignored this key without a warning, and the prompt was the only restriction. A role file template reaches your setup only through a new release.

### Who should update

- Anyone who uses Grok Build with APK and wants the Reviewer and the Code explorer to be read-only.
- Other assistants get no configuration change. Their role files, presets and the model catalog are the same as in 0.5.0.

### Migration and rollback

Assistant IDs, preset ids, share-link format v2 and receipt format v4 are unchanged. `doctor` and `show` of 0.5.1 read installations and receipts from 0.4.0 and 0.5.0. Setup with 0.5.1 and `--release`, `--preset`, `--config` or explicit tool arguments replaces their Grok role files in place. A setup without these options reports `unchanged` and keeps the old role files. Setup with 0.5.0 or 0.4.0 moves Grok back in place and writes `permission_mode: plan` again. `uninstall` of 0.5.1 removes a 0.4.0, 0.5.0 or 0.5.1 installation. This was checked for Grok with the published 0.4.0 and 0.5.0 packages in isolated homes and with `grok inspect --json` of Grok Build 1.0.70. The [migration boundaries](docs/guide/updates-and-removal.md#migration-boundaries) of earlier releases still apply.

### What changed

- Grok: the Reviewer and the Code explorer role files have `capabilityMode: read-only` instead of `permission_mode: plan` (#30). When Grok Build starts a subagent of this type, it removes the built-in tools that edit, write, delete or move files and the shell tool. A capability mode requested at spawn cannot widen it. Tools from MCP servers stay, and image or video tools can stay when they are enabled. See [Grok read-only roles](docs/reference/assistants.md#grok-read-only-roles).
- Grok: APK does not write `permissionMode: plan`. Grok Build reads this field, but at spawn it uses only `bypassPermissions`.
- `show` reports `UNSUPPORTED_ROLE_CAPABILITY` for a Grok agent file whose `capabilityMode` Grok Build does not accept. Grok Build drops such an agent without a warning.
- Not checked: a live Grok model task with a read-only role.
- Configuration page: when you edit Kimi, Gemini or Grok alone, a short note above the model table tells how that assistant applies effort. Kimi shares one effort among the roles that use the same model alias. Gemini has native tiers only and no effort per role. Grok applies an effort only for models that support it, and a role without one runs at its model default. The **All** view shows no note. The unused note text in the page source is removed (#21).

## 0.5.0 — 2026-11-01

### Why this release

Three follow-ups from the 2026-11-01 model review needed released configuration changes. Primary Anthropic data showed that Sonnet 5.5 at medium is too weak for the Standard Coder (#29). Grok Build turned out to accept a reasoning effort per role, and APK described its Grok effort behavior wrongly (#27). Claude 4.5 models approach retirement, and the `sonnet` alias still points at Sonnet 4.5 on some providers (#28). The release also makes undo visible, so people can apply a setup without fear, and keeps the share link short until a setup is complete.

### Who should update

- Anyone who uses the Standard preset with Claude.
- Anyone who uses Grok Build and wants a different effort per role.
- Everyone else can update for the clearer undo guidance and the corrected Grok and Claude information. Light and Top-tier values do not change.

### Migration and rollback

Assistant IDs, preset ids, share-link format v2 and receipt format v4 are unchanged. Setup with 0.5.0 replaces a 0.4.0 installation in place, and setup with 0.4.0 moves back in place, for ChatGPT, Claude, Gemini and Grok. A Grok role effort written by 0.5.0 is removed when 0.4.0 writes its role files. Kimi was not checked with a provisioned model pool. The Claude boundary to 0.3.0 and earlier from 0.4.0 still applies to receipts from 0.5.0: see the [migration boundaries](docs/guide/updates-and-removal.md#migration-boundaries).

### Presets and model catalog

- **Standard, Claude:** the Coder uses Sonnet 5.5 at high instead of medium (#29). Anthropic's per-effort data puts Sonnet 5.5 at medium 8.6 to 14.2 points below high on Terminal-Bench 4.0, FrontierCode and CursorBench, and Opus 5.5 at medium costs more per solved task on every measurement. Claude subagents without a named role in Standard also move from medium to high, so they use more of the plan. Reviewer and Test writer keep Sonnet 5.5 at high.
- **Grok:** Grok 4.7 lists the native levels low, medium, high and xhigh, with high as its default. Grok 4.6, Grok 4.5 and Grok Build 0.1 offer no effort. Grok presets keep the native default, and there is still no Grok top choice (#27).
- **Claude lifecycle:** Sonnet 4.5 is labelled "Sonnet 4.5 (retires 2026-11-30)" and records its deprecation date, its replacement and the partner schedules: Bedrock Legacy with end of life 2027-04-08, and no date on Google managed. Opus 4.5 and Haiku 4.5 stay active as legacy models without a deprecation notice (#28). The catalog review date is 2026-11-02.

Configuration checks are not model-quality evaluations.

### What changed

- Grok: each role can pin a reasoning effort. Setup writes `effort: <level>` in `~/.grok/agents/apk-<role>.md`; a role without an effort gets no line. `--grok` accepts `role=model:effort` and `role=model:native`; `role=model` still means the native default and produces the same files as before. The configurator offers effort buttons for Grok 4.7 and custom model IDs, share links keep a Grok effort, and `agent-policy show` reports the effort of each Grok agent.
- Fixed: APK no longer says that Grok subagents use the main session effort. APK pins each role's model, so a role without an effort runs at that model's default (Grok 4.7: high). The setup warning `grok-per-role-effort-unsupported` is replaced by `grok-effort-model-dependent`.
- The README and step 4 of the configurator show how to undo a setup: the uninstall command pinned to the release, with a copy button. Removal restores the settings you had before APK and keeps your unrelated edits.
- The configurator puts a `#setup=` share link in the address only when steps 1–3 are complete. Opening the page, Reset form, or a change that leaves a step incomplete removes the link. Existing links, including links to unfinished forms, still open as before.
- Docs: the AI assistants reference shows which 4.5 models the Claude `sonnet`, `haiku` and `default` aliases resolve to on Bedrock, Google Agent Platform, Microsoft Foundry and Claude Platform on AWS, and tells Foundry users to pin a newer Sonnet before 2026-11-30. The model review cites primary sources for the Opus 5.5 and Sonnet 5.5 equal-effort numbers and records the Standard Claude Coder decision.
- Docs: Grok Build ignores the `permission_mode` field that APK writes for read-only roles, so the Grok Reviewer and Code explorer are not read-only yet (#30).

## 0.4.0 — 2026-11-01

### Why this release

The presets and the model catalog were checked again on 2026-11-01 against the installed native clients and current vendor documentation. No vendor released or retired a subagent model since 2026-10-30. The new evidence changes where effort is spent, and it shows that Claude's top model is Opus 5.5, not Fable 5.1.

### Who should update

- Anyone who uses ChatGPT or Claude presets and wants the revised effort levels.
- Anyone who uses the Top-tier top models switch in Claude.
- Claude Code 2.1.316+ users who want subagents without a named role to stop inheriting the main session effort.

Kimi, Gemini and Grok preset values do not change, so their 0.3.0 installations need no update.

### Migration and rollback

Assistant IDs, preset ids (`fast`, `balanced`, `quality`), share-link format v2 and receipt format v4 are unchanged. Setup with 0.4.0 replaces a 0.3.0 installation in place, and receipts written by 0.3.0 still validate and uninstall. Setup with 0.3.0 moves ChatGPT, Kimi, Gemini and Grok back.

Claude has a migration boundary in the downgrade direction. A 0.4.0 Claude receipt owns a third setting, `CLAUDE_CODE_SUBAGENT_EFFORT`, whenever the Coder effort is pinned, and every preset pins it. Version 0.3.0 does not know this setting, so its setup reports `INVALID_RECEIPT` and changes nothing. To move Claude back to 0.3.0, first remove its settings with 0.4.0: `npx --yes --ignore-scripts --package agent-policy-kit@0.4.0 agent-policy uninstall --client claude --apply`. Then set up with 0.3.0. This was checked with the 0.3.0 source in an isolated home. Removal restores the value that the setting had before setup, or removes it. Share links of 0.3.0 open on the 0.3.0 page.

### Presets and model catalog

Re-running setup applies these values. Installations keep their current values until then.

- **Light, ChatGPT:** the Coder runs Luna at high instead of medium, the starting level OpenAI suggests for Luna. Luna stays the cheapest Codex model.
- **Standard, ChatGPT:** the Docs writer uses GPT-6.1 Terra at medium instead of GPT-6.1 Sol. OpenAI positions Terra for clear writing, at half of Sol's usage.
- **Top-tier, ChatGPT and Claude:** the Code explorer and Docs writer keep GPT-6.1 Sol and Opus 5.5 but run at medium instead of high. Implementation, review and tests stay at high.
- **Top models switch, Claude:** Coder, Reviewer and Test writer use Opus 5.5 at xhigh instead of Fable 5.1 at high. Anthropic's own benchmarks put Opus 5.5 ahead of Fable 5.1 on every published coding benchmark at 2.5 times lower price, and Anthropic suggests a higher Opus effort before Fable. Fable 5.1 stays available in Custom. The switch now sets a model and an effort; ChatGPT and Kimi keep GPT-6 Astra and K3.1 Pro at high.

The catalog snapshot is dated 2026-11-01:

- GPT-5.5 is marked retired from Codex for ChatGPT sign-in on 2026-10-14; it remains for API-key sign-in.
- GPT-6 Astra's native default effort is medium in the signed-in server catalog; the bundled value low is kept as `bundledDefaultEffort`. The hidden, undocumented `gpt-reserve` selector is excluded.
- Claude Code 2.1.316, Kimi Code 2.4.1 and Antigravity 1.4.12 are the observed client versions. Opus 4.5 and Haiku 4.5 record their earliest retirement dates.
- Kimi records plan requirements: K3 and K3.1 Pro need Plus or higher, and the 1M context of K3 needs Pro or higher.
- Antigravity's Flash Lite tier is marked undocumented: the CLI accepts it, but the subagent documentation lists only inherit, Flash and Pro.
- Grok 4.7's reasoning levels (low to xhigh) are recorded as API capabilities. APK still writes only a model for each Grok role, so subagents use the main session effort.

Configuration checks are not model-quality evaluations.

### What changed

- Claude: setup also writes `CLAUDE_CODE_SUBAGENT_EFFORT`, the effort for subagents that name none, from the Coder effort capped at high. Claude Code 2.1.316 added this setting; earlier versions ignore it. Before, those subagents kept the main session effort.
- `agent-policy show` reports the stored Claude default subagent effort and a `CLAUDE_CODE_SUBAGENT_EFFORT` environment override.
- The top models switch label shows each tool's model and effort.
- The website deployment guard also compares `src/release.mjs` with the release tag, because the page embeds its preset labels and top choices.
- The configurator shows a note when Gemini is selected: APK configures Antigravity, not Gemini CLI. The README and the AI assistants reference say the same.
- The documentation is reorganized into independent documents by audience: `docs/guide/` for people who use APK, `docs/reference/` for facts about assistants, roles, presets, the catalog and ownership, `docs/research/` for the evidence behind presets, and `docs/maintainers/` for development, releases and the website. [docs/README.md](docs/README.md) is the index. Old `docs/*.md` paths are removed without redirects. The 2026-11-01 model review is documented in [docs/research/2026-11-01-model-review.md](docs/research/2026-11-01-model-review.md).

## 0.3.0 — 2026-11-01

### Why this release

People know their assistants as ChatGPT, Claude, Kimi, Gemini and Grok, not by the names of the coding agents inside them. The configurator and the CLI now use those names. Some people use only the desktop apps, and they have no CLI on PATH. Before this release, setup found nothing for them.

### Who should update

- Anyone who uses Codex in ChatGPT Desktop or Claude Code in the Code tab of Claude Desktop on macOS without a separate CLI.
- Anyone who wants the general assistant names on the page and in the terminal.

Preset values do not change, so an installation of 0.2.0 keeps working without an update.

### Breaking change

AI assistants now have general names: ChatGPT, Claude, Kimi, Gemini and Grok. APK still configures their coding agents: Codex, Claude Code, Kimi Code, Antigravity and Grok Build. Two technical IDs changed, and there is no migration:

- `codex` is now `chatgpt`: `--chatgpt`, `--chatgpt-max-concurrent`, `--avoid-chatgpt`, `--client chatgpt` and the `clients.chatgpt` policy key.
- `agy` is now `gemini`: `--gemini`, `--gemini-max-concurrent`, `--avoid-gemini`, `--client gemini` and the `clients.gemini` policy key.
- Warning and error codes follow the new IDs, for example `chatgpt-native-precedence-limits` and `CHATGPT_CAP_ALIAS_CONFLICT`.

Before you use this version, remove the APK settings for these two assistants with the version that created them: `npx --yes --ignore-scripts --package agent-policy-kit@0.2.0 agent-policy uninstall --apply`. This version does not read the old `codex` and `agy` installation receipts, so its setup refuses the existing `apk-*` files as unowned. Policy files and share links that use the old IDs are refused too. Claude, Kimi and Grok keep their IDs.

### Migration and rollback

The two renamed IDs set a migration boundary. These results come from tests with the published 0.2.0 package and this release:

- **ChatGPT (Codex) and Gemini (Antigravity):** remove the APK settings with the version that created them before you set up with the other version. A move in either direction without removal reports `OWNERSHIP_CONFLICT` and changes nothing. After removal, setup with the other version succeeds.
- **Claude, Kimi and Grok:** their IDs and receipt format v4 are unchanged. In the tests, setup with 0.3.0 upgraded 0.2.0 installations of Claude and Grok in place, and setup with 0.2.0 moved Claude back. Kimi uses the same receipt format, but it was not tested with a provisioned model pool.

`uninstall --apply` removes the settings of every assistant. Run setup again afterwards for the assistants you use.

### Presets and model catalog

Preset models, effort levels and parallel limits are the same as in 0.2.0. Only the keys `codex` and `agy` became `chatgpt` and `gemini`, and the catalog labels became the general names. The model catalog snapshot is still dated 2026-10-30, with the Grok entries checked on 2026-11-01. Configuration checks are not model-quality evaluations.

### What changed

- The configurator calls the second step "AI assistants" and shows the general names. Readable CLI output uses the same names.
- On macOS, setup finds the Codex that ChatGPT Desktop includes and the Claude Code in the Code tab of Claude Desktop, also when no CLI is on PATH. Both apps read the same settings as their CLIs. A CLI on PATH or in a conventional location still has priority. Detect output reports these clients with `origin: "desktop_app"`. Claude Cowork reads its settings from the Claude account, so APK does not configure it.

## 0.2.0 — 2026-11-01

### Why this release

Subagents draw on the same plan limits as the main session, and every parallel session adds to that usage. Without explicit choices, subagents can inherit the most expensive model and use up a weekly limit within days. This release names the work modes by how much of a plan subagents may use, adds per-tool parallel limits, a read-only settings check and Grok Build support.

### Who should update

Anyone who wants Grok Build roles, per-tool parallel limits or the renamed modes. Re-running setup with 0.2.0 applies the new preset values: Top-tier now uses Opus 5.5, GPT-6.1 Sol and K3 at high effort, with top models behind an opt-in switch, and Kimi's Standard Docs writer uses K3 256K. Installations of 0.1.0 keep working unchanged until setup is run again.

### Migration and rollback

Preset ids (`fast`, `balanced`, `quality`), receipt format v4 and ownership, drift and rollback behavior are unchanged. Version 1 share links still open; new links use version 2 and carry each tool's parallel limit. Applying 0.1.0 again restores its owned settings, as the synthetic upgrade/downgrade gate verifies. Grok Build is new, so it has nothing to migrate.

### Presets and model catalog

The model catalog snapshot is dated 2026-10-30; Grok Build entries were checked on 2026-11-01 against the Grok Build 1.0.70 user guide and the xAI model list. An independent audit compared every preset, tool and role with the catalog and the documentation tables, and a test now keeps those tables in sync. Configuration checks are not model-quality evaluations.

### What changed

- Add Grok Build as a fifth coding tool, listed after Antigravity. APK writes `agents/apk-<role>.md` role files (Reviewer and Code explorer use the read-only `permission_mode: plan`), per-role models and a `general-purpose` fallback copied from the first selected role (the Coder when selected) in `config.toml` `[subagents.models]`, a native `[subagents] max_concurrent` cap and a delegation block in `AGENTS.md` under `$GROK_HOME` (default `~/.grok`). Per-role effort is not configurable, so every Grok choice has effort null and the page shows no effort controls. Presets use Grok Build 0.1, xAI's fast coding model, for light work and Grok 4.7 for stronger roles; Grok 4.6 and 4.5 stay available in Custom. Explicit commands use `--grok`, `--grok-max-concurrent` and `--avoid-grok`. Removal restores the original settings and refuses on local edits.

- Rename work modes to Light, Standard and Top-tier and describe them by how much of a plan's limits subagents use. Preset ids and share-link ids are unchanged. Top-tier now uses Opus 5.5, GPT-6.1 Sol and K3 at high effort for code, review and tests. A per-tool switch under Top-tier opts those roles into Fable 5.1, GPT-6 Astra or K3.1 Pro; it is off by default. Top models no longer run at xhigh/max, because native default subagent settings copy the first selected role (the Coder when selected) to subagents started without a named role.

- Explain each configuration step with a short ? note, and stop repeating vendor billing or version documentation in the work-mode notice.

- Start a fresh or reset form with every subagent role selected, and give the empty coding-tool field the same appearance as the empty role field.

- Automatically deploy the latest website from verified main while preserving exact tagged release pages and older share links. Configuration guards keep commands pinned to published package capabilities; npm releases remain explicit.

- Credit Mykola Maksymenko in the configuration page and package metadata. Link the supplied LinkedIn profile and related projects, with static author/project structured data and a release-specific canonical URL.

- Interactive terminals get readable setup, doctor, release and show output; captured output keeps the existing JSON contract, and `--json` forces JSON.

- `agent-policy show` reads the current user-level subagent settings of every tool, before or after APK installation, without writing files. The page footer offers it as "Check current settings" with a copy button.

- Each tool has its own parallel limit from 1 to 32, set in its details on the page or with `--TOOL-max-concurrent`; policies accept `clients[tool].maxConcurrent`.

- The page adds Add all for roles and tools, a GitHub link in the header, Reset form beside the release line, and preset switching for a single selected tool without a needless confirmation.

## 0.1.0 — 2026-10-30

### Why this release

Use a common approach to optional delegation across Codex, Claude Code, Kimi and Antigravity, without an extra process in normal agent operation. Configure once and remove the installer afterward.

### What it configures

Six focused roles cover implementation, read-only review, code discovery, test creation, documentation and prescribed execution. Each preset assigns a model and supported effort to every role; the [preset matrix](docs/reference/presets.md) explains the choices.

These are starting preferences, not model-quality benchmarks. Native model formats and alias behavior were reviewed against the official sources linked in [support](docs/reference/assistants.md) and [model maintenance](docs/maintainers/model-review.md). Model availability must be checked before applying. Provider aliases and tiers may resolve differently over time.

### Presets and model catalog

All three presets were rebuilt for public use. Personal Astra/Opus/Fable and other avoid lists were removed. Fast gives review and testing more reasoning than simple execution. Balanced separates implementation, verification, discovery, documentation and mechanics. Quality uses Astra/Fable for demanding work and regular K3.1 Pro at max for Kimi code/review/tests. Claude recommendations pin current versioned IDs; Kimi Balanced uses the quota-conscious K3 256K variant. These are editable recommendations, not benchmark results.

The release contains a dated model/effort catalog from official documentation and native selector observations, including native-default effort and account-dependent availability. Antigravity role choices are native tiers, with no invented per-role effort setting.

Catalog audit, 2026-10-30 UTC: Kimi now lists all six current models, including K3.1 Pro and Pro Highspeed. Quality first now uses regular K3.1 Pro at max effort for implementation/review/tests; other roles have separate choices described in the preset matrix. Highspeed remains optional because its faster output consumes about twice regular Pro's quota, according to Kimi. Setup requires provisioned access and does not silently fall back to another model.

Both Pro variants require compatible thinking settings. Even with unpinned effort, setup refuses an explicit thinking-disabled setting without modifying it.

Codex effort choices/defaults now follow CLI 0.166.0 rather than API defaults; API metadata remains separate, and Ultra stays separate from ordinary effort. Claude Opus 4.5 no longer advertises an API-only native effort override. Existing custom inputs using levels outside the current native catalog require review before reapplication; owned inspection/removal remains independent of current recommendations. Sonnet 4.5 remains selectable with its Anthropic deprecation status marked. Antigravity CLI's four tier choices are unchanged.

### What changed

- Added Test writer and Docs writer; clarified Code explorer and Task runner. Old four-role native v2/v3 receipts remain supported, including explicit expansion to six, owned removal, drift refusal and late rollback. New v4 snapshots support six independently configured Kimi aliases.

- Readable type uses a compact 36/20/15/13 px scale with more spacing; narrow layouts stack model controls and command actions.
- A short collapsible explanation introduces role-specific models, native setup and optional delegation, using the same wording as the README.
- The builder now starts with no roles, tools or chosen modes. Green checks track completed selections and successful copy, and Reset form restores a blank state. URL fragments restore visible settings without a backend. Conditional section hints and changed step markers use a two-second highlight hold plus two-second fade, respecting reduced motion. Selection controls share a soft treatment; Copy remains the primary action.
- Page commands always list every selected role/model/effort under its tool, including presets. Explicit --roles, --max-concurrent and optional --avoid-TOOL preserve the existing selection, cap and guidance. :native represents unpinned effort; Antigravity remains tier-only. The shared codec validates complete role maps and rejects duplicate/mixed input before writes. Legacy release/config/policy inputs remain supported.
- The four-step page now selects subagent roles and coding tools before mode/model/effort configuration. It generates and copies a real pinned command. Tool additions preserve All or a manually selected view. Role help uses the same prompt definitions as native generation.
- Optional selectedRoles creates only the requested native roles. Receipt v4 binds that role set to owned files and supports safe expansion, reduction and removal. Earlier v2/v3 native receipts retain their historical four-role ownership boundary. Unselected Kimi aliases do not need provisioning or effort pins.
- Native role files and routing instructions apply only when the main agent chooses delegation. Main models and disabled delegation features are preserved.
- A static page lets each tool use its own mode and per-task models/effort. All shows mixed settings as Custom and can apply one preset to every tool. Scope warnings protect individual and global replacements; the page generates one pinned command.
- Explicit release application supports safe upgrade/downgrade of owned settings; per-client receipts record the actual applied version and custom choices.
- Ownership/drift checks, private backups and rollback preserve unrelated settings and earlier user values.
- No custom hooks, proxy, plugin, launcher, daemon or normal-operation runtime is installed.

### Who should use it

People who want consistent subagent preferences across their installed coding tools. You can keep the recommendations or select different native models in the configuration page.

### Applying this version

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.1.0 agent-policy setup --release --apply
```

Without --apply the same command previews the changes. The page-generated explicit tool arguments apply the visible choices using this release's native templates. See [release usage](docs/guide/updates-and-removal.md).

### Migration and limits

This is the first public release. Synthetic versions in tests are not real releases. Experimental runtime receipts from older development commits require their original owned removal. Supported native snapshot formats can be updated safely; unknown future formats/layouts are refused.

Kimi/Antigravity concurrency guidance and native tier/precedence limits remain explicit. A pinned release reproduces declared configuration, not provider weights, entitlement or model quality.
