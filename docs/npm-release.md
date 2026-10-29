# Prepare an npm release

agent-policy-kit 0.1.0 is a local release candidate. The owner creates the public repository and authorizes publication separately. Nothing publishes automatically.

Add actual repository/bugs/homepage metadata once the repository exists. Confirm npm name ownership/availability; an earlier anonymous 404 is not a reservation. If the name changes, update package identity and instructions consistently.

Keep package.json, package-lock.json and changelog aligned. Run the [development checks](development.md), inspect [support](compatibility.md) and [verified evidence](verification.md), then review the distribution:

```sh
npm pack --dry-run --json --ignore-scripts
npm run test:package
npm publish --dry-run --ignore-scripts
npm pack --ignore-scripts
```

The real tarball gate uses fresh profiles, an installed bin and denied source access. After native setup it removes the package and private kit state, then verifies configuration independence. Its standalone consumer fixtures are not real client/model execution.

No lifecycle installation script modifies client configuration. Explicit setup --apply is required. Generated native files must contain no package path/import/command; a temporary npm installation is safe.

README has inline Mermaid and links to bundled documentation. Inspect rendered links before publication. Keep private backups, test profiles, development artifacts and evidence outside Git/npm. Publication, authentication and registry verification remain separate owner-authorized steps.
