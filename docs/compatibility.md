# Native configuration support

| AI assistant | Written native configuration | Limits |
|---|---|---|
| ChatGPT (Codex) | User role TOMLs, native subagent defaults/concurrency, routing instructions | Higher-priority project/explicit settings still follow Codex rules |
| Claude (Claude Code) | User role Markdown with model/effort, native default/concurrency env, routing instructions | Force settings and native execution-path exceptions can override the intended mapping |
| Kimi (Kimi Code) | User role Markdown, existing secondary-model pool, per-alias effort, routing instructions | Model-role selection and max concurrency are guidance; provisioned aliases/capabilities are required |
| Gemini (Antigravity) | User role Markdown with Pro/Flash/Flash Lite/inherit tiers and routing instructions | No concrete provider pin, documented per-role effort, or universal native max-three cap |
| Grok (Grok Build) | User role Markdown (read-only roles use permission_mode plan), per-role models and a general-purpose fallback in config.toml, native max_concurrent, routing instructions | No documented per-role effort; subagents use the main session effort. Higher-priority project/explicit settings still follow Grok Build rules |

Gemini means Antigravity: APK detects the `agy` executable and writes Antigravity role settings. Gemini CLI also uses `~/.gemini`, but APK does not detect or configure it.

These are preferences implemented through native features. APK does not participate in later agent operation and does not enforce policy on every request. avoidModels is guidance. No hook, wrapper or proxy is installed to bypass native limits.

## Desktop apps

Some desktop apps include their own copy of a CLI and do not put it on PATH. On macOS, detection also checks these copies, after PATH and the conventional CLI locations:

| App | Checked location | Settings it reads |
|---|---|---|
| ChatGPT Desktop (Codex) | `/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex`, and the same path under `~/Applications` | `~/.codex`, the same as the Codex CLI |
| Claude Desktop (Code tab) | `~/Library/Application Support/Claude/claude-code/<version>/<build>/claude.app/Contents/MacOS/claude`, newest version first, and within a version the most recently written build first | `~/.claude`, the same as the Claude Code CLI |

A client found this way has `origin: "desktop_app"` in detect output. The app must be installed, and the bundled CLI must report a valid version. Settings apply to new desktop sessions.

These desktop features are not configured:

- Claude Cowork reads instructions and plugins from your Claude account, not from `~/.claude`.
- ChatGPT conversations outside Codex have no subagent settings.

Global configuration can be superseded by a project's native settings, session flags, environment or plugins. A fresh client session may be needed. Configured files, native loading and actual provider model execution are separate evidence.

macOS is the local acceptance host. Linux has a source-isolation gate using bubblewrap and a hosted workflow prepared; hosted runs are pending. Windows application is explicitly unsupported.

Primary references checked for this design:

- [Codex native subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
- [Claude native subagents](https://code.claude.com/docs/en/sub-agents).
- [Kimi configuration](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/configuration/config-files.md) and [agent definitions](https://github.com/MoonshotAI/kimi-code/blob/main/docs/en/customization/agents.md).
- [Antigravity native subagents](https://antigravity.google/docs/subagents?tab=cli).
- [Grok Build subagents](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/16-subagents.md), observed with Grok Build 1.0.70 and an isolated GROK_HOME.
