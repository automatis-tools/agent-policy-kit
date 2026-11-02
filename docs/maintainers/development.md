# Development

This document tells maintainers and contributors how to set up the repository, run the checks and tests, enable the pre-push hook, and meet the sandbox requirement of the package tests. For the module structure, see [architecture](architecture.md).

## Requirements

- Node.js 22.x (22.13 or later) or 24 and later. The `engines` field in `package.json` sets this range.
- npm.
- For the package tests: `sandbox-exec` on macOS or bubblewrap (`bwrap`) on Linux.

The CLI has no build step. Only the configuration page is generated.

## Set up a clone

1. Install the dependencies without lifecycle scripts:

   ```sh
   npm ci --ignore-scripts --no-audit --no-fund
   ```

2. Prime the dependency cache for the offline package tests:

   ```sh
   npm run test:cache
   ```

3. Enable the pre-push hook once per clone:

   ```sh
   git config core.hooksPath .githooks
   ```

`npm run test:cache` installs the dependencies into a temporary directory and removes it after. On a new machine, `npm ci` can cache the tarballs without the registry metadata that a separate offline consumer needs. This step adds that metadata.

## Checks and tests

| Command | What it does |
|---|---|
| `npm run check` | Validates `policies/balanced.json`, checks the JavaScript syntax in `src/`, `bin/` and `scripts/`, rejects a stale `site/index.html`, and inspects the package contents |
| `npm run test:unit` | Runs every test file whose name does not contain `package` |
| `npm run test:package` | Runs the installed-tarball tests (`test/*package*.test.mjs`) |
| `npm test` | Runs all tests, unit and package |
| `npm run build:site` | Regenerates `site/index.html` |

`npm run check` also rejects package files that are larger than 1 MiB, test files, archives, private folders, user home paths and token-like strings. It checks that every relative link in a packaged Markdown file points to a packaged file. For this reason, packaged documents do not link to `scripts/`, `test/`, `.github/` or `.githooks/`. Write those paths as code.

Run `npm run build:site` after a change to the page template, `site/base.css`, the role definitions, the command codec, the version, the presets, the catalog or the changelog.

## Package tests and the sandbox

The package tests pack the real tarball, install it in a temporary consumer and run it with access to the source checkout denied. They use `sandbox-exec` on macOS and bubblewrap on Linux. If neither is available, the tests fail. They never skip.

A managed sandbox can forbid a nested sandbox. In that case, run the package tests on a normal host that the owner approves.

The package tests also check these results:

- Setup works with the package, the source and the state removed after setup, and standalone consumers still read the native files.
- Two synthetic versions upgrade and downgrade changed models and templates safely. A synthetic version is a test fixture, not a release.

Consumer fixtures read files. They do not prove that a native client loads the files or that a model runs.

## Test environment

- Use temporary home directories. Do not touch the real home directory.
- Detection looks for desktop app bundles in `/Applications`. Set `AGENT_POLICY_APPLICATIONS_DIR` to another absolute directory to replace it. The tests set this variable, so apps on the host do not change the results.
- `AGENT_POLICY_HOME` sets the state directory. The default is `~/.agent-policy-kit`.
- Keep the existing checks for transactions, the complete read set, rollback, ownership, symbolic links and privacy.

## Pre-push hook

`.githooks/pre-push` runs `npm run check` and `npm run test:unit` before each push that updates a branch or a tag. A push that only deletes refs skips both. The hook stops with a message if `node_modules` is missing.

The hook is not packaged. It is a contributor check and has no relation to the settings that APK generates.

## Continuous integration

| Workflow | Trigger | Jobs |
|---|---|---|
| Verify package (`ci.yml`) | Every push and pull request | `test` on macOS with Node 22.13.0 and on Ubuntu 22.04 with Node 24 runs `npm run test:cache`, `npm run check` and `npm test`. `site-build` runs after `test`. When the version has a `v` tag, it builds the hosted site and checks the upload with a Wrangler dry run, without credentials |
| Lint (`lint.yml`) | Pull requests and pushes to `main` | `Lint` runs `npm run check` |
| Deploy configurator (`deploy-site.yml`) | After Verify package, or manual | See [website](website.md) |

The `main` ruleset requires the `Lint` check.

## What not to add

Do not add hooks, wrappers, plugins, daemons, runtime audits or package paths to generated settings. Receipts and backups belong only to configuration operations.

## Related documents

- [Release](release.md): prepare and publish a configuration release.
- [Verification](verification.md): the evidence record for each release.
- [Assistants](../reference/assistants.md): native files and limits per assistant.
