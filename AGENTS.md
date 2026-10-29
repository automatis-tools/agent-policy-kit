# Contributor instructions

- This is a one-shot native configurator. No custom code may run during normal client operation. Do not add hooks, wrappers, plugins, daemons, proxies or runtime audits.
- Native files must remain independent with npm package, source and kit state removed. Never generate executable/import references to them.
- Use Node.js 22.x (22.13+) or 24+. Run unit tests and the packed-package acceptance gate before completion.
- Preserve main models, credentials, permissions, unrelated settings and later user edits. Default operations are plan-only; --apply writes owned changes. Drift must refuse destructive removal.
- Never put account data, credentials, user paths, raw configs or test evidence in Git/npm.
- Native configuration, client loading and actual model/provider execution are different evidence. Do not advertise universal policy enforcement or unsupported native caps.
- This repository is local-only. The owner creates GitHub. Do not create remotes or publish packages.
- Never merge branches or mark draft PRs ready.
