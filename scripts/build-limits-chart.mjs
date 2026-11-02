// Builds the weekly-limit illustration used by the README and the configuration page.
// The hours come from the author's Codex logs; docs/research/limits-evidence.md describes the method.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const LIMITS_EVIDENCE = Object.freeze({withoutHours: 16 / 3, withHours: 25});

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const W = 880, H = 322, L = 32, R = 848, SPAN = R - L, DAY_W = SPAN / DAYS.length;
const f1 = n => n.toFixed(1);
const xh = h => L + (h / (8 * DAYS.length)) * SPAN;
const hours = h => (Math.abs(h - Math.round(h)) < 0.05 ? `${Math.round(h)} h` : `${f1(h)} h`);

// darkMode adds a prefers-color-scheme palette; the configuration page has no dark theme.
// Every rule is scoped to .apk-limits so the styles stay inside the chart when it is inlined.
export function limitsChartSvg({darkMode = true} = {}) {
  const b = LIMITS_EVIDENCE.withoutHours, a = LIMITS_EVIDENCE.withHours;
  const hatch = 'apk-limits-hatch', title = 'apk-limits-title';
  const seps = y => DAYS.slice(1).map((_, i) =>
    `<line class="sep" x1="${f1(L + DAY_W * (i + 1))}" x2="${f1(L + DAY_W * (i + 1))}" y1="${y}" y2="${y + 48}"/>`).join('');
  const row = (y, cls, h, label, note) => `
  <text class="rl" x="${L}" y="${y - 12}">${label}${note ? `<tspan class="rn"> · ${note}</tspan>` : ''}</text>
  <rect fill="url(#${hatch})" x="${L}" y="${y}" width="${SPAN}" height="48" rx="8"/>
  <rect class="${cls}" x="${L}" y="${y}" width="${f1(xh(h) - L)}" height="48" rx="8"/>
  ${seps(y)}
  <rect class="chip" x="${f1(xh(h) + 10)}" y="${y + 9}" width="${hours(h).length * 11 + 16}" height="30" rx="6"/>
  <text class="val" x="${f1(xh(h) + 18)}" y="${y + 31}">${hours(h)}</text>`;
  const dark = darkMode ? `
  @media (prefers-color-scheme: dark) {
    .apk-limits { --bg:#0d1117; --ink:#f0efec; --ink2:#c3c2b7; --ink3:#8b8a82; --hb:#141920; --hl:#262c35; --before:#d95926; --after:#3987e5; }
  }` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="apk-limits" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${title}">
<title id="${title}">One weekly Codex limit lasted ${hours(b)} of my work without APK and ${hours(a)} with APK</title>
<defs>
  <pattern id="${hatch}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="8" height="8" class="hb"/><line x1="0" y1="0" x2="0" y2="8" class="hl"/>
  </pattern>
</defs>
<style>
  .apk-limits { --bg:#ffffff; --ink:#0b0b0b; --ink2:#52514e; --ink3:#8a8984; --hb:#f4f3ef; --hl:#e2e0d9; --before:#eb6834; --after:#2a78d6; }${dark}
  .apk-limits text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; fill: var(--ink); }
  .apk-limits .bg { fill: var(--bg); }
  .apk-limits .h1 { font-size: 24px; font-weight: 700; }
  .apk-limits .sub { font-size: 14px; fill: var(--ink2); }
  .apk-limits .day { font-size: 12px; font-weight: 600; fill: var(--ink3); }
  .apk-limits .hb { fill: var(--hb); } .apk-limits .hl { stroke: var(--hl); stroke-width: 3; }
  .apk-limits .before { fill: var(--before); } .apk-limits .after { fill: var(--after); }
  .apk-limits .sep { stroke: var(--bg); stroke-width: 2; }
  .apk-limits .rl { font-size: 15px; font-weight: 650; }
  .apk-limits .rn { font-size: 14px; font-weight: 400; fill: var(--ink2); }
  .apk-limits .val { font-size: 18px; font-weight: 700; }
  .apk-limits .chip { fill: var(--bg); }
</style>
<rect class="bg" width="${W}" height="${H}" rx="12"/>
<text class="h1" x="${L}" y="48">One weekly limit: ${hours(b)} vs ${hours(a)} of work</text>
<text class="sub" x="${L}" y="74">My own Codex work on the same plan, in 8-hour workdays. Hatched: limit used up.</text>
${DAYS.map((d, i) => `<text class="day" x="${f1(L + DAY_W * i + DAY_W / 2)}" y="114" text-anchor="middle">${d}</text>`).join('')}
${row(152, 'before', b, 'Without APK', 'half of subagent work ran on the top model')}
${row(240, 'after', a, 'With APK', 'each role ran on a model that fits the task and the plan')}
</svg>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  fs.writeFileSync(path.join(root, 'docs/assets/subagent-limits.svg'), limitsChartSvg());
  console.log('Wrote docs/assets/subagent-limits.svg');
}
