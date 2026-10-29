# Agent Policy Kit

![Your main agent delegates work; Agent Policy Kit checks your policy, routes supported launches to an allowed model or blocks them, and keeps metadata evidence.](https://unpkg.com/agent-policy-kit@0.1.0/docs/assets/overview.png)

Keep coding subagents on the models you choose.

The kit detects installed coding agents, applies a shared local policy, and records metadata about supported subagent launches. Your main chat model stays unchanged. No new account or API key is needed.

## Let your AI agent install it

Give your agent this request:

> Read the [AI installation and removal guide](https://unpkg.com/agent-policy-kit@0.1.0/AGENT_INSTALL.md). Install Agent Policy Kit for the coding agents actually present on my machine, verify the result, and report any client-imposed limits.

The guide is also included as [`AGENT_INSTALL.md`](AGENT_INSTALL.md) in the package. An installed CLI can print it with `agent-policy instructions`.

For removal, ask the same agent to follow that guide and remove the kit's integrations. It will preserve unrelated settings.

## What you get

- Automatic detection from working CLI executables, not stale config folders.
- A shared model policy, with native checks where supported.
- Non-interactive JSON plans/results, backups, safe uninstall and drift checks.
- Metadata-only audit; missing model/token evidence stays unknown.

Support and activation differ by client; see the [capability matrix](docs/compatibility.md). The kit reports limits and missing evidence explicitly.

Node.js 22.x (22.13+) or 24+; macOS/Linux settings installation. No classifier, proxy, or telemetry endpoint.

## More detail

[Use cases](docs/use-cases.md) · [Capabilities](docs/compatibility.md) · [Privacy](docs/privacy.md) · [Verification](docs/verification.md) · [Development](docs/development.md) · [npm release](docs/npm-release.md)

Version 0.1.0 is being prepared for npm; the registry/CDN links become available after publication. Use the packed local tarball before then.

MIT licensed. Independent of the client vendors.
