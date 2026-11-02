# Grok Build support

## Intent

Many programmers use Grok Build next to Codex, Claude Code, Kimi Code and Antigravity. APK should configure Grok Build subagent roles the same way: one command writes native settings once and exits, with no runtime component.

## Verified native surface (Grok Build 1.0.70, bundled user guide)

- Profile: `$GROK_HOME`, default `~/.grok`. An isolated `GROK_HOME` is honored (checked with `grok inspect --json` on a temporary profile).
- Roles: Markdown agent definitions in `~/.grok/agents/*.md` with YAML frontmatter (`name`, `description`, prompt body). User agents appear in the `spawn_subagent` type list. Bundled read-only agents use `permission_mode: plan`.
- Per-role model: `[subagents.models] <agent-name> = "<model>"` in `~/.grok/config.toml` (config reference: per-subagent model override).
- Fallback model: `[subagents.models] general-purpose = "<model>"`. Without it, a subagent without a named type inherits the parent model.
- Parallelism: `[subagents] max_concurrent` is a native cap.
- Instructions: `~/.grok/AGENTS.md` holds global rules.
- Effort: resolution is spawn override, role, persona, then parent session. Agent frontmatter effort is undocumented, so APK does not pin per-role effort. Subagents use the main session's effort, as with Antigravity.
- Compatibility: Grok reads `~/.claude/CLAUDE.md` by default. APK does not change that.

## Decisions

- Client id `grok`, label "Grok Build".
- Role files `apk-<role>.md`; Reviewer and Code explorer are read-only through `permission_mode: plan`.
- Models come from `[subagents.models]`, plus the `general-purpose` fallback copied from the Coder choice, matching the other tools' default subagent model.
- Catalog: documented xAI ids `grok-4.7` (default, flagship), `grok-4.6`, `grok-4.5` and `grok-build-0.1` (fast coding model). Per-role effort is unavailable, so every Grok choice has `effort: null`.
- Presets target all users, not one plan: Light uses `grok-build-0.1` for every role; Standard uses `grok-4.7` for code, review and tests and `grok-build-0.1` for the rest; Top-tier also uses `grok-4.7` for exploration and docs, keeping `grok-build-0.1` for the task runner. Parallel defaults follow the shared 2/3/2. Account access varies by plan. No top-model switch for Grok.
- Explicit command: `--grok`, `--grok-max-concurrent`, `--avoid-grok`, following the existing per-tool pattern.
- Ownership, drift refusal, receipts and uninstall follow the existing adapters; TOML edits are surgical, like Codex.

## Later corrections

- 0.5.0: Grok Build 1.0.70 does read a per-role effort from the `effort` field of an agent file, and a model pinned in `[subagents.models]` runs at that model's default effort, not at the main session's effort (#27). APK now writes `effort` when a role pins one. See the AI assistants reference.
- 0.5.0: Grok Build reads agent fields in camelCase, so it ignores `permission_mode: plan`. The Reviewer and Code explorer roles are therefore not read-only in Grok (#30).
- 0.5.1: APK writes `capabilityMode: read-only` for the Reviewer and the Code explorer instead of `permission_mode: plan` (#30). Grok Build applies this field when it starts the subagent and removes the built-in tools that edit, write, delete or move files and the shell tool. `permissionMode: plan` has no effect at spawn, so APK does not write it. The bundled read-only agents mentioned above use the same ignored snake_case key. See the AI assistants reference.

## Out of scope

Personas, roles TOML, plugin agents, project-level `.grok/` files, live model execution and any change to the main session's model or effort.
