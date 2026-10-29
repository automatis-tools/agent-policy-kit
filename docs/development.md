# Development

Use Node.js 22.x (22.13+) or 24+ and npm. No build step is required.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run test:unit
npm run test:package
```

npm test includes both unit tests and the installed-tarball gate. The gate needs macOS sandbox-exec or Linux bubblewrap. It must actually deny checkout access; unavailable isolation fails rather than skipping. Use a normal approved host if a managed sandbox forbids nesting.

src/policy.mjs validates shared preferences. src/detect.mjs probes executable identity. Native generation and the installer write ordinary role/config/instruction files. src/setup.mjs coordinates detected clients; bin/agent-policy.mjs exposes JSON configuration commands.

Test with temporary homes. Preserve existing transaction, complete-read-set, rollback, ownership, symlink and privacy checks. The package gate must remove the npm package after setup and verify standalone native configuration consumers still read files with no dependency on package/source/state. Consumer fixtures are not actual native model execution.

Do not reintroduce hooks, wrappers, plugins, daemons, runtime audits or package paths in generated settings. Receipts/backups belong only to configuration operations. See [support](compatibility.md), [verification](verification.md) and [release preparation](npm-release.md).
