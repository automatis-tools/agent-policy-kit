# Choose and apply a configuration release

**APK package version = configuration release.** Each published package freezes its named presets/model catalog/efforts, native role templates, instructions, changelog and static configuration page. There is no second preset-version system.

## Default settings from a specific release

After publication, inspect the release and preview its plan:

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.1.0 agent-policy release
npx --yes --ignore-scripts --package agent-policy-kit@0.1.0 agent-policy setup --release
```

Apply explicitly:

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.1.0 agent-policy setup --release --preset balanced --apply
```

The package you select supplies both preferences and native templates. --release is a boolean, not another version argument. --preset selects fast/balanced/quality; its identity is stored alongside release/source. The same pattern selects an older compatible release for downgrade. Installing/updating an npm package alone does not change native files. Before publication, use that release's verified .tgz instead of the registry package spec.

## Your own choices

Open this release's [configuration page](../site/index.html) in Google Chrome. Its fully expanded per-tool command is pinned to the page's package version. It applies your chosen models through that release's templates. Generated explicit commands record custom provenance, including when the form used a preset. The --release workflow retains named preset provenance.

--config is bounded canonical base64url UTF-8 JSON. It is data, not executable shell content. Explicit tool arguments, --release/--preset, --config and --policy are alternative input modes. Explicit arguments, --config and --release permit replacement of owned configuration. --policy without those options remains conservative for advanced saved-file workflows.

## What happens during an update

APK verifies old owned files, reconstructs the original user baseline in memory, renders the target, and commits one final change per file. There is no physical uninstall gap. Native prerequisites and drift refuse changes; late failure rolls back the previous installed release. Later unrelated user edits survive. Final uninstall restores original user values rather than the previous APK version's values.

Transactions are per client. Missing, unsupported or blocked clients retain their actual previous release; successful independent clients may advance. setup results and doctor report each client's applied version/source. The shared state policy is the latest requested snapshot, not proof every client applied it. Doctor verifies receipts without needing that snapshot or today's templates.

Current native receipt v4 records the selected subset of four bounded role filenames. Native v3 and v2 snapshots remain supported. v2 has unknown release provenance. An older executable can reject v4. Use a receipt-compatible executable before an incompatible downgrade. Unknown future schemas/layouts are refused. An incompatible migration must explain its supported path in that release's notes.

## What a release does not freeze

A release reproduces declared settings and templates. Provider aliases/tiers can resolve to new models, old model IDs can retire, and account access can change. See [model maintenance](model-updates.md). No runtime updater or model gateway is installed.

Read [CHANGELOG](../CHANGELOG.md) for what changed, why, who should update and migration limits. Version 0.1.0 is currently an unreleased local candidate; synthetic versions in acceptance tests are not real releases.
