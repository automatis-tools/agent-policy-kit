# Configuration page

Open site/index.html in Google Chrome. The page is one self-contained HTML file. It has no backend, telemetry, asset requests or native account access. It embeds this release's model catalog, presets, role definitions, getacc.dev palette and licensed Public Sans font.

## Four steps

1. Add the subagent roles you need. Each question-mark button explains its description and native prompt. Removing a role also removes its configuration rows. Readding it preserves its choices in the current page session.
2. Add your coding tools. New tools append to the list. The first becomes active. From the second onward, All is active by default. A manually selected tool or All stays active during later additions. All configures the selected tools together. The CLI, not the browser, detects which selected tools are installed.
3. Choose a work mode. Individual tools always show every selected role's model and supported effort. All offers shared presets. Custom can be selected manually and is also set by model or effort edits. Each tool shows its own mode beneath its name. Individual presets warn before changing that tool. Replacing mixed or custom choices from All warns before changing all selected tools. Cancel preserves the choices.
4. Copy the setup command and run it in a terminal. Incomplete selections identify the missing steps with links. Invalid model settings disable copying and clear the previous command. Clipboard failure selects the full command for manual copying.

The page starts empty. Parallelism follows the release recommendation. Effort buttons fill their section and show supported explicit levels. A dash means no native effort setting. Unpinned values remain unpinned until changed. Kimi roles sharing a model alias share its effort. Antigravity offers only native tiers. Other tools also accept custom native model IDs, subject to CLI and account support.

The command is pinned to this page's package version. It always expands every selected tool and role into visible model/effort arguments. Presets fill the form but do not shorten or hide the command. Tools follow their selected order. --roles carries the selected role IDs and --max-concurrent carries the existing cap. Nonempty --avoid-TOOL lists preserve existing model-avoidance guidance. Omitted tools are not configured.

Each tool uses role=model:effort entries. :native means no explicit effort pin. Antigravity uses role=tier without an effort suffix. The parser splits at the last colon, preserving model IDs that contain colons or @. Every selected role must be present exactly once for every selected tool. The generated command reports custom provenance because its values are explicit, even when a preset filled the form.

The complete command is visible in a read-only field that grows to fit its contents. Copy preserves the visible POSIX shell line continuations. Soft wrapping adds no additional newlines. [Native field sizing](https://developer.chrome.com/docs/css-ui/css-field-sizing) handles content and window-size changes without a JavaScript resize helper. The page never executes the command or grants model access.

Role/tool changes use native View Transitions with a reduced-motion setting and a synchronous fallback. Labels retain their size during layout changes. No animation dependency is installed.

## Build and host

Run npm run build:site after changing the template, shared CSS, role definitions, command codec, version, presets, catalog or changelog. npm run check rejects a stale generated page. Source assets are in site/template.html, site/base.css and site/fonts/. src/explicit.mjs supplies the same pure codec to the CLI and page. The generated HTML needs no server or build step to open.

Serve site/index.html from any static host. It can become part of getacc.dev without a service or proxy. Publish immutable pages at versioned release paths. A latest landing URL can point to the current one. Set repository/homepage URLs only after the owner creates them.

The current version is unreleased. Its page labels that status. Before npm publication, use the verified local tarball as described in the [AI operator guide](../AGENT_INSTALL.md). The checks do not publish or deploy anything.
