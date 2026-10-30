# Prepare a configuration release

One version: package.json version identifies presets, model catalog, native templates, instructions and page. No second preset-version system. The owner authorizes each publication; nothing publishes automatically. New pull requests must remain draft, and only the owner merges them.

## Record what and why

For every release, update CHANGELOG.md with: date, changed models/efforts/role instructions, why the changes fit the work, who should update, native/client requirements and migration/rollback limits. Record catalog source/date and distinguish configuration checks from model-quality evaluation. Do not claim performance/cost numbers without evidence.

Patch releases can correct documentation/configuration bugs; intentional recommendation changes deserve clearly described release notes (normally a minor release); incompatible native ownership/layouts require a documented migration boundary. Never rewrite a published version. See [npm publication rules](https://docs.npmjs.com/cli/v11/commands/npm-publish/).

## Build and verify before tagging

1. Confirm npm name ownership and set actual repository/bugs/homepage URLs once they exist. Do not invent them.
2. Update package version and lockfile, preset JSON, model catalog/source date and this version's changelog entry. Fill the actual release date when cutting it.
3. Run npm run build:site. The generated single HTML file embeds that version's exact data and command.
4. Run npm run check and npm test. Required tarball gates deny source access, remove package/state, and prove two synthetic versions can upgrade/downgrade changed models AND templates safely. Synthetic 0.2.0 is not a real release.
5. Review npm pack --dry-run --json --ignore-scripts, npm publish --dry-run --ignore-scripts, and the final npm pack tarball/integrity. Private evidence/configs must stay out.

The package includes CHANGELOG.md and its matching page. Its CLI requires no compilation; only the page data is regenerated. No lifecycle install script mutates native settings.

After explicit publication authorization, create the corresponding git version tag/release with the reviewed changelog text and publish that exact tarball through npm's normal authenticated process. Publish application and npm releases only from reviewed commits already present in main. Before publication, fetch origin and require git merge-base --is-ancestor HEAD origin/main to succeed. Never merge, mark a draft ready or enable auto-merge. Recheck registry contents and public page links after an authorized release.

## Static page

The latest site deploys automatically from reviewed main after CI, while each published /v/VERSION/ page remains an exact tagged snapshot. npm publication stays explicit. See [website deployment](deployment.md) for configuration guards, archive preservation, credentials and main-only retry.

The public domain is https://agent-policy-kit.trymenow.io/. The workers.dev address remains available for earlier links. Domain-only infrastructure changes use wrangler triggers deploy and compare deployment/version IDs before and after. CI website deployment deliberately omits routing changes and does not publish npm packages.
