// Generates the README visuals in assets/ (light + dark) from the demo data.
//   node dev/make-visuals.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets');
mkdirSync(out, { recursive: true });

// ---------- tiny CSV reader ----------
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

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FONT = "font-family=\"'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial, sans-serif\"";

const THEMES = {
  light: { bg: '#ffffff', card: '#f6f8fa', border: '#d0d7de', text: '#191919', muted: '#666666', faint: '#eaeef2',
    seq: ['#f1f3f5', '#b6d5f8', '#84b9f3', '#519ced', '#338ced', '#257de0', '#1b64be', '#0f4a96'],
    seqInkDarkFrom: 4, accent: '#e76624', blue: '#257de0', paper: '#fffdf7', paperLine: '#e7e2d3' },
  dark: { bg: '#0d1117', card: '#161b22', border: '#30363d', text: '#efefef', muted: '#9c9c9c', faint: '#21262d',
    seq: ['#1c2128', '#0e3d7e', '#0f4a96', '#1757ac', '#1b64be', '#2370cd', '#519ced', '#84b9f3'],
    seqInkDarkFrom: 6, accent: '#f47230', blue: '#338ced', paper: '#f3efe4', paperLine: '#d9d2bf' },
};

// =====================================================================
// 1) HEATMAP: complaints by day × shift (the pattern a human misses)
// =====================================================================
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const SHIFTS = ['غداء', 'مسائي'];
const grid = SHIFTS.map(() => DAYS.map(() => ({ n: 0, cold: 0 })));
for (const r of reviews) {
  const l = labels[r.review_id];
  if (l.in_week !== 'yes' || l.expected_issue_type === 'none') continue;
  const [d, t] = r.visit_datetime.split(' ');
  const [Y, M, D] = d.split('-').map(Number);
  const dow = new Date(Date.UTC(Y, M - 1, D)).getUTCDay();
  const s = Number(t.split(':')[0]) < 16 ? 0 : 1;
  grid[s][dow].n++;
  if (l.expected_dish === 'شاورما' && l.expected_issue_type === 'cold_food') grid[s][dow].cold++;
}
const maxN = Math.max(...grid.flat().map((c) => c.n));

function heatmap(th) {
  const W = 960, H = 390, cw = 104, ch = 70, gap = 4;
  const gx0 = W - 120 - 7 * cw;            // grid left (RTL: Sunday at the right)
  const gy0 = 124;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ${FONT} role="img" aria-label="Complaints by day and shift heatmap">`;
  s += `<rect width="${W}" height="${H}" rx="14" fill="${th.bg}" stroke="${th.border}"/>`;
  s += `<text x="${W - 32}" y="44" text-anchor="start" direction="rtl" font-size="22" font-weight="700" fill="${th.text}">وين بتتجمّع الشكاوى؟</text>`;
  s += `<text x="${W - 32}" y="70" text-anchor="start" direction="rtl" font-size="14" fill="${th.muted}">عدد المراجعات اللي فيها مشكلة · حسب اليوم والشفت · أسبوع 15–21 نوفمبر (بيانات الديمو)</text>`;
  // headers
  DAYS.forEach((d, i) => {
    const x = gx0 + (6 - i) * cw + cw / 2;
    s += `<text x="${x}" y="${gy0 - 10}" text-anchor="middle" font-size="14" fill="${i === 5 ? th.text : th.muted}" font-weight="${i === 5 ? 700 : 400}">${d}</text>`;
  });
  SHIFTS.forEach((sh, r) => {
    s += `<text x="${gx0 + 7 * cw + 14}" y="${gy0 + r * ch + ch / 2 + 5}" font-size="15" fill="${th.muted}">${sh}</text>`;
    DAYS.forEach((_, i) => {
      const c = grid[r][i];
      const step = c.n === 0 ? 0 : Math.min(th.seq.length - 1, Math.ceil((c.n / maxN) * (th.seq.length - 1)));
      const x = gx0 + (6 - i) * cw + gap / 2, y = gy0 + r * ch + gap / 2;
      const ink = step >= th.seqInkDarkFrom ? (th === THEMES.light ? '#ffffff' : '#0d1117') : (c.n ? th.text : th.muted);
      s += `<rect x="${x}" y="${y}" width="${cw - gap}" height="${ch - gap}" rx="6" fill="${th.seq[step]}"><title>${DAYS[i]} · ${SHIFTS[r]}: ${c.n}</title></rect>`;
      s += `<text x="${x + (cw - gap) / 2}" y="${y + (ch - gap) / 2 + 8}" text-anchor="middle" font-size="22" font-weight="${c.n === maxN ? 700 : 500}" fill="${ink}">${c.n}</text>`;
    });
  });
  // highlight the hot cell
  const hot = { r: 1, i: 5 };
  const hx = gx0 + (6 - hot.i) * cw, hy = gy0 + hot.r * ch;
  s += `<rect x="${hx - 1}" y="${hy - 1}" width="${cw + 2}" height="${ch + 2}" rx="8" fill="none" stroke="${th.accent}" stroke-width="3"/>`;
  const c = grid[hot.r][hot.i];
  const ax = hx + cw / 2, ay = hy + ch + 4;
  s += `<path d="M${ax} ${ay} L${ax} ${ay + 34} L${ax + 70} ${ay + 34}" fill="none" stroke="${th.accent}" stroke-width="2"/>`;
  s += `<text x="${ax + 78}" y="${ay + 39}" font-size="15" fill="${th.text}" direction="rtl" text-anchor="end" font-weight="700">${c.n} شكاوى بليلة وحدة، ${c.cold} منها: شاورما باردة</text>`;
  s += `<text x="${ax + 78}" y="${ay + 62}" font-size="13" fill="${th.muted}" direction="rtl" text-anchor="end">لما تقرأهم وحدة وحدة ما بتشوف هالمربّع. الكود بيعدّهم، والموديل بيكتب القرار.</text>`;
  // legend (ramp)
  const lx = 32, ly = H - 44;
  th.seq.slice(1).forEach((col, k) => { s += `<rect x="${lx + k * 16}" y="${ly}" width="14" height="14" rx="3" fill="${col}"/>`; });
  s += `<text x="${lx}" y="${ly + 30}" font-size="12" fill="${th.muted}">أقل</text>`;
  s += `<text x="${lx + 7 * 16 - 2}" y="${ly + 30}" text-anchor="end" font-size="12" fill="${th.muted}">أكثر</text>`;
  return s + '</svg>';
}

// =====================================================================
// 2) PLAN vs REALITY: README-first experiment, one row per planned step
// =====================================================================
const PLAN = [
  ['جدولة: أحد 9:00', [['جدولة الأحد', 'same'], ['تشغيل يدوي', 'new'], ['Config', 'new']]],
  ['قراءة الشيت', [['Read reviews', 'changed'], ['فلتر الأسبوع + الشفت', 'new']]],
  ['تصنيف (OpenAI)', [['تصنيف json_schema', 'changed'], ['تحقق وتصحيح', 'new']]],
  ['كتابة بالشيت', [['اختيار الأعمدة', 'new'], ['كتابة RAW بالـ ID', 'changed']]],
  ['تجميع (Code)', [['3 تجميعات', 'changed']]],
  ['3 قرارات (OpenAI)', [['قرارات من أرقام بس', 'changed']]],
  ['Gmail', [['بناء HTML للجوال', 'new'], ['إرسال', 'same']]],
];
function planVsReality(th) {
  const W = 960, rowH = 54, top = 118, H = top + PLAN.length * rowH + 36;
  const col = { same: th.muted, changed: th.accent, new: th.blue };
  const name = { same: 'زي الخطة', changed: 'تغيّر', new: 'جديد' };
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ${FONT} role="img" aria-label="Plan versus what was built">`;
  s += `<rect width="${W}" height="${H}" rx="14" fill="${th.bg}" stroke="${th.border}"/>`;
  s += `<text x="${W - 32}" y="44" text-anchor="start" direction="rtl" font-size="22" font-weight="700" fill="${th.text}">الخطة قبل البناء ← اللي انبنى فعلاً</text>`;
  s += `<text x="${W - 32}" y="70" text-anchor="start" direction="rtl" font-size="14" fill="${th.muted}">7 خطوات بالخطة صاروا 13 خطوة بالبناء · ولا خطوة انحذفت، بس 5 تغيّرت و6 انضافت</text>`;
  // legend
  let lx = 32;
  for (const k of ['new', 'changed', 'same']) {
    s += `<rect x="${lx}" y="30" width="14" height="14" rx="3" fill="${th.bg}" stroke="${col[k]}" stroke-width="2.5"/>`;
    s += `<text x="${lx + 20}" y="42" font-size="13" fill="${th.text}">${name[k]}</text>`;
    lx += 90;
  }
  s += `<text x="${W - 32}" y="${top - 16}" text-anchor="end" font-size="12" fill="${th.muted}">الخطة</text>`;
  s += `<text x="${W - 300}" y="${top - 16}" text-anchor="end" font-size="12" fill="${th.muted}">اللي انبنى</text>`;
  PLAN.forEach(([plan, built], r) => {
    const y = top + r * rowH;
    if (r % 2 === 0) s += `<rect x="16" y="${y - 6}" width="${W - 32}" height="${rowH}" rx="8" fill="${th.card}"/>`;
    s += `<text x="${W - 32}" y="${y + 26}" text-anchor="start" direction="rtl" font-size="15" font-weight="600" fill="${th.text}">${esc(plan)}</text>`;
    s += `<text x="${W - 258}" y="${y + 27}" text-anchor="middle" font-size="18" fill="${th.muted}">←</text>`;
    let x = W - 300;
    for (const [label, kind] of built) {
      const w = Math.max(96, label.length * 8.4 + 28);
      s += `<rect x="${x - w}" y="${y + 6}" width="${w}" height="32" rx="16" fill="${th.bg}" stroke="${col[kind]}" stroke-width="2"/>`;
      s += `<text x="${x - w / 2}" y="${y + 27}" text-anchor="middle" direction="rtl" font-size="13.5" fill="${th.text}">${esc(label)}</text>`;
      x -= w + 10;
    }
  });
  return s + '</svg>';
}

// =====================================================================
// 3) HERO: messy reviews → kitchen work order
// =====================================================================
function hero(th) {
  const W = 1280, H = 420;
  const tilt = [-3, 2, -1.5, 2.5];
  const bubbles = [
    ['★★☆☆☆', 'شاورما الدجاج كانت باردة…'],
    ['★☆☆☆☆', 'الساندويش بارد كأنو معمول من ساعة'],
    ['★★☆☆☆', 'lukewarm at best. Disappointed.'],
    ['★★☆☆☆', 'يا جماعة الشاورما بردانة!'],
  ];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ${FONT} role="img" aria-label="review-to-kitchen-report: from customer reviews to a kitchen work order">`;
  s += `<defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="${th.faint}"/></pattern>
    <filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.18"/></filter></defs>`;
  s += `<rect width="${W}" height="${H}" rx="18" fill="${th.bg}"/><rect width="${W}" height="${H}" rx="18" fill="url(#dots)"/>`;
  // title block (right side, RTL)
  s += `<text x="${W - 56}" y="92" text-anchor="end" font-size="16" fill="${th.accent}" font-weight="700" letter-spacing="1">DAY 1 / 7 · RESTAURANTS · n8n + AI</text>`;
  s += `<text x="${W - 56}" y="150" text-anchor="start" direction="rtl" font-size="46" font-weight="800" fill="${th.text}">من شكوى زبون</text>`;
  s += `<text x="${W - 56}" y="206" text-anchor="start" direction="rtl" font-size="46" font-weight="800" fill="${th.accent}">لأمر شغل بالمطبخ</text>`;
  s += `<text x="${W - 56}" y="252" text-anchor="start" direction="rtl" font-size="18" fill="${th.muted}">كل أحد 9:00: تصنيف كل مراجعة وعدّ الأنماط،</text>`;
  s += `<text x="${W - 56}" y="280" text-anchor="start" direction="rtl" font-size="18" fill="${th.muted}">و3 قرارات تشغيلية للمدير والشيف</text>`;
  s += `<text x="${W - 56}" y="364" text-anchor="end" font-size="15" fill="${th.muted}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">review-to-kitchen-report</text>`;
  // bubbles (left)
  bubbles.forEach(([st, txt], i) => {
    const x = 48 + (i % 2) * 34, y = 52 + i * 84;
    s += `<g transform="rotate(${tilt[i]} ${x + 150} ${y + 30})" filter="url(#sh)"><rect x="${x}" y="${y}" width="300" height="62" rx="12" fill="${th.card}" stroke="${th.border}"/>`;
    s += `<text x="${x + 284}" y="${y + 24}" text-anchor="end" font-size="13" fill="#d99a06">${st}</text>`;
    const ar = /[\u0600-\u06FF]/.test(txt);
    s += `<text x="${x + 284}" y="${y + 47}" text-anchor="${ar ? 'start' : 'end'}" direction="${ar ? 'rtl' : 'ltr'}" font-size="15" fill="${th.text}">${esc(txt)}</text></g>`;
  });
  // arrow
  s += `<path d="M390 210 C 420 210, 430 210, 452 210" stroke="${th.accent}" stroke-width="3" fill="none"/><path d="M452 202 L466 210 L452 218 Z" fill="${th.accent}"/>`;
  // ticket
  const tx = 486, ty = 40, tw = 250, tht = 330;
  let zig = `M${tx} ${ty} H${tx + tw} V${ty + tht}`;
  for (let k = 0; k < 10; k++) zig += ` l${-tw / 20} 10 l${-tw / 20} -10`;
  zig += ' Z';
  s += `<g filter="url(#sh)" transform="rotate(1.5 ${tx + tw / 2} ${ty + tht / 2})"><path d="${zig}" fill="${th.paper}"/>`;
  const ink = '#1d1d1d', mono = "font-family=\"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace\"";
  const line = (yy) => `<line x1="${tx + 18}" x2="${tx + tw - 18}" y1="${yy}" y2="${yy}" stroke="${th.paperLine}" stroke-dasharray="4 4"/>`;
  s += `<text x="${tx + tw / 2}" y="${ty + 36}" text-anchor="middle" font-size="18" font-weight="800" fill="${ink}" direction="rtl">أمر شغل · المطبخ</text>`;
  s += `<text x="${tx + tw / 2}" y="${ty + 58}" text-anchor="middle" font-size="12" fill="#6b6b6b" ${mono}>#001 · 2026-11-22 09:00</text>`;
  s += line(ty + 74);
  s += `<text x="${tx + tw - 20}" y="${ty + 104}" text-anchor="start" font-size="17" font-weight="700" fill="${ink}" direction="rtl">شاورما · الجمعة مسائي</text>`;
  s += `<text x="${tx + tw - 20}" y="${ty + 132}" text-anchor="start" font-size="15" fill="${ink}" direction="rtl">5 شكاوى: أكل بارد</text>`;
  s += `<text x="${tx + tw - 20}" y="${ty + 156}" text-anchor="end" font-size="13" fill="#6b6b6b" ${mono}>18:40–21:30 · R021–R025</text>`;
  s += line(ty + 176);
  s += `<text x="${tx + tw - 20}" y="${ty + 206}" text-anchor="start" font-size="14" fill="${ink}" direction="rtl">☐ قياس حرارة الصاج كل ساعة</text>`;
  s += `<text x="${tx + tw - 20}" y="${ty + 232}" text-anchor="start" font-size="14" fill="${ink}" direction="rtl">☐ المسؤول: الشيف</text>`;
  s += `<text x="${tx + tw - 20}" y="${ty + 258}" text-anchor="start" font-size="14" fill="${ink}" direction="rtl">☐ قبل شفت الجمعة الجاي</text>`;
  s += line(ty + 276);
  s += `<text x="${tx + tw / 2}" y="${ty + 302}" text-anchor="middle" font-size="12" fill="#b42318" font-weight="700" ${mono}>PRIORITY: HIGH</text></g>`;
  return s + '</svg>';
}

for (const [mode, th] of Object.entries(THEMES)) {
  writeFileSync(join(out, `hero-${mode}.svg`), hero(th));
  writeFileSync(join(out, `heatmap-${mode}.svg`), heatmap(th));
  writeFileSync(join(out, `plan-vs-reality-${mode}.svg`), planVsReality(th));
}
console.log('heatmap grid (lunch/evening × Sun..Sat):', JSON.stringify(grid.map((r) => r.map((c) => c.n))));
console.log('assets written:', ['hero', 'heatmap', 'plan-vs-reality'].map((n) => `${n}-{light,dark}.svg`).join(', '));
