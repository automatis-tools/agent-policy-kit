# Use cases

## Keep file discovery on a light model

Evaluate `agent-policy evaluate --client codex --role explorer`. An unpinned supported spawn receives the light profile. A role file that secretly fixes another model is not repaired by changing a tool argument; the native binding check denies the conflict.

## Prevent expensive plugin defaults

A classic Claude `Agent` call with `model: opus` is denied. The native mod can pin an otherwise unpinned supported role before model resolution. A trusted installed mod and a classic hook cover different paths; confirm the active path in the capability report.

## Keep Kimi's main model while reducing delegated work

Retain the chosen main model. Use `subagent-code` for code/review and `subagent-light` for discovery/mechanical work. The guard verifies the selected alias's upstream model and per-entry effort. A missing/wrong alias yields a safe denial, not a fallback to the primary.

## Bound a swarm

Start Kimi through the owned launcher or `agent-policy run --client kimi`. The native swarm ramp gets `KIMI_CODE_AGENT_SWARM_MAX_CONCURRENCY` from policy. This does not limit the lifetime total of subagents, ordinary Agent calls, or all background processes.

## Audit a tier mismatch

Record only a normalized observation with `record` on stdin: client, requested model/tier, reported model, and observation source. Add a trusted reported ID to the policy's audit allowlist if necessary. Unknown strings are masked. A record supplied by a caller remains caller-supplied evidence. Do not substitute the tier name for a missing runtime model.

## Try a policy without blocking

Set a valid policy's mode to `observe`, then install it explicitly. Inspect private metadata or `audit --public`. Observe mode leaves calls unchanged. The optional native mod's bounded export has separate retention and is not a complete usage ledger.

## Remove integration after other settings changed

Edit an unrelated theme setting after install, then uninstall the client with `--apply`. That edit remains. An edited owned hook, changed owned scalar, or nested custom table under an owned Kimi hook stops removal with an ownership conflict.
