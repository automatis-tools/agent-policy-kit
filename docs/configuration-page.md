# Configuration page

Open site/index.html in Google Chrome. It is one self-contained HTML file with no external assets, network requests, backend, telemetry or access to native account files. Recommendations and version are embedded from the same package release.

The page uses the Public Sans font and visual palette from getacc.dev. The build embeds the local font and its SIL Open Font License into the HTML; it needs no font service. Font sources are in site/fonts/.

Choose a starting preset, then the tool whose models/effort you want to edit. The four task fields control code, review, search and routine work independently. All supported tools remain selected for the command; native autodetection skips absent tools. Effort is explicit per task and filtered by the selected model. Parallelism keeps the release recommendation. Antigravity exposes native tiers; Kimi needs compatible provisioned aliases. The CLI checks native prerequisites when the command runs.

An unchanged preset generates a short pinned --release --preset command; edited choices generate a pinned npx --config command. It never runs that command itself. Expand configuration details to inspect the JSON/full command. Custom choices are base64url data, not shell fragments. Model availability is not granted or verified by the browser.

Each npm release ships its matching page. An older page continues to generate commands for its own version; it does not fetch newer recommendations. Published release files must stay immutable. The release-notes section describes that package's changes. The current unreleased preview requires a local .tgz for end-to-end execution until npm publication.

## Preview and host

For development, run npm run build:site after changing package version, presets, changelog or site/template.html. npm run check rejects a stale generated page. The CLI itself requires no compilation or browser server.

The generated site/index.html can be served by any static host, including GitHub Pages. Publish each release's file at a versioned path and link it from that release's notes; an optional latest landing URL can point to the current page. Set real repository/homepage URLs only after the owner creates them. No hosting deployment or npm publication is performed by this repository's checks.
