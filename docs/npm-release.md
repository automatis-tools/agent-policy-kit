# Prepare an npm release

This repository is prepared for agent-policy-kit 0.1.0. Nothing here publishes automatically. The owner creates the public repository and authorizes publication separately.

## Before packing

1. Use a clean branch. Add the actual public repository/bugs/homepage URLs to package.json once they exist. Do not invent them.
2. Confirm ownership or availability of the npm name. A previous anonymous 404 is not a reservation. If the name changes, update package metadata, plugin identity, install guide and README CDN URLs together.
3. Keep package.json, package-lock.json, plugin manifest, changelog and versioned README links aligned.
4. Run the commands in [development](development.md), including native Claude checks when available. Review [capabilities](compatibility.md) and [verification](verification.md). Record actual versions and results.

## Review the distributable

```sh
npm pack --dry-run --json --ignore-scripts
npm run test:package
npm publish --dry-run --ignore-scripts
npm pack --ignore-scripts
```

Inspect the listed files, tarball size and integrity. The files allowlist ships only runtime code, policy/schema/examples, plugin entry points and documentation. Tests, editor files, private profiles and development evidence must stay out. No lifecycle install script changes client settings.

The acceptance gate installs a real tarball, removes its build snapshot and denies the consumer access to the source checkout. It uses isolated homes and fixture client identities; it does not claim live provider calls. Preserve a redacted release result outside the package.

## Install before publication

Use the tarball path from npm pack in the [operator guide](../AGENT_INSTALL.md) instead of agent-policy-kit@0.1.0. Keep a stable prefix; generated hooks contain installed paths. Uninstall integrations before removing that prefix.

The README diagram is inline Mermaid, with no external image dependency. Its viewer must support Mermaid rendering. The operator guide uses a versioned unpkg link that becomes available after publication; the guide is also inside the tarball for local use.

## Publication boundary

Publication is a separate owner-authorized step. Use npm's normal authenticated release process and account controls. Do not place registry tokens in this repository or create them for tests. This project has no publish workflow, remote creation or automatic merge. After an authorized release, verify the registry tarball and README asset URLs, then update the verification record.
