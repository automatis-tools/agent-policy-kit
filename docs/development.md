# Development

Use Node.js 22.x (22.13+) or 24+ and npm. There is no build step.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run test:unit
npm run test:package
```

The package gate requires macOS sandbox-exec or Linux bubblewrap (`sudo apt-get install bubblewrap` on a suitable Linux host). It must actually deny source access; unavailable isolation is a failure, not a skip. In a managed sandbox that forbids nesting, run this gate on a normal local host through its normal approval mechanism.

If Claude Code is installed, also run its native checks:

```sh
claude plugin validate . --json --strict
npm run test:claude
```

These checks do not send a model prompt. Do not change real client settings for tests; use temporary homes. Public install refuses a checkout unless --dev is explicit. Prefer a packed consumer installation even during development.

## Where to read

- `src/policy.mjs`: pure validation and decisions.
- `src/adapters.mjs`, `src/bindings.mjs`: native protocols and supported local bindings.
- `src/detect.mjs`, `src/setup.mjs`: executable probes and unattended setup.
- `src/install.mjs`, `src/toml.mjs`: owned configuration edits and rollback.
- `src/audit.mjs`: one private metadata journal.
- `hooks/register.mjs`: optional native Claude mod.
- `bin/agent-policy.mjs`: CLI composition.

One runtime dependency parses TOML for surgical edits and native binding checks. The evaluator, hook adapter and Claude mod do not require it. Keep this structure small; add a feature only for a concrete client capability or an observed defect.

## Evidence

`npm test` runs the Node suite including the tarball gate. CI is defined for macOS and Linux; a workflow file is not evidence of a hosted run. See [verification](verification.md) for recorded local outcomes. Keep logs and private profiles outside Git and npm.

## Native contracts

Recheck the installed client and official documentation when updating an adapter:

- [Codex hooks](https://developers.openai.com/codex/hooks).
- [Claude Code hooks](https://code.claude.com/docs/en/hooks); the installed native plugin validator/test runner is the mod contract check.
- [Kimi configuration](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/configuration/config-files.md) and [tool reference](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/reference/tools.md).
- [Antigravity subagents](https://antigravity.google/docs/subagents?tab=cli).

Hooks are local controls, not provider billing or security guarantees. Do not turn requested model IDs into claims about provider execution.
