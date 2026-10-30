# Changelog

Each npm version is one configuration release: its presets, native role definitions, instructions and configuration page. Published versions are not rewritten. Applying another release is explicit; package installation alone changes no settings.

## 0.1.0 — Unreleased

### Why this release

Use a common approach to optional delegation across Codex, Claude Code, Kimi and Antigravity, without an extra process in normal agent operation. Configure once and remove the installer afterward.

### What it configures

| Work | Codex default | Claude Code default | Kimi default | Antigravity default |
|---|---|---|---|---|
| Code and review | gpt-6.1-sol, high | sonnet, high | kimi-code/k3, high | Pro tier |
| Search and routine | gpt-6-luna, high | haiku, high | kimi-code/kimi-for-coding, low | Flash tier |

These are starting preferences, not model-quality benchmarks. Native model formats and alias behavior were reviewed against the official sources linked in [support](docs/compatibility.md) and [model maintenance](docs/model-updates.md). Model availability must be checked before applying. Provider aliases and tiers may resolve differently over time.

### Presets and model catalog

Fast & economical uses light models/tiers with lower supported effort. Balanced splits capable code/review from lighter discovery work. Quality first uses capable choices across the roles. All remain editable; labels are priorities, not measured cost/quality guarantees.

The release contains a dated model/effort catalog from official documentation and native selector observations, including native-default effort and account-dependent availability. Antigravity role choices are native tiers, with no invented per-role effort setting.

Catalog audit, 2026-10-30 UTC: Kimi now lists all six current models, including K3.1 Pro and Pro Highspeed. Quality first uses regular K3.1 Pro at high effort; Balanced and Fast retain their existing choices. Highspeed remains optional because its faster output consumes about twice regular Pro's quota, according to Kimi. Setup requires provisioned access and does not silently fall back to another model.

Both Pro variants require compatible thinking settings. Even with unpinned effort, setup refuses an explicit thinking-disabled setting without modifying it.

Codex effort choices/defaults now follow CLI 0.166.0 rather than API defaults; API metadata remains separate, and Ultra stays separate from ordinary effort. Claude Opus 4.5 no longer advertises an API-only native effort override. Existing custom inputs using levels outside the current native catalog require review before reapplication; owned inspection/removal remains independent of current recommendations. Sonnet 4.5 remains selectable with its Anthropic deprecation status marked. Antigravity CLI's four tier choices are unchanged.

### What changed

- Native role files and routing instructions apply only when the main agent chooses delegation. Main models and disabled delegation features are preserved.
- A static page lets you choose models/effort separately for code, review, search and routine tasks, then generates one pinned command.
- Explicit release application supports safe upgrade/downgrade of owned settings; per-client receipts record the actual applied version and custom choices.
- Ownership/drift checks, private backups and rollback preserve unrelated settings and earlier user values.
- No custom hooks, proxy, plugin, launcher, daemon or normal-operation runtime is installed.

### Who should use it

People who want consistent subagent preferences across their installed coding tools. You can keep the recommendations or select different native models in the configuration page.

### Applying this version

After publication:

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.1.0 agent-policy setup --release --apply
```

Without --apply the same command previews the changes. The page-generated --config command applies custom choices using this release's native templates. See [release usage](docs/releases.md).

### Migration and limits

This is the first public-release candidate; nothing has been published yet. Synthetic versions in tests are not real releases. Experimental runtime receipts from older development commits require their original owned removal. Supported native snapshot formats can be updated safely; unknown future formats/layouts are refused.

Kimi/Antigravity concurrency guidance and native tier/precedence limits remain explicit. A pinned release reproduces declared configuration, not provider weights, entitlement or model quality.
