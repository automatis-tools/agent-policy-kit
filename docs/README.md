# Agent Policy Kit documentation

This index tells you which document answers your question. Each document covers one topic and can be read on its own. Documents are grouped by who reads them.

## Use APK

| Question | Document |
|---|---|
| How do I set up subagent roles for the first time? | [Getting started](guide/getting-started.md) |
| How does the configuration page work, and how do I share a setup? | [Configurator](guide/configurator.md) |
| Which commands, flags and output formats does the CLI have? | [Commands](guide/commands.md) |
| How do I write my own preferences file? | [Preferences](guide/preferences.md) |
| How do I update, downgrade, remove or recover a setup? | [Updates and removal](guide/updates-and-removal.md) |
| What does APK read and write, and what does it never send? | [Privacy](guide/privacy.md) |

An AI agent that installs APK for you follows the [AI operator guide](../AGENT_INSTALL.md).

## Look up facts

| Question | Document |
|---|---|
| What does APK write for each AI assistant, and what are the native limits? | [AI assistants](reference/assistants.md) |
| What do the six roles do, and which model does a subagent without a role use? | [Roles](reference/roles.md) |
| Which model and effort does each preset choose, and why? | [Presets](reference/presets.md) |
| Which models and effort levels does this release know? | [Model catalog](reference/model-catalog.md) |
| How does APK track its own settings, and what is drift? | [Ownership and state](reference/ownership.md) |

## Evidence

| Question | Document |
|---|---|
| What evidence supports the 0.4.0 presets? | [Model review of 2026-11-01](research/2026-11-01-model-review.md) |
| How was the limit illustration in the README measured? | [Limits evidence](research/limits-evidence.md) |

## Maintain APK

| Question | Document |
|---|---|
| How is the code organized? | [Architecture](maintainers/architecture.md) |
| How do I set up a development environment and run the tests? | [Development](maintainers/development.md) |
| How do I review models and presets for a release? | [Model review procedure](maintainers/model-review.md) |
| How do I prepare and publish a release? | [Release](maintainers/release.md) |
| How is the configuration page built and deployed? | [Website](maintainers/website.md) |
| What was verified for each release? | [Verification](maintainers/verification.md) |

Design decisions are recorded as dated documents in `docs/design/`. Release notes are in the [changelog](../CHANGELOG.md).
