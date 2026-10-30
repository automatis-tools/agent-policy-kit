# Website deployment

The latest configurator at https://agent-policy-kit.trymenow.io/ follows reviewed main after Verify package succeeds. npm publication remains a separate, explicitly authorized operation.

## Automatic path

GitHub Actions runs Deploy configurator after a successful same-repository push verification on main. A successful version-tag verification can retry a site build after a package release. The deployment workflow always checks out main, never the triggering branch or tag's code. It verifies successful main-push CI for the checked-out commit and rechecks the latest main immediately before upload. Stale runs skip; deployments are serialized.

The production environment permits the main branch only. It has no required-reviewer pause, so normal merges need no manual deployment. workflow_dispatch provides a main-only retry after an external outage or delayed npm publication.

## Latest page and archived releases

The root page uses the current main interface and author metadata. Its declared configuration version and generated command must already exist in npm, and configuration-sensitive source must match that version's reachable Git tag. A model/catalog/role/policy/explicit-option change requires a corresponding configuration release before it can be served.

The /v/VERSION/ pages are copied byte for byte from reachable release tags. They are not rebuilt with the latest template. Old root share links redirect only to a known same-origin archived release; malformed, unknown and offline links retain safe errors. The root canonical URL stays the project root.

npm run build:host requires full Git history/tags and anonymous registry access. It refuses unknown files/symlinks in the generated output and stops before replacing dist when release validation fails.

## One-time credentials

The GitHub production environment stores CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN as encrypted environment secrets. The deployment API token needs Workers Scripts edit for the target Cloudflare account. Routing is excluded from the generated CI configuration: domain changes remain explicit infrastructure operations, so the CI token needs no zone, DNS, KV or R2 permissions.

Do not store the interactive Wrangler OAuth token or refresh token in CI. Create a separate deployment token and keep its value out of Git/npm, logs and artifacts. Cloudflare may scope Workers Scripts edit to the account rather than one Worker; the workflow additionally fixes the target Worker name and checks out trusted main code only.

Deployment tooling is pinned to Wrangler 4.151.3 and installed with lifecycle scripts disabled before Cloudflare credentials are passed to the upload step. Account secrets are not exposed to PR test jobs.

## Validation and retry

Before upload, the workflow builds the allowlisted static output and verifies current main/CI. After upload, it checks ordinary HTTPS responses against local latest/archive bytes. A failed gate leaves the existing deployment in place. A post-upload HTTP mismatch fails the workflow and needs investigation; it does not silently claim success.

Use the Deploy configurator workflow's main-only manual retry for transient service failures. No tag, npm package or PR is merged or published by this workflow.
