# Agent Policy Kit

Created and maintained by [Mykola Maksymenko](https://www.linkedin.com/in/nick-maximenko/).

**Stop subagents from burning your plan limits.** APK gives each subagent role a model that fits the task and your plan in Codex, Claude Code, Kimi, Antigravity and Grok Build. One command, then it exits.

![One weekly limit: 5.3 h vs 25 h of work](docs/assets/subagent-limits.svg)

<sub>My own Codex logs; tasks differed between the runs. [How it was measured](docs/limits-evidence.md).</sub>

## Set it up

1. Open the [configurator](https://agent-policy-kit.trymenow.io/v/0.2.0/). Pick roles, your coding tools and a mode: **Light**, **Standard** or **Top-tier**, by how much of your plan subagents may use.
2. Copy the command and run it. Remove the last `--apply` line to preview first; nothing is written without it.

![Configurator: models and effort for each subagent role, and the setup command](docs/assets/configurator.png)

No configurator needed for the defaults:

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.2.0 \
  agent-policy setup --release --preset balanced          # preview
npx --yes --ignore-scripts --package agent-policy-kit@0.2.0 \
  agent-policy setup --release --preset balanced --apply  # apply
```

## Good to know

- Your main agent and its model stay unchanged. It still decides when to delegate.
- No proxy and no background process. Delete the npm package after setup.
- `agent-policy show` reads your current settings. `agent-policy uninstall --apply` removes APK's settings and keeps yours.
- Claude Fable may use additional usage credits on plans that do not include it.

[Model catalog](docs/model-catalog.md) · [Release notes](CHANGELOG.md) · [AI operator guide](AGENT_INSTALL.md) · [Support](docs/compatibility.md) · [Privacy](docs/privacy.md)

Node.js 22.13+ or 24+ · macOS/Linux · MIT

## Related projects

- [Agents Can Communicate (ACC)](https://github.com/automatis-tools/agents-can-communicate): connect independent AI coding sessions for questions, reviews and handoffs.
- [Automatis Skills](https://github.com/automatis-tools/automatis-skills): reusable engineering skills for GitHub workflows, Git cleanup and technical writing.
