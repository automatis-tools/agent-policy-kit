# Configuration page

Open site/index.html in Google Chrome. It is one self-contained HTML file with no external assets, network requests, backend, telemetry or access to native account files. Recommendations and version are embedded from the same package release.

The page uses the Public Sans font and visual palette from getacc.dev. The build embeds the local font and its SIL Open Font License into the HTML; it needs no font service. Font sources are in site/fonts/.

The page opens in All. This view offers the bundled presets without individual model fields. Choose a tool to edit its models and effort for code, review, search and routine work. All supported tools remain selected for the command; All is a view, not another native client. Native autodetection skips absent tools. Parallelism keeps the release recommendation. Antigravity exposes native tiers; Kimi needs compatible provisioned aliases. The CLI checks native prerequisites when the command runs.

Each tool keeps its own mode and choices. Its current mode is always shown beneath its name; All has no caption. Selecting a preset for an individual tool first warns that only this tool will change; the other tools retain their selected settings. Manual model or effort edits mark only that tool Custom. Its Reset preset restores only its last named preset, with the same scope warning.

All displays the common named mode when every tool shares it, otherwise Custom. Switching to All preserves every tool's choices. Choosing a preset from mixed or custom All settings asks before replacing every tool's mode, models and effort. Cancel keeps all choices intact. Custom is an indicator in All; individual tools remain editable.

Effort buttons show supported explicit levels and fill their section's width. None is a native level where supported; XHigh means extra high. Models without an effort setting show a dash. Existing unpinned values stay unpinned, with no active effort button, until a level is chosen. Kimi tasks sharing an alias keep their effort selection synchronized.

The command includes all tools' current choices in the form. When they share one named preset, it uses short pinned --release --preset syntax. Mixed modes or any custom tool generate a pinned npx --config command, even if the visible tool uses a named mode. The page never runs the command itself. Expand configuration details to inspect JSON and the full command. Custom choices are base64url data, not shell fragments. Model availability is not granted or verified by the browser.

Each npm release ships its matching page. An older page continues to generate commands for its own version; it does not fetch newer recommendations. Published release files must stay immutable. The release-notes section describes that package's changes. The current unreleased preview requires a local .tgz for end-to-end execution until npm publication.

## Preview and host

For development, run npm run build:site after changing package version, presets, changelog or site/template.html. npm run check rejects a stale generated page. The CLI itself requires no compilation or browser server.

The generated site/index.html can be served by any static host, including GitHub Pages. Publish each release's file at a versioned path and link it from that release's notes; an optional latest landing URL can point to the current page. Set real repository/homepage URLs only after the owner creates them. No hosting deployment or npm publication is performed by this repository's checks.
