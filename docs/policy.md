# Configuration preferences

Start with policies/balanced.json or another preset in the selected release. The [JSON Schema](../schema/policy.schema.json) describes data shape; the configuration validator also checks the release catalog's known model/effort compatibility.

- schemaVersion1; maxConcurrent is a shared target1..32.
- clients contains codex, claude, kimi and/or agy (the technical key for Antigravity).
- Optional top-level selectedRoles is a nonempty unique array of worker, reviewer, explorer, tester, writer and routine IDs. Omit it for all six roles in the executing release. Only selected roles receive native files and routing instructions.
- code/light hold default model+effort pairs.
- Optional roles inside each client overrides each selected role independently. Worker/reviewer/tester otherwise use code; explorer/writer/routine use light. Public presets also contain role-specific overrides.
- avoidModels is delegation guidance. An explicit page choice removes itself from that avoid list.

Effort null means native behavior without an explicit effort override. Codex effort depends on the native model selector. Claude supports low through max as documented per model. Kimi actual aliases must declare the requested non-null effort. Antigravity's role field supports model tiers, with no per-role effort pin.

A known model cannot request an effort excluded by the release catalog. Custom IDs can use the client's native level set, subject to actual native availability. Kimi can merge null with one explicit pin for a selected shared alias. Contradictory explicit pins are refused. Unselected role defaults do not require Kimi aliases or acquire pins. A section-wide effort conflicting with mixed default/pinned alias behavior is a prerequisite rather than a silent rewrite.

[Presets/catalog](model-catalog.md) describe recommendations and sources. [Release usage](releases.md) explains explicit default/preset/custom replacement. Only when the main agent chooses delegation do any of these role preferences apply. No subagent feature is enabled by the configurator.
