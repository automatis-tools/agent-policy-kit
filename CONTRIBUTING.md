# Contributing

This document is for people who change the code or the documentation of Agent Policy Kit (APK). It gives the rules for a change. For setup, tests and hooks, read [development](docs/maintainers/development.md). For native files and limits per assistant, read [assistants](docs/reference/assistants.md).

## Scope of the tool

APK is a one-shot configurator that writes native files only. Do not add a custom runtime: no hook, wrapper, plugin, daemon, proxy or runtime audit. The native configuration must keep working after the npm package, the source and the APK state are removed.

## Code changes

1. For a behavior change, add a failing regression test first.
2. Make the smallest fix.
3. Run the unit tests and the installed-tarball tests. See [development](docs/maintainers/development.md).
4. Test with temporary home directories. Preserve unrelated settings.
5. Open the pull request as a draft. Only the owner merges.

Report configuration and parser evidence separately from native loading and provider execution.

## Documentation changes

- Every fact has one canonical document. Other documents link to it and do not repeat it. A short summary with a link is permitted where the reader needs the context.
- Put a document in the folder of its audience: `docs/guide/` for people who use APK, `docs/reference/` for facts about assistants, roles, presets, the catalog and ownership, `docs/research/` for the evidence behind presets, and `docs/maintainers/` for development, releases and the website. [The documentation index](docs/README.md) lists all documents.
- Start each document with a title and a short paragraph that tells what it covers and who it is for.
- Write in English with short sentences, active voice and present tense. Define a term when you use it the first time.
- Packaged documents can link only to packaged files. `npm run check` rejects other relative links.
- Keep the README short and the [AI operator guide](AGENT_INSTALL.md) precise.

## Private data

Never commit or publish private configurations, credentials, backups, raw logs, account data or user paths.
