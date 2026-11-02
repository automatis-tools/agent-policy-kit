# Changelog

Each npm version is one configuration release: its presets, native role definitions, instructions and configuration page. Published versions are not rewritten. Applying another release is explicit; package installation alone changes no settings.

## 0.4.0 — Unreleased

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
