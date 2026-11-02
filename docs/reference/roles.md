# Roles

This document describes the six subagent roles of APK: what each role does, its prompt, its permissions and the files that APK writes for it. It also describes the default subagent of each AI assistant and how effort applies. It is for everyone who selects roles or wants to know what a configured subagent receives.

A role is a named subagent definition, for example `apk-reviewer`. The main agent decides whether to delegate. A role file does not start a subagent and does not require delegation. Main models, permissions and disabled agent features stay as they are. The roles are defined in `src/roles.mjs`. The page and the native files use the same definitions.

## The six roles

| Role | Native name | Kind | Assignment in the routing instructions |
|---|---|---|---|
| Coder | `apk-worker` | code | scoped implementation and fixes |
| Reviewer | `apk-reviewer` | code | read-only correctness, security and regression review |
| Code explorer | `apk-explorer` | light | read-only code and documentation discovery |
| Test writer | `apk-tester` | code | test creation and targeted execution |
| Docs writer | `apk-writer` | light | assigned documentation, examples and release notes |
| Task runner | `apk-routine` | light | explicit commands and mechanical edits |

The kind selects the default choice in preferences. Code roles use the `code` model and effort. Light roles use the `light` model and effort. A role-specific entry in `roles` overrides the default. See [Preferences](../guide/preferences.md).

The native names are fixed. The CLI uses the ids `worker`, `reviewer`, `explorer`, `tester`, `writer` and `routine`.

## Role selection

By default, APK configures all six roles. The optional `selectedRoles` preference (or `--roles` on the command line) selects a subset. APK then writes role files and routing text only for the selected roles. A Kimi alias that only unselected roles use needs no provisioning and gets no effort pin.

## Descriptions and prompts

The description is the short text that the native client shows. The prompt is the body of the role file. Every prompt ends with the same sentence: "Do not create child agents; return any need for further delegation to the parent."

### Coder

Description: "Implements scoped changes, preserves peers' edits, and verifies the result."

Prompt: "Implement the assigned change or fix within the assigned files. You share the workspace with other agents: preserve their edits. Verify the result and report changes, checks, and remaining limitations."

### Reviewer

Description: "Reviews correctness, security and regressions without edits; reports actionable evidence."

Prompt: "Review the assigned change without editing files. Find actionable correctness, security, and regression issues. Report each finding with file and line evidence and explain its impact; distinguish confirmed issues from uncertainty."

### Code explorer

Description: "Maps code and documentation, cites sources, and separates facts from uncertainty."

Prompt: "Explore the assigned code and documentation without editing files. Return a concise map or factual answer with source paths or citations. Distinguish verified facts from assumptions and unknowns."

### Test writer

Description: "Writes behavior and edge-case tests, reproduces issues, and runs targeted checks."

Prompt: "Own the assigned tests and targeted execution. Reproduce the issue or establish a baseline, then test observable behavior and edge cases. Never weaken checks to make them pass. Do not edit application code unless explicitly assigned. Preserve peers' edits and report results and limitations."

### Docs writer

Description: "Updates assigned docs and examples, verifies claims, and keeps terminology consistent."

Prompt: "Update only the assigned documentation, examples, or release notes. Verify claims against code or cited sources and use consistent terminology. Do not edit application code. Preserve peers' edits and report changes and unknowns."

### Task runner

Description: "Runs prescribed commands and mechanical edits; returns ambiguous decisions to the parent."

Prompt: "Execute only the prescribed commands or clearly specified mechanical edits. Preserve other agents' work and report the outcome. Do not make ambiguous design or behavior decisions; return those decisions to the parent."

## Permissions

The Reviewer and the Code explorer are read-only roles. Their prompts tell them not to edit files. Three assistants also restrict them natively:

| Assistant | Native read-only setting for Reviewer and Code explorer |
|---|---|
| ChatGPT | None. The prompt is the only restriction. |
| Claude | `tools: Read, Grep, Glob` |
| Kimi | `tools: [Read, Grep, Glob]` |
| Gemini | None. The prompt is the only restriction. |
| Grok | `permission_mode: plan` |

The other four roles get no tool restriction. They use the permissions of the native client.

## Role file contents

For the file paths, see [AI assistants](assistants.md#files-written). Each file has these fields:

| Assistant | Format | Fields |
|---|---|---|
| ChatGPT | TOML | `name`, `description`, `model`, `model_reasoning_effort` (only when the effort is pinned), `developer_instructions` (the prompt) |
| Claude | Markdown with frontmatter | `name`, `description`, `model`, `effort` (only when pinned), `tools` (read-only roles); the body is the prompt |
| Kimi | Markdown with frontmatter | `name`, `description`, `tools` (read-only roles); the body is the prompt and a routing note |
| Gemini | Markdown with frontmatter | `name`, `description`, `model` (the tier), `subagent: true`; the body is the prompt |
| Grok | Markdown with frontmatter | `name`, `description`, `effort` (only when pinned), `permission_mode: plan` (read-only roles); the body is the prompt |

- Kimi frontmatter does not select a model. The routing note in the body names the pool alias and the requested effort. The parent selects the alias when it spawns the subagent.
- Grok takes the model of each role from `[subagents.models]` in `config.toml`, not from the role file.

## Instruction block

APK adds one block to the global instruction file of each assistant. The block starts with `<!-- BEGIN agent-policy-kit -->` and ends with `<!-- END agent-policy-kit -->`. It contains these sentences:

1. "These preferences apply only if you choose to delegate to subagents. They do not require delegation or change how you handle work directly."
2. A routing sentence that maps each selected role to its assignment, for example "When delegating, use apk-worker for scoped implementation and fixes, apk-reviewer for …".
3. The parallel limit: "When delegating, run at most N subagents concurrently in this session." It also asks for one concrete result and explicit file ownership for each agent, and says that child agents return further delegation to the parent.
4. Text for the assistant:
   - ChatGPT and Claude: use the named role definitions for model and effort, which settings can override them, and that an omitted role effort uses the native default.
   - Kimi: the pool alias and effort for each role, that roles that share an alias share its effort, and that the concurrency limit is guidance.
   - Gemini: the tier for each role, and that per-role effort and a hard concurrency cap are not supported.
   - Grok: use the named role definitions for model and effort, that a role effort applies only when its model supports effort, that a role without an effort uses the native default of its model, and which settings can override them.
5. If the avoid list is not empty: "Avoid these models when delegating: …. This is routing guidance."

## Default subagent per assistant

A subagent can start without a named role. Most assistants then use a native default. APK sets that default from the first selected role, in the order of the table in [The six roles](#the-six-roles). When the Coder is selected, it is the Coder.

| Assistant | Model setting | Effort setting |
|---|---|---|
| ChatGPT | `agents.default_subagent_model` | `agents.default_subagent_reasoning_effort`, the same effort, when pinned |
| Claude | `CLAUDE_CODE_SUBAGENT_MODEL` | `CLAUDE_CODE_SUBAGENT_EFFORT`, when pinned, capped at `high` |
| Kimi | `secondary_model.default_model` (the alias) | The per-alias effort of that alias, when pinned |
| Gemini | Not set | Not set |
| Grok | `subagents.models.general-purpose` | Not set. The pinned model runs at its default effort. |

- **Claude cap:** a role effort of `xhigh` or `max` becomes `high` for the default subagent. The Claude top choice at `xhigh` therefore does not raise subagents without a named role. Claude Code 2.1.316 or later reads `CLAUDE_CODE_SUBAGENT_EFFORT`. Earlier versions ignore it, and those subagents keep the main session effort.
- **Gemini:** APK writes no configuration file for Antigravity, so subagents without a role follow native Antigravity behavior.
- **Grok:** without the `general-purpose` entry, a subagent without a named type inherits the parent model.

## How effort applies

Effort is the reasoning level that a model uses. An unpinned effort (`null`, or `:native` on the command line) means that APK writes no effort field. The native client then uses its default. APK never changes the effort of the main agent to suit a subagent.

| Assistant | Where the effort goes | Notes |
|---|---|---|
| ChatGPT | `model_reasoning_effort` in the role file | Levels follow the native Codex catalog. |
| Claude | `effort` in the role file | `CLAUDE_CODE_EFFORT_LEVEL` overrides the `effort` field of subagents. Aliases and the resolved provider model can clamp or ignore a level. |
| Kimi | `models.<alias>.overrides.default_effort` | One effort for each alias. See below. |
| Gemini | None | `--effort` and `/effort` apply to the whole session. |
| Grok | `effort` in the role file | Grok Build applies it only when the model supports effort. Without it, a role runs at the default effort of its pinned model (Grok 4.7: `high`), not at the main session effort. A spawn override from the harness or a Grok role with the same name as the agent wins over the field. See [AI assistants](assistants.md#grok-role-effort). |

A known model accepts only the levels in the [model catalog](model-catalog.md). The page offers only those levels.

### Kimi alias effort

Kimi sets effort for each alias, not for each role. An alias is a model entry in the Kimi `config.toml`. These rules apply:

- Roles that use the same alias share its effort. A pin for an alias also applies to the unpinned roles that use the same alias.
- Selected roles that use the same alias cannot request different explicit efforts. APK refuses such input before it plans a change: a preferences file with `INVALID_POLICY`, command-line flags with `INVALID_EXPLICIT_CONFIG` and a `--config` value with `INVALID_CONFIG`. One explicit effort and `null` can share an alias.
- Setup can resolve a missing catalog alias to an existing alias with the same upstream model. If two roles then resolve to one alias with different pinned efforts, setup returns `kimi-resolved-effort-conflict`.
- The pinned level must be in the `support_efforts` of the alias, including its `overrides`. If not, setup returns `kimi-supported-effort-required`.
- If thinking is off (`thinking.enabled = false`) and any effort is pinned, setup returns `kimi-thinking-disabled`.
- If some selected aliases have a pinned effort, others are unpinned, and `secondary_model.default_effort` is set, setup returns `kimi-mixed-native-default-effort`.
- If a pinned alias is also the main model (`default_model`) and the pin changes its default effort, setup returns `kimi-main-effort-conflict`. This refusal does not apply when `thinking.effort` sets an explicit main effort that the alias supports. Use a separate native alias for subagents, or set the main effort deliberately.

For the other Kimi prerequisites, see [AI assistants](assistants.md#kimi-kimi-code).

## Related documents

- [Presets](presets.md): the model and effort that each preset selects for each role.
- [Ownership and state](ownership.md): how APK records and removes role files.
- [Architecture](../maintainers/architecture.md): how the code generates the native files.
