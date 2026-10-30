# Agent Policy Kit

```mermaid
flowchart LR
    Roles("1. Choose subagent roles") --> Tools("2. Choose your coding tools")
    Tools --> Models("3. Choose models and effort")
    Models --> Command("4. Run one setup command")
    Command --> Done("Native configs saved<br/>APK exits")
    classDef default fill:#f5f7fb,stroke:#e0e5ed,color:#19283e
    classDef action fill:#3158c3,stroke:#3158c3,color:#ffffff
    class Command action
```

**Give different jobs different models.** Use capable models for coding and review, and lighter ones for search and routine work, without editing each tool’s config by hand.

APK configures native subagent roles for Codex, Claude Code, Kimi and Antigravity. Choose roles, models and effort. Run one command to configure your installed tools. APK writes native settings, then exits.

**Your main agent stays in charge.** It decides when to delegate; its model stays unchanged. APK runs no background process during your coding sessions.

## Choose your setup

Open the [configuration page](https://agent-policy-kit.maksymenko-ml.workers.dev/v/0.1.0/) in your browser. Choose roles and coding tools, keep a preset or adjust each role, then copy the fully expanded setup command. The page address saves your visible choices for sharing. APK creates only the selected roles in installed, selected tools.

The [bundled page](site/index.html) also works offline. APK has no proxy, background process or runtime during your normal coding sessions. You can remove the npm package afterward.

## Use a specific release's defaults

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.1.0 agent-policy setup --release --apply
```

Omit --apply to preview. Each version includes its own presets, instructions and configuration page. [Release notes](CHANGELOG.md) explain what changed and why; [release usage](docs/releases.md) covers upgrade and downgrade.

Prefer your AI agent to handle installation or removal? Give it the [AI operator guide](AGENT_INSTALL.md).

[Model catalog](docs/model-catalog.md) · [Support](docs/compatibility.md) · [Model updates](docs/model-updates.md) · [Privacy](docs/privacy.md) · [Verification](docs/verification.md)

Node.js 22.x (22.13+) or 24+; macOS/Linux. Version 0.1.0. MIT licensed.
