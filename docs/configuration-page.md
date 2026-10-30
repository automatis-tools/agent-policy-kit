# Configuration page

Open site/index.html in Google Chrome. The page is one self-contained HTML file. It has no backend, telemetry, asset requests or native account access. It embeds this release's model catalog, presets, role definitions, getacc.dev palette and licensed Public Sans font.

## Four steps

1. Add the subagent roles you need. A green check confirms a nonempty role selection. Each question-mark button explains its description and native prompt. Removing a role also removes its configuration rows. Readding it preserves its choices in the current page session.
2. Add your coding tools. A green check confirms a nonempty tool selection. New tools append to the list. The first becomes active. From the second onward, All is active by default. A manually selected tool or All stays active during later additions. All configures the selected tools together. The CLI, not the browser, detects which selected tools are installed.
3. Choose a work mode. No mode is selected initially. Each selected tool needs a chosen mode before the command becomes available. The first choice has no replacement warning. Individual tools always show every selected role's model and supported effort. All offers shared presets. Custom can be selected manually and is also set by model or effort edits. Each tool shows its own mode beneath its name. Individual presets warn before changing that tool. Replacing genuinely edited values, mixed per-tool bases or partially chosen modes from All warns before changing all selected tools. Selecting Custom alone without changing values does not create an overwrite warning. Cancel preserves the choices.
4. Copy the setup command and run it in a terminal. Incomplete selections identify the missing steps with links. Invalid model settings disable copying and clear the previous command. Clipboard failure selects the full command for manual copying.

The page starts empty. A completed third step requires selected modes and valid model settings. A fourth green check means the current command was successfully copied, not installed. Configuration changes clear that check; opening another tool without changing values preserves it. Reset form clears selections, modes, copy status and the URL fragment without changing any installed native files. Parallelism follows the release recommendation. Effort buttons fill their section and show supported explicit levels. A dash means no native effort setting. Unpinned values remain unpinned until changed. Kimi roles sharing a model alias share its effort. Antigravity offers only native tiers. Other tools also accept custom native model IDs, subject to CLI and account support.

The command is pinned to this page's package version. It always expands every selected tool and role into visible model/effort arguments. Presets fill the form but do not shorten or hide the command. Tools follow their selected order. --roles carries the selected role IDs and --max-concurrent carries the existing cap. Nonempty --avoid-TOOL lists preserve existing model-avoidance guidance. Omitted tools are not configured.

Each tool uses role=model:effort entries. :native means no explicit effort pin. Antigravity uses role=tier without an effort suffix. The parser splits at the last colon, preserving model IDs that contain colons or @. Every selected role must be present exactly once for every selected tool. The generated command reports custom provenance because its values are explicit, even when a preset filled the form.

The complete command is visible in a read-only field that grows to fit its contents. Copy preserves the visible POSIX shell line continuations. Soft wrapping adds no additional newlines. [Native field sizing](https://developer.chrome.com/docs/css-ui/css-field-sizing) handles content and window-size changes without a JavaScript resize helper. The page never executes the command or grants model access.

Role/tool changes use native View Transitions with a reduced-motion setting and a synchronous fallback. Section hints are conditional: role guidance after selection, add-more guidance for one tool, individual-configuration guidance for two or more tools, mode guidance when available, and Copied in the fourth heading. Changed hints, step markers, editing-scope labels and per-tool mode captions hold a soft highlight for two seconds, then fade for two seconds. Tool-caption nodes are reused so switching the editing view does not interrupt a pulse. Identical state does not repeat the animation. Labels retain their size during layout changes. No animation dependency is installed.

## Share a setup

Each form edit replaces the current URL fragment with its visible state. Copy the page address to share it. The fragment contains roles, tool order, mode/base, selected model/effort pairs, cap and editing scope. It excludes clipboard completion and unselected cached choices. Opening a link restores the form, including unfinished choices and model drafts. Command validation still blocks incomplete or invalid settings.

src/share.mjs is the pure browser/Node codec. It uses versioned base64url JSON with strict IDs, fields, duplicate-key, size, UTF-8 and release checks. The fragment stays in the browser and needs no database or config lookup service. Invalid or mismatched-release links show an error and cannot produce an applicable command. Missing-step links scroll/focus without overwriting the setup fragment.

Public friend links require this static page to be hosted, for example on getacc.dev. A local file URL is machine-local; localhost acceptance proves restoration behavior, not public deployment. Each published release should retain its versioned page so old links can use the matching release.

## Build and host

Run npm run build:site after changing the template, shared CSS, role definitions, command codec, version, presets, catalog or changelog. npm run check rejects a stale generated page. Source assets are in site/template.html, site/base.css and site/fonts/. src/explicit.mjs supplies the same pure codec to the CLI and page. The generated HTML needs no server or build step to open.

Serve site/index.html from any static host. It can become part of getacc.dev without a service or proxy. Publish immutable pages at versioned release paths. A latest landing URL can point to the current one. Set repository/homepage URLs only after the owner creates them.

The current version is unreleased. Its page labels that status. Before npm publication, use the verified local tarball as described in the [AI operator guide](../AGENT_INSTALL.md). The checks do not publish or deploy anything.

The introduction includes a collapsed “How it works and why you need it” explanation aligned with the README. Native details/summary supports keyboard toggling; opening/closing takes 200 ms and honors reduced motion. The hosted versioned URL preserves release-specific shared links.

The footer credits Mykola Maksymenko and links to his supplied LinkedIn profile, Agents Can Communicate and Automatis Skills. Package author metadata is the source for the visible byline, title, author tags and static JSON-LD Person/project/page relationship. The canonical URL follows the homepage origin and bundled release version. These links load only when followed; no social widgets or runtime metadata requests are added.

These attribution changes are prepared for a future release. Keep already published npm versions and versioned HTML snapshots unchanged when publishing them after review and integration into main.
