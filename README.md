# Agent Policy Kit

```mermaid
flowchart LR
    subgraph Setup["1. Install and configure on your computer"]
        Kit["Install Agent Policy Kit<br/>Local npm package"] --> Rules["Configure your coding tools<br/>Model rules and local checks"]
    end
    subgraph Work["2. Work in your existing coding tool"]
        Main["Your main agent"] -->|Delegates work| Check["Local rule check<br/>At supported launches"]
        Check -->|Allowed| Sub["Tool starts its subagent"]
        Check -->|Denied| Block["Launch blocked"]
    end
    Rules -.-> Check
    Sub --> Provider["Tool contacts its usual<br/>model provider directly"]
```

**A local npm tool that sets model rules for your coding agent's helpers.**

Install the package, then ask your AI agent to configure the coding tools already on your computer. The rules apply to their **subagents**: helpers that handle delegated work.

During use, your coding tools invoke the kit's local checks before supported subagent launches. **Keep the package installed** so those checks can run.

Your tools send model requests directly to their usual providers, using your existing accounts. Your main conversation keeps its model. Some features require the supplied launcher; the [setup guide](AGENT_INSTALL.md) covers this for your agent.

## Why use it?

- **Match models to the job.** Use a capable model for code and review, a light model for file searches, and rule out unwanted models.
- **Keep your choices consistent.** Maintain one set of rules across your installed coding tools.
- **Keep control of your setup.** Detect existing tools, preserve unrelated settings, and remove integrations when you choose.

Works with **Codex, Claude Code and Kimi**. [Support varies by tool](docs/compatibility.md); exact-model control for Antigravity (agy) is currently unsupported.

## Ask your agent to set it up

Share this repository with your coding agent and ask:

> Follow [AGENT_INSTALL.md](AGENT_INSTALL.md). Install Agent Policy Kit for the coding tools present on my computer. Use the balanced policy, verify what is active, and report anything unsupported.

Your agent handles setup and checks using your existing tools and accounts. For removal, ask it to follow the same guide.

Version 0.1.0 is a local release candidate. The guide covers local tarballs and npm releases.

## What to expect

Checks run locally and cover supported launches. Your provider controls model access, usage limits and billing. See [verified results](docs/verification.md) for what has actually been tested.

Requires macOS or Linux and Node.js 22.x (22.13+) or 24+.

[Examples](docs/use-cases.md) · [Support and limits](docs/compatibility.md) · [Privacy](docs/privacy.md) · [For contributors](docs/development.md) · [npm release](docs/npm-release.md)

MIT licensed. Independent of the client vendors.
