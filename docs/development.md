# Development

Use Node.js 22.x (22.13+) or 24+ and npm. No build step is required.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run test:cache
npm run check
npm run test:unit
npm run test:package
```

Enable the contributor pre-push check once per clone:

```sh
git config core.hooksPath .githooks
```

The hook runs npm run check and npm run test:unit before each push that updates a branch or tag. A push that only deletes refs skips both. The hook is not packaged and is unrelated to generated client settings. The packed-package gate runs in CI, and CI also requires the Lint check.

npm run test:cache primes public dependency metadata on a fresh machine before the offline tarball consumers run. It installs only into a disposable directory and removes it afterward. npm ci alone may cache tarballs without the registry metadata required by a new offline consumer.

Detection checks desktop app bundles under /Applications. Set AGENT_POLICY_APPLICATIONS_DIR to another absolute directory to replace /Applications. The tests set it, so apps installed on the host do not change their results.

npm test includes both unit tests and the installed-tarball gate. The gate needs macOS sandbox-exec or Linux bubblewrap. It must actually deny checkout access; unavailable isolation fails rather than skipping. Use a normal approved host if a managed sandbox forbids nesting.

src/policy.mjs validates shared preferences. src/detect.mjs probes executable identity. Native generation and the installer write ordinary role/config/instruction files. src/setup.mjs coordinates detected clients. src/inspect.mjs reads bounded native subagent fields without writes or executable probing. src/output.mjs formats readable terminal results. bin/agent-policy.mjs retains captured JSON output and supports explicit --json.

Test with temporary homes. Preserve existing transaction, complete-read-set, rollback, ownership, symlink and privacy checks. The package gate must remove the npm package after setup and verify standalone native configuration consumers still read files with no dependency on package/source/state. Consumer fixtures are not actual native model execution.

Do not reintroduce hooks, wrappers, plugins, daemons, runtime audits or package paths in generated settings. Receipts/backups belong only to configuration operations. See [support](compatibility.md), [verification](verification.md) and [release preparation](npm-release.md).
