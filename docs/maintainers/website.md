# Website

This document tells maintainers how the configuration page is built, how the hosted copy at https://agent-policy-kit.trymenow.io/ is assembled and deployed, and which guards and credentials the deployment uses. For how people use the page, see [configurator](../guide/configurator.md). For the release steps that start a deployment, see [release](release.md).

## The page file

`npm run build:site` runs `scripts/build-site.mjs` and writes `site/index.html`. This file is one self-contained HTML page. It has no backend, no telemetry and no external asset requests. It does not access a native account.

The build puts these items into `site/template.html`:

- The release data: version, presets, catalog, role definitions and release notes.
- The command codec `src/explicit.mjs` and the share-link codec `src/share.mjs`, without their `export` keywords.
- `site/base.css`, a snapshot of a shared base style. Its header names the source.
- The Public Sans font from `site/fonts/` as base64, and its license text.
- The limit illustration from `scripts/build-limits-chart.mjs`, and a link to [how it was measured](../research/limits-evidence.md).
- Author and project metadata from `package.json`.

Each marker must occur exactly once in the template, or the build fails. `npm run check` fails when `site/index.html` is stale.

## Release status on the page

When the changelog heading of the current version says `Unreleased`, the page shows `Release candidate · npm command available after publication.` After the release is cut, it shows `Configuration release VERSION`. [Release](release.md) describes when to change the heading.

## Metadata and footer

The `author` field in `package.json` supplies the visible byline, the page title, the author link and the static JSON-LD data for the person, the project and the page. The build requires an author name and an HTTPS profile URL. The `repository` and `homepage` fields must also be public HTTPS URLs.

The footer credits Mykola Maksymenko, links to his LinkedIn profile, and links to the related projects Agents Can Communicate and Automatis Skills. These links load only when a person follows them. The page has no social widgets and requests no metadata at runtime.

The canonical URL of a release page is `/v/VERSION/` on the homepage origin. The hosted root page uses the root URL as canonical.

## Motion

- Role and assistant changes use native View Transitions. With reduced motion, or without View Transitions, the update is immediate.
- A changed hint, step marker, scope label or mode caption keeps a soft highlight for 2 seconds and fades for 2 seconds (4000 ms in total).
- The collapsed "Why" section opens and closes in 200 ms and follows the reduced-motion setting.
- The page installs no animation dependency.

## Hosted site

`npm run build:host` runs `npm run build:site` and then `scripts/build-host.mjs`. The result is the `dist/` folder:

| Path | Content |
|---|---|
| `/` | The latest page, rendered from the current `main` with the root as canonical URL and the list of hosted releases |
| `/v/VERSION/` | `site/index.html` from each reachable release tag, copied byte for byte |
| `_headers` | Security headers: a strict Content Security Policy, `nosniff`, `no-referrer`, a restrictive Permissions Policy and `no-cache` |

Archived pages are not rebuilt with the latest template. A share link from an older release that opens on the root page redirects only to a known archived release on the same origin. A malformed link, a link to an unknown release and a link opened from a local file show an error and do not redirect.

The host build needs the full Git history with tags and anonymous access to the npm registry. It stops before it replaces `dist/` when a check fails:

| Code | Cause |
|---|---|
| `HOST_RELEASE_TAG_REQUIRED`, `UNRELEASED_HOST_CONFIGURATION` | The release guard. See [release](release.md) |
| `HOST_RELEASE_NOT_PUBLISHED` | npm does not serve the current version |
| `HOST_REGISTRY_UNAVAILABLE` | The registry did not answer after three attempts |
| `INVALID_HOST_RELEASE` | A tag has an invalid `package.json`, its version does not match the tag, or two tags name the same version |
| `UNSAFE_HOST_OUTPUT` | `dist/` contains an unknown file, an unknown folder or a symbolic link |
| `INVALID_HOST_PAGE` | The rendered page is empty |

## Automatic deployment

The workflow Deploy configurator (`.github/workflows/deploy-site.yml`) deploys `dist/` to an existing Cloudflare Worker. It starts after a successful Verify package run, or manually with `workflow_dispatch`.

1. The workflow runs only when the Verify package run is a push in this repository, on `main` or on a tag that starts with `v`.
2. It always checks out `main`, never the code of the triggering branch or tag.
3. `scripts/deploy-guard.mjs` checks the context. For a tag trigger, the tag must point to the triggering commit and be an ancestor of `origin/main`. The checked-out commit must be the latest `main`, and Verify package must have passed for that commit as a push on `main`.
4. The guard skips when the current version has no release tag. The run reports `Package version VERSION is not tagged and published yet.` and does not fail.
5. The workflow runs `npm run check` and `npm run build:host`.
6. It installs Wrangler 4.151.3 with lifecycle scripts disabled, before any credential is available.
7. `scripts/prepare-site-deploy.mjs` writes an asset-only Wrangler configuration. It accepts only the Worker name `agent-policy-kit` and the `./dist` folder, and it removes the routes.
8. The guard runs again immediately before the upload. A run for an older commit skips.
9. Wrangler uploads the assets.
10. `scripts/verify-hosted-site.mjs` fetches `/` and each `/v/VERSION/` over HTTPS and compares the bytes with `dist/`.

Deployments are serialized in the concurrency group `production-configurator`. A failed check before the upload keeps the current deployment. A mismatch after the upload fails the workflow and needs investigation.

A merged version bump does not deploy until its release is tagged. The tag push after the npm publication starts the deployment. See [release](release.md).

## Credentials

The GitHub environment `production` allows only the `main` branch. It has no required reviewers, so a merge needs no manual approval of the deployment.

The environment stores two encrypted secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`, with the permission Workers Scripts edit for the target account

The token needs no zone, DNS, KV or R2 permission, because the CI configuration excludes routing. Cloudflare can scope Workers Scripts edit to the account and not to one Worker. For this reason, the workflow fixes the Worker name and runs only trusted `main` code.

Use a separate deployment token. Do not store the interactive Wrangler OAuth token or refresh token in CI. Keep the token value out of Git, npm, logs and artifacts. Pull request test jobs get no Cloudflare secrets.

## Domain changes

The domain route `agent-policy-kit.trymenow.io` is in `wrangler.jsonc`. The workers.dev address stays enabled for earlier links. CI never changes routing. Make a domain-only change as a separate infrastructure operation with `wrangler triggers deploy`, and compare the deployment and version IDs before and after.

## Retry

Use the manual run of Deploy configurator on `main` in these cases:

- A service failed for a short time.
- The tag push ran before npm served the version.

The workflow never merges a pull request, creates a tag or publishes an npm package.
