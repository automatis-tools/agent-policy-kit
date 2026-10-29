# Native configuration support

| Client | Written native configuration | Limits |
|---|---|---|
| Codex | User role TOMLs, native subagent defaults/concurrency, routing instructions | Higher-priority project/explicit settings still follow Codex rules |
| Claude Code | User role Markdown with model/effort, native default/concurrency env, routing instructions | Force settings and native execution-path exceptions can override the intended mapping |
| Kimi Code | User role Markdown, existing secondary-model pool, per-alias effort, routing instructions | Model-role selection and max concurrency are guidance; provisioned aliases/capabilities are required |
| agy | User role Markdown with Pro/Flash tiers and routing instructions | No concrete provider pin, documented per-role effort, or universal native max-three cap |

These are preferences implemented through native features. APK does not participate in later agent operation and does not enforce policy on every request. avoidModels is guidance. No hook, wrapper or proxy is installed to bypass native limits.

Global configuration can be superseded by a project's native settings, session flags, environment or plugins. A fresh client session may be needed. Configured files, native loading and actual provider model execution are separate evidence.

macOS is the local acceptance host. Linux has a source-isolation gate using bubblewrap and a hosted workflow prepared; hosted runs are pending. Windows application is explicitly unsupported.

Primary references checked for this design:

- [Codex native subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
- [Claude native subagents](https://code.claude.com/docs/en/sub-agents).
- [Kimi configuration](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/configuration/config-files.md) and [agent definitions](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/customization/agents.md).
- [Antigravity native subagents](https://antigravity.google/docs/subagents?tab=cli).
