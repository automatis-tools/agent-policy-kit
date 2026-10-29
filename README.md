# Agent Policy Kit

A local policy and audit toolkit for AI coding subagents. This repository is under development. No adapter is advertised as production-ready until its acceptance evidence is recorded.

## Distribution acceptance contract

The documented install path must work from the packed release, without access to its source checkout. A checkout path is a development mode only and must be identified by doctor.

Required release gate: npm pack, install the tarball into a clean consumer prefix with fresh HOME/client-home/XDG directories, make the source checkout unavailable, then invoke only the installed bin. Test install idempotency, preservation of unrelated settings, partial-failure rollback, drift-safe uninstall, audit redaction, and paths containing spaces and apostrophes.

Package/entry-point failures, client trust/load failures, and model/runtime failures are separate outcomes. Unsupported client features must be marked unsupported. A local adapter/CLI validation path remains available when publishing is unavailable.
