# Privacy

The configurator reads local preferences and native configuration, probes CLI version/help identity, writes owned native settings and exits. It does not read transcripts or send prompts to a classifier, proxy or telemetry endpoint. It does not provision or transfer credentials.

Client settings can contain existing secrets. Transaction backups and receipts are private local state and must never be published. CLI summaries omit configuration bodies, raw executable output, private paths and raw errors.

There is no runtime audit, session tracking or token journal. Normal agent operation does not call package code. Native clients retain their own provider/account behavior.

The npm package uses a files allowlist. Tests, development notes, private profiles, evidence and tarballs stay outside it. The acceptance gate uses fresh profiles with fake secret sentinels and denies source access. Fixtures do not establish live account or provider execution.
