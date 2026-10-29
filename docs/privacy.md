# Privacy

No classifier, proxy or telemetry service receives task text. The kit does not provision or transmit account credentials. Client configuration backups can contain existing secrets; backups are private local files and must never be published.

CLI audit has a field allowlist. It excludes prompts, commands, full tool input/output, working directories, transcripts and raw session/agent IDs. Session and agent identifiers are not stored. Unrecognized role/model strings are masked rather than echoed. Exported diagnostics use fixed error codes.

`audit --public` aggregates records and removes activity timestamps. It is safer to share than private records, but review any material before publication. Missing token counts are `null`, not a claim of zero usage. Recorded tokens do not determine subscription charges.

The optional Claude mod uses the host's private store, bounded samples and its own command export. It does not promise a complete durable ledger. A caller-supplied `record` is labelled caller-supplied, not provider-verified proof.

The CLI journal has no automatic rotation. Reading/exporting is bounded to 16 MiB. Before that limit, an operator agent can stop active writers and move audit.jsonl into a private archive; the next hook creates a fresh file. Retain archives only as long as needed. Do not publish them or rotate while hooks are writing.

The npm package uses a files allowlist. Development notes, artifacts, live logs, user paths and test outputs stay outside the distributable. `npm run check` inspects package contents; the acceptance gate installs a real tarball in fresh profiles and denies source access.
