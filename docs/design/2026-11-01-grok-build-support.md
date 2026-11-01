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

## Out of scope

Personas, roles TOML, plugin agents, project-level `.grok/` files, live model execution and any change to the main session's model or effort.
