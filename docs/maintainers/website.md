# Website ownership

The configurator is part of [getacc.dev](https://getacc.dev/tools/agent-policy-kit/). Its source, styling, share-link codec, illustrations, article manuscripts, browser behavior tests and deployment belong to the separate ACC website repository. APK no longer builds, packages or deploys HTML.

## Release data and commands

The website pins an exact published `agent-policy-kit` npm dependency. At build time it reads that package's release data, presets, catalog, role definitions and explicit-command codec. Its build refuses an installed package version that differs from the pin. Generated commands use that same package version. The browser does not query npm or run a CLI command.

`src/explicit.mjs` remains the CLI-owned command contract. Changes to this contract need compatible website tests against the published version. UI and sharing changes belong to the website and do not require a new APK publication.

## Update the website

1. Publish a verified APK version only after the owner explicitly authorizes that version. Follow [release](release.md).
2. In the website repository, update the exact npm dependency and lockfile.
3. Run its check, test, build and Workers dry-run gates. The form tests check generated commands against the pinned package.
4. Open a draft PR in that repository. The owner controls merging; successful main pushes use its existing deployment pipeline.

The website uses the shared Astro frame, navigation, typography, author metadata and discovery. The [Claude Code article](https://getacc.dev/guides/claude-code-subagent-limits/) is reviewed Markdown in its Guides collection.

## Migration boundary

The owner declined compatibility with the old standalone domain, `/v/` archives and existing share URLs. New links use `/tools/agent-policy-kit/` on getacc.dev. The npm package has no local configurator HTML. Previously published npm versions and Git tags are immutable.

The old Worker/domain is not changed manually by this source migration. Its deployment workflow is retired; unrelated domain changes require a separate infrastructure request. No automatic package publication, merge or manual deployment is introduced.
