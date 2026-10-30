# Configuration page

Open site/index.html in Google Chrome. It is one self-contained HTML file with no external assets, network requests, backend, telemetry or access to native account files. Recommendations and version are embedded from the same package release.

The page uses the Public Sans font and visual palette from getacc.dev. The build embeds the local font and its SIL Open Font License into the HTML; it needs no font service. Font sources are in site/fonts/.

The page opens in All. This view offers the bundled presets without individual model fields. Choose a tool to edit its models and effort for code, review, search and routine work. All supported tools remain selected for the command; All is a view, not another native client. Native autodetection skips absent tools. Parallelism keeps the release recommendation. Antigravity exposes native tiers; Kimi needs compatible provisioned aliases. The CLI checks native prerequisites when the command runs.

Tool buttons preserve edits. Any model or effort edit selects Custom and displays a reminder to check every tool's settings. Custom remains active even if values later match a preset. Switching back to All preserves these choices; only named presets can be selected there. Choosing a named preset or Reset while in Custom asks for confirmation before replacing all tools' custom choices. Cancel preserves every choice and the Custom mode. Selecting Custom manually in an individual tool keeps the current values.

Effort buttons show supported explicit levels and fill their section's width. None is a native level where supported; XHigh means extra high. Models without an effort setting show a dash. Existing unpinned values stay unpinned, with no active effort button, until a level is chosen. Kimi tasks sharing an alias keep their effort selection synchronized.

A named mode generates a short pinned --release --preset command; Custom generates a pinned npx --config command. It never runs that command itself. Expand configuration details to inspect the JSON/full command. Custom choices are base64url data, not shell fragments. Model availability is not granted or verified by the browser.

Each npm release ships its matching page. An older page continues to generate commands for its own version; it does not fetch newer recommendations. Published release files must stay immutable. The release-notes section describes that package's changes. The current unreleased preview requires a local .tgz for end-to-end execution until npm publication.

## Preview and host

For development, run npm run build:site after changing package version, presets, changelog or site/template.html. npm run check rejects a stale generated page. The CLI itself requires no compilation or browser server.

The generated site/index.html can be served by any static host, including GitHub Pages. Publish each release's file at a versioned path and link it from that release's notes; an optional latest landing URL can point to the current page. Set real repository/homepage URLs only after the owner creates them. No hosting deployment or npm publication is performed by this repository's checks.
