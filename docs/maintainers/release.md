# Release

This document tells maintainers how to prepare, verify and publish a configuration release of Agent Policy Kit (APK). It also explains why a change to presets or to the catalog needs a new version and how the separate website consumes it. For the review of models and presets before a release, see the [model review procedure](model-review.md). For website ownership and updates, see [website](website.md).

## Rules

- One package version is one configuration release. [Architecture](architecture.md) lists what a release contains.
- The owner authorizes each publication. Nothing publishes automatically.
- New pull requests stay draft. Only the owner merges them.
- Publish only from reviewed commits that are already on `main`.
- Never rewrite a published version. See the [npm publication rules](https://docs.npmjs.com/cli/v11/commands/npm-publish/).

## Choose the version

| Change | Version |
|---|---|
| A correction of documentation or a configuration bug | Patch |
| An intentional change of a recommendation, for example a preset value | Minor, with release notes that describe it |
| An incompatible change of native ownership, layout or IDs | A documented migration boundary. Below 1.0, a minor version marks it (0.3.0 did this for the renamed assistant IDs) |

## Why a preset or catalog change needs a new version

The pinned command `agent-policy-kit@VERSION` installs the presets and catalog of that immutable npm package. The website pins the same exact package as a build dependency, so editing an unpublished checkout cannot change its recommendations or generated command.

Publish a new version for configuration changes. After publication, update the website's exact dependency and lockfile in a separate draft PR. Interface-only changes belong to the website and do not require an APK release.

## Prepare the release

Do these steps on a branch. Open a draft pull request.

1. Review models and presets as the [model review procedure](model-review.md) describes.
2. Set `version` in `package.json` and in `package-lock.json`.
3. Set `homepage` in `package.json` to `https://getacc.dev/agent-policy-kit/`.
4. Update the preset files, the catalog and its `reviewedAt` date as needed.
5. Add the changelog entry with the heading `## VERSION — Unreleased`.
6. Update the pinned commands (`agent-policy-kit@VERSION`) in `README.md`, `AGENT_INSTALL.md` and the documents in `docs/` that contain them.
7. Run `npm run check` and `npm test`. See [development](development.md).

Merging this pull request does not publish npm or deploy a website.

## Write the changelog entry

Each entry in `CHANGELOG.md` records these items:

- The date. Write it when you cut the release.
- Why this release exists.
- Who should update.
- Changed models, efforts and role instructions, and why they fit the work.
- Native client requirements.
- Migration and rollback limits.
- The catalog date and sources.

Keep configuration checks separate from model-quality evaluation. Do not claim performance or cost numbers without evidence.

## Cut the release

Do these steps on a second branch, `release/VERSION`. Open a draft pull request.

1. Change the changelog heading to `## VERSION — YYYY-MM-DD`. Complete the notes.
2. Add the verification record for this version to [verification](verification.md).
3. Run `npm run check` and `npm test`.

The owner merges this pull request.

## Verify before publication

Do these steps on the merge commit on `main`.

1. Fetch `origin`.
2. Run `git merge-base --is-ancestor HEAD origin/main`. It must succeed.
3. Review `npm pack --dry-run --json --ignore-scripts`.
4. Review `npm publish --dry-run --ignore-scripts`.
5. Make the final tarball with `npm pack`. Record its integrity.
6. Make sure that the package contains no private evidence and no configuration from a real account.

The package contains `CHANGELOG.md`, the native configurator and its public release data. It contains no web interface. No lifecycle install script changes native settings.

## Publish

Do these steps only after the owner explicitly authorizes the publication.

1. Publish the exact reviewed tarball through the normal authenticated npm process.
2. Create the tag `vVERSION` on the reviewed `main` commit and push it.
3. Create the GitHub release with the reviewed changelog text.

Publish to npm before you push the tag. The tag identifies the reviewed immutable package release; it does not deploy a website. Update the website's dependency separately after publication, as [website](website.md) describes.

## Check the result

1. Check that the npm registry serves the version with the expected contents.
2. If the website is being updated, verify its dependency pin and generated command against the published version after the owner merges its separate PR.
3. Check the links in the published README.

Do not merge, mark a draft ready or enable auto-merge as part of a release.
