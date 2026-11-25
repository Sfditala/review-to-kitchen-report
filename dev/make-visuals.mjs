// Generates the README visuals in assets/ from the demo data, in the same dark style
// as my other project banners.   node dev/make-visuals.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets');
mkdirSync(out, { recursive: true });

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [h, ...b] = rows;
  return b.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}
const reviews = parseCsv(readFileSync(join(root, 'data/reviews.csv'), 'utf8'));
const labels = Object.fromEntries(parseCsv(readFileSync(join(root, 'data/expected-labels.csv'), 'utf8')).map((r) => [r.review_id, r]));

// Shared look (matches the other repos' banners)
const C = { bg: '#0a0a0a', card: '#161616', line: '#3a3a3a', text: '#f5f5f5', soft: '#d0d0d0', muted: '#a1a1a1', accent: '#fb7a3c', blue: '#60a5fa' };
const SANS = 'Segoe UI, Inter, Helvetica, Arial, sans-serif';
const MONO = 'Consolas, Menlo, monospace';
const grid = (w, h) => `<defs><pattern id="g" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#fff" fill-opacity=".07"/></pattern></defs><rect width="${w}" height="${h}" rx="18" fill="${C.bg}"/><rect width="${w}" height="${h}" rx="18" fill="url(#g)"/>`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 1) Banner: title + animated pipeline
function banner() {
  const steps = ['Reviews sheet', 'Tag each review', 'Count patterns', '3 decisions', "Chef's inbox"];
  const xs = [120, 360, 600, 840, 1080];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 340" width="1200" height="340" role="img" aria-label="Five bad reviews. One kitchen order. Restaurant reviews tagged and counted every Sunday, sent to the chef as three decisions.">`;
  s += `<style>.pulse{animation:p 5.5s infinite both}.dot{offset-path:path('M120 244 H1080');animation:m 5.5s infinite linear}@keyframes m{0%{offset-distance:0%;opacity:0}4%{opacity:1}72%{offset-distance:100%;opacity:1}78%,100%{offset-distance:100%;opacity:0}}@keyframes p{0%,100%{stroke:${C.line}}6%,16%{stroke:${C.accent}}26%{stroke:${C.line}}}@media (prefers-reduced-motion:reduce){.pulse,.dot{animation:none}.dot{opacity:0}}</style>`;
  s += grid(1200, 340);
  s += `<text x="60" y="100" font-family="${SANS}" font-size="52" font-weight="650" letter-spacing="-2" fill="${C.text}">Five bad reviews. <tspan fill="${C.accent}">One kitchen order.</tspan></text>`;
  s += `<text x="62" y="146" font-family="${MONO}" font-size="19" fill="${C.muted}">Restaurant reviews, tagged and counted every Sunday, sent to the chef as 3 decisions.</text>`;
  s += `<path d="M120 244 H1080" stroke="#fff" stroke-opacity=".22" stroke-width="2"/>`;
  steps.forEach((label, i) => {
    s += `<rect class="pulse" style="animation-delay:${(i * 1.1).toFixed(1)}s" x="${xs[i] - 30}" y="214" width="60" height="60" rx="14" fill="${C.card}" stroke="${C.line}" stroke-width="2"/>`;
    s += `<circle cx="${xs[i]}" cy="244" r="8" fill="${C.accent}"/>`;
    s += `<text x="${xs[i]}" y="302" text-anchor="middle" font-family="${SANS}" font-size="17" fill="${C.soft}">${esc(label)}</text>`;
  });
  return s + `<circle class="dot" r="8" fill="${C.accent}"/></svg>`;
}

// 2) Heatmap: complaints by day × shift
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHIFTS = ['Lunch', 'Evening'];
const cells = SHIFTS.map(() => DAYS.map(() => ({ n: 0, cold: 0 })));
for (const r of reviews) {
  const l = labels[r.review_id];
  if (l.in_week !== 'yes' || l.expected_issue_type === 'none') continue;
  const [d, t] = r.visit_datetime.split(' ');
  const [Y, M, D] = d.split('-').map(Number);
  const dow = new Date(Date.UTC(Y, M - 1, D)).getUTCDay();
  const sh = Number(t.split(':')[0]) < 16 ? 0 : 1;
  cells[sh][dow].n++;
  if (l.expected_dish === 'شاورما' && l.expected_issue_type === 'cold_food') cells[sh][dow].cold++;
}
const maxN = Math.max(...cells.flat().map((c) => c.n));
const totalIssues = cells.flat().reduce((a, c) => a + c.n, 0);
// Sequential blue ramp for a dark surface: dim = few, bright = many (validated dataviz steps)
const RAMP = ['#1a1a1a', '#0e3d7e', '#0f4a96', '#1757ac', '#1b64be', '#2370cd', '#519ced', '#84b9f3'];

function heatmap() {
  const W = 1200, H = 400, cw = 120, ch = 74, gap = 6, gx0 = 170, gy0 = 160;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Reviews with a problem by day and shift. Friday evening has ${maxN}, five of them cold shawarma. No other cell has more than 2.">`;
  s += grid(W, H);
  s += `<text x="60" y="78" font-family="${SANS}" font-size="34" font-weight="650" letter-spacing="-1" fill="${C.text}">One by one, ${totalIssues} complaints. <tspan fill="${C.accent}">Counted, one shift.</tspan></text>`;
  s += `<text x="62" y="112" font-family="${MONO}" font-size="16" fill="${C.muted}">Reviews with a problem, by day and shift · demo week 15–21 Nov</text>`;
  DAYS.forEach((d, i) => {
    s += `<text x="${gx0 + i * cw + cw / 2}" y="${gy0 - 14}" text-anchor="middle" font-family="${SANS}" font-size="16" fill="${i === 5 ? C.text : C.muted}" font-weight="${i === 5 ? 700 : 400}">${d}</text>`;
  });
  SHIFTS.forEach((sh, r) => {
    s += `<text x="${gx0 - 18}" y="${gy0 + r * ch + ch / 2 + 6}" text-anchor="end" font-family="${SANS}" font-size="16" fill="${C.muted}">${sh}</text>`;
    DAYS.forEach((_, i) => {
      const c = cells[r][i];
      const step = c.n === 0 ? 0 : Math.min(RAMP.length - 1, Math.ceil((c.n / maxN) * (RAMP.length - 1)));
      const x = gx0 + i * cw + gap / 2, y = gy0 + r * ch + gap / 2;
      s += `<rect x="${x}" y="${y}" width="${cw - gap}" height="${ch - gap}" rx="10" fill="${RAMP[step]}" stroke="${C.line}" stroke-opacity="${step ? 0 : 1}"><title>${DAYS[i]} ${SHIFTS[r]}: ${c.n}</title></rect>`;
      s += `<text x="${x + (cw - gap) / 2}" y="${y + (ch - gap) / 2 + 9}" text-anchor="middle" font-family="${SANS}" font-size="26" font-weight="${c.n === maxN ? 700 : 500}" fill="${step >= 6 ? '#0a0a0a' : c.n ? C.text : '#555'}">${c.n}</text>`;
    });
  });
  const hx = gx0 + 5 * cw, hy = gy0 + ch, hot = cells[1][5];
  s += `<rect x="${hx}" y="${hy}" width="${cw}" height="${ch}" rx="12" fill="none" stroke="${C.accent}" stroke-width="3"/>`;
  s += `<path d="M${hx + cw / 2} ${hy + ch} V${hy + ch + 30} H${hx - 30}" fill="none" stroke="${C.accent}" stroke-width="2"/>`;
  s += `<text x="${hx - 40}" y="${hy + ch + 36}" text-anchor="end" font-family="${SANS}" font-size="17" font-weight="650" fill="${C.text}">${hot.n} in one evening, <tspan fill="${C.accent}">${hot.cold} × cold shawarma</tspan></text>`;
  const lx = gx0, ly = H - 50;
  RAMP.slice(1).forEach((col, k) => { s += `<rect x="${lx + k * 22}" y="${ly}" width="18" height="12" rx="3" fill="${col}"/>`; });
  s += `<text x="${lx}" y="${ly + 30}" font-family="${SANS}" font-size="13" fill="${C.muted}">fewer</text>`;
  s += `<text x="${lx + 7 * 22 - 4}" y="${ly + 30}" text-anchor="end" font-family="${SANS}" font-size="13" fill="${C.muted}">more</text>`;
  return s + '</svg>';
}

// 3) Plan vs reality (README-first experiment)
const PLAN = [
  ['Schedule, Sun 9:00', [['Schedule', 'same'], ['Manual run', 'new'], ['Config', 'new']]],
  ['Read the sheet', [['Read reviews', 'changed'], ['Filter week + shift', 'new']]],
  ['OpenAI: classify', [['Classify (json_schema)', 'changed'], ['Validate', 'new']]],
  ['Write to sheet', [['Pick columns', 'new'], ['Write RAW, by tab ID', 'changed']]],
  ['Code: group', [['3 groupings', 'changed']]],
  ['OpenAI: 3 decisions', [['Decide from numbers only', 'changed']]],
  ['Gmail', [['Mobile HTML', 'new'], ['Send', 'same']]],
];
function planVsReality() {
  const W = 1200, rowH = 58, top = 180, H = top + PLAN.length * rowH + 30;
  const kinds = [['new', 'added', C.blue], ['changed', 'changed', C.accent], ['same', 'as planned', '#6b6b6b']];
  const col = Object.fromEntries(kinds.map(([k, , c]) => [k, c]));
  const n = (k) => PLAN.flatMap(([, b]) => b).filter(([, kind]) => kind === k).length;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="The plan had 7 steps; the build has 13 nodes: ${n('same')} as planned, ${n('changed')} changed, ${n('new')} added. No planned step was dropped.">`;
  s += grid(W, H);
  s += `<text x="60" y="78" font-family="${SANS}" font-size="34" font-weight="650" letter-spacing="-1" fill="${C.text}">7 planned steps. <tspan fill="${C.accent}">13 nodes built.</tspan></text>`;
  s += `<text x="62" y="112" font-family="${MONO}" font-size="16" fill="${C.muted}">The README I wrote before building, against what the build needed. Nothing was dropped.</text>`;
  let lx = 60;
  for (const [k, label] of kinds) {
    s += `<rect x="${lx}" y="138" width="14" height="14" rx="4" fill="none" stroke="${col[k]}" stroke-width="2.5"/>`;
    s += `<text x="${lx + 22}" y="150" font-family="${SANS}" font-size="14" fill="${C.soft}">${label} (${n(k)})</text>`;
    lx += 150;
  }
  PLAN.forEach(([plan, built], r) => {
    const y = top + r * rowH;
    if (r % 2 === 0) s += `<rect x="40" y="${y - 6}" width="${W - 80}" height="${rowH - 4}" rx="10" fill="#121212"/>`;
    s += `<text x="62" y="${y + 28}" font-family="${SANS}" font-size="17" font-weight="600" fill="${C.text}">${esc(plan)}</text>`;
    s += `<text x="300" y="${y + 29}" font-family="${SANS}" font-size="18" fill="#666">→</text>`;
    let x = 340;
    for (const [label, kind] of built) {
      const w = label.length * 8.6 + 34;
      s += `<rect x="${x}" y="${y + 6}" width="${w}" height="34" rx="17" fill="${C.card}" stroke="${col[kind]}" stroke-width="2"/>`;
      s += `<text x="${x + w / 2}" y="${y + 28}" text-anchor="middle" font-family="${SANS}" font-size="15" fill="${C.soft}">${esc(label)}</text>`;
      x += w + 12;
    }
  });
  return s + '</svg>';
}

writeFileSync(join(out, 'banner.svg'), banner());
writeFileSync(join(out, 'heatmap.svg'), heatmap());
writeFileSync(join(out, 'plan-vs-reality.svg'), planVsReality());
console.log('grid (lunch/evening × Sun..Sat):', JSON.stringify(cells.map((r) => r.map((c) => c.n))), 'total', totalIssues);
