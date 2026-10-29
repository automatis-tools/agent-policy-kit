# Capabilities and support boundaries

| Surface | Supported contract | Not claimed |
|---|---|---|
| Codex local command hooks | PreToolUse requested model/effort checks, documented rewrites, supported role-file checks | Every specialized tool path, provider identity, arbitrary custom-role resolution |
| Claude classic hook | Agent parameters and safe rewrites | Workflow/per-step/resume control |
| Claude native mod | Supported agent.spawn starts, role model routing, fork denial, bounded host-store audit | Spawn effort mutation, resume/per-step enforcement, complete durable ledger |
| Kimi hook | Explicit pool alias and supported global native binding checks | Silent input rewrite, account entitlement, unresolved project overrides |
| Kimi run/launcher | Native AgentSwarm initial-ramp concurrency setting | Global ordinary-Agent or lifetime task cap |
| agy | Unsupported exact-model report and normalized observation support | Concrete model pinning from tier names, tier guarantees |

Command guards emit a safe explicit denial for targeted invalid input or invalid policy. This does not change a vendor's behavior when a hook process crashes or times out. Kimi documents fail-open hook failures; Codex documents specialized bypass paths. Treat the kit as a local control, not a sandbox, quota contract or enterprise security boundary.

macOS is the local acceptance host. Linux has a package-isolation gate using bubblewrap; hosted CI runs are pending until a remote exists. Windows application is rejected explicitly. The policy core may run elsewhere, but that is not a settings-installation claim.

Client versions and actual check outcomes are listed in `verification.md`. A valid parser result, a loaded mod, and a model completing a task are three separate kinds of evidence. Future client versions must be rechecked; the kit does not assume hook schemas never change.
