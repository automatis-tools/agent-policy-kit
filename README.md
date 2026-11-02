# Agent Policy Kit

Created and maintained by [Mykola Maksymenko](https://www.linkedin.com/in/nick-maximenko/).

**Stop subagents from burning your plan limits.** Agent Policy Kit (APK) gives each subagent role a model that fits the task and your plan in ChatGPT, Claude, Kimi, Gemini and Grok. You run one command, and then APK exits.

![One weekly limit: 5.3 h vs 25 h of work](docs/assets/subagent-limits.svg)

<sub>My own Codex logs; tasks differed between the runs. [How it was measured](docs/research/limits-evidence.md).</sub>

## Set it up

1. Open the [configurator](https://agent-policy-kit.trymenow.io/). Select roles, your AI assistants and a mode: **Light**, **Standard** or **Top-tier**. The mode sets how much of your plan subagents can use.
2. Copy the command and run it. To preview first, delete the last line (`--apply`) and the ` \` at the end of the line before it. Without `--apply`, APK writes nothing.

![Configurator: models and effort for each subagent role, and the setup command](docs/assets/configurator.png)

[Getting started](docs/guide/getting-started.md) shows the full path, from the configurator to removal.

## Undo

One command removes the APK settings. It restores the settings that you had before APK and keeps your unrelated edits:

```sh
npx --yes --ignore-scripts --package agent-policy-kit@0.5.0 agent-policy uninstall --apply
```

To preview the removal first, run the command without `--apply`. Removal uses the receipts in `~/.agent-policy-kit`, so keep that folder. [Updates and removal](docs/guide/updates-and-removal.md#remove-apk) gives the details and the exceptions.

## Good to know

- Your main agent and its model do not change. The main agent still decides when to delegate.
- APK configures the coding agent of each assistant: Codex in ChatGPT, Claude Code in Claude, Kimi Code, Antigravity for Gemini, and Grok Build. Plain chats do not change. [Assistants](docs/reference/assistants.md) lists the details, also for the desktop apps.
- APK adds no proxy and no background process. You can delete the npm package after setup.
- `npx --yes --ignore-scripts --package agent-policy-kit@0.5.0 agent-policy show` reads your current settings.
- Apart from the npm download, APK makes no network requests. [Privacy](docs/guide/privacy.md) tells what it reads and writes.

## Documentation

- [Documentation index](docs/README.md)
- [Presets](docs/reference/presets.md)
- [Release notes](CHANGELOG.md)
- [AI operator guide](AGENT_INSTALL.md)

## Related projects

- [Agents Can Communicate (ACC)](https://github.com/automatis-tools/agents-can-communicate): connect independent AI coding sessions for questions, reviews and handoffs.
- [Automatis Skills](https://github.com/automatis-tools/automatis-skills): reusable engineering skills for GitHub workflows, Git cleanup and technical writing.
