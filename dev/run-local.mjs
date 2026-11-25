// Offline test: runs the workflow's Code nodes (read straight from workflow.json)
// in an n8n-like runtime, with Sheets read from data/reviews.csv and OpenAI MOCKED
// from data/expected-labels.csv. Checks the plumbing (filtering, counting, email),
// NOT the model's accuracy. The real model gets tested on the live run.
//   node dev/run-local.mjs            → strings in visit_datetime
//   node dev/run-local.mjs --serial   → dates as Sheets serial numbers
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wf = JSON.parse(readFileSync(join(root, 'workflow.json'), 'utf8'));
const SERIAL = process.argv.includes('--serial');

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
  const [h, ...body] = rows;
  return body.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}
const toSerial = (s) => {
  const [d, t] = s.split(' '); const [Y, M, D] = d.split('-').map(Number); const [hh, mm] = t.split(':').map(Number);
  return (Date.UTC(Y, M - 1, D, hh, mm) - Date.UTC(1899, 11, 30)) / 86400000;
};

const sheet = parseCsv(readFileSync(join(root, 'data/reviews.csv'), 'utf8')).map((r, i) => ({
  ...r, row_number: i + 2, rating: Number(r.rating), visit_datetime: SERIAL ? toSerial(r.visit_datetime) : r.visit_datetime,
}));
const truth = Object.fromEntries(parseCsv(readFileSync(join(root, 'data/expected-labels.csv'), 'utf8')).map((r) => [r.review_id, r]));

// ---- n8n-like runtime ----
const outputs = {};
const $now = { year: 2026, month: 11, day: 22, toFormat: () => '2026-11-22 09:00' };
const $ = (name) => {
  if (!outputs[name]) throw new Error(`Node "${name}" has not run`);
  return { all: () => outputs[name], first: () => outputs[name][0] };
};
const AsyncFn = Object.getPrototypeOf(async () => {}).constructor;
async function runCode(name, input) {
  const node = wf.nodes.find((n) => n.name === name);
  const fn = new AsyncFn('$', '$input', '$now', node.parameters.jsCode);
  const out = await fn($, { all: () => input, first: () => input[0] }, $now);
  outputs[name] = out;
  return out;
}

// ---- mocked OpenAI ----
const sevFor = (t, rating) => (t.expected_issue_type === 'none' ? 0 : t.expected_issue_type === 'hygiene' ? 5 : { 1: 4, 2: 3, 3: 2, 4: 1, 5: 1 }[rating]);
function mockClassify(item) {
  const body = item.json.openai_body;
  assert.equal(body.response_format.json_schema.strict, true);
  const t = truth[item.json.review_id];
  const sev = sevFor(t, item.json.rating);
  const content = {
    dish: t.expected_dish, issue_type: t.expected_issue_type, severity: sev,
    sentiment: sev === 0 ? 'positive' : sev >= 3 ? 'negative' : 'mixed',
    summary: `ملخص تجريبي (${t.expected_issue_type})`,
    reply_draft: sev > 0 || item.json.rating <= 3 ? 'شكراً على ملاحظتك، رح نراجع الموضوع مع الفريق. بيت الصاج' : '',
  };
  // Enum check: the mocked answer must be valid against the schema we send.
  const props = body.response_format.json_schema.schema.properties;
  for (const k of ['dish', 'issue_type', 'severity']) assert.ok(props[k].enum.includes(content[k]), `${k}=${content[k]} not in enum`);
  if (item.json.review_id === 'R010') return { json: { choices: [{ message: { content: 'not json' } }] } }; // simulate a bad answer
  return { json: { choices: [{ message: { content: JSON.stringify(content) } }], usage: { total_tokens: 420 } } };
}
function mockDecisions(agg) {
  const p = agg.llmInput.repeated_patterns_same_dish_same_shift[0];
  return { json: { choices: [{ message: { content: JSON.stringify({
    headline: `⚠️ ${p.dish} بشفت ${p.shift}: ${p.count} شكاوى ${p.issue_ar}. الاقتراح: راجعوا تسخين الصاج بعد 6 المسا.`,
    decisions: [
      { title: `${p.dish} باردة بشفت ${p.shift}`, evidence: `${p.count} شكاوى بين ${Math.min(...p.visit_hours)}:00 و ${Math.max(...p.visit_hours)}:30`, action: 'الشيف يقيس حرارة الصاج كل ساعة من 6 لـ 10 المسا الجمعة الجاي ويسجّلها.', owner: 'الشيف', priority: 'عالية' },
      { title: 'تأخير التوصيل بالويكند', evidence: '3 شكاوى تأخير (70–75 دقيقة) يومي الجمعة والسبت', action: 'زيادة سائق واحد من 1 لـ 9 المسا الجمعة والسبت كتجربة لأسبوعين.', owner: 'مسؤول التوصيل', priority: 'عالية' },
      { title: 'شعرة بالفتوش', evidence: 'شكوى وحدة بحدّة 5/5 (نظافة)', action: 'مدير الصالة يتأكد من غطاء الراس لكل فريق التحضير قبل كل شفت.', owner: 'مدير الصالة', priority: 'متوسطة' },
    ] }) } }] } };
}

// ---- run the chain ----
await runCode('Config', []);
outputs['Read reviews'] = sheet.map((json) => ({ json }));
const week = await runCode('Prepare week', outputs['Read reviews']);
outputs['Classify review (OpenAI)'] = week.map(mockClassify);
const parsed = await runCode('Parse classification', outputs['Classify review (OpenAI)']);
const cols = await runCode('Sheet columns', parsed);
outputs['Write labels to sheet'] = cols;
const [agg] = await runCode('Aggregate patterns', cols);
outputs['Write 3 decisions (OpenAI)'] = [mockDecisions(agg.json)];
const [mail] = await runCode('Build email', outputs['Write 3 decisions (OpenAI)']);

// ---- checks ----
const ids = week.map((i) => i.json.review_id);
const check = (label, fn) => { fn(); console.log('✅', label); };

check('date filter: 40 reviews this week, R041/R042 (last week) excluded', () => {
  assert.equal(week.length, 40); assert.ok(!ids.includes('R041') && !ids.includes('R042'));
});
check('shift computed from visit time (R021 → الجمعة · مسائي, R007 → الثلاثاء · غداء)', () => {
  assert.equal(week.find((i) => i.json.review_id === 'R021').json.shift, 'الجمعة · مسائي');
  assert.equal(week.find((i) => i.json.review_id === 'R007').json.shift, 'الثلاثاء · غداء');
});
const top = agg.json.byDishShiftIssue[0];
check(`top pattern = شاورما · الجمعة مسائي · cold_food × 5 (got ${top.dish} · ${top.shift} · ${top.issue_type} × ${top.count})`, () => {
  assert.deepEqual([top.dish, top.shift, top.issue_type, top.count], ['شاورما', 'الجمعة · مسائي', 'cold_food', 5]);
  assert.deepEqual(top.review_ids.sort(), ['R021', 'R022', 'R023', 'R024', 'R025']);
});
check('decoy cold shawarma on Tuesday lunch is NOT merged into the Friday pattern', () => {
  assert.ok(!top.review_ids.includes('R007'));
});
check('delivery delays on the weekend grouped (×3)', () => {
  const g = agg.json.byIssueWeekPart.find((x) => x.issue_type === 'delivery_delay' && x.week_part === 'الويكند');
  assert.equal(g && g.count, 3);
});
check('positive reviews never counted as issues (incl. positive shawarma R008/R036/R040)', () => {
  const issueIds = agg.json.byDishShiftIssue.flatMap((g) => g.review_ids);
  for (const r of parsed.map((p) => p.json).filter((r) => truth[r.review_id].expected_issue_type === 'none')) {
    assert.ok(!issueIds.includes(r.review_id), r.review_id);
    assert.equal(r.reply_draft, '');
  }
});
check('bad model answer (R010) → flagged needs_review, run continues', () => {
  const r = parsed.find((p) => p.json.review_id === 'R010').json;
  assert.equal(r.needs_review, true); assert.ok(cols.find((c) => c.json.review_id === 'R010').json.summary.startsWith('⚠️'));
});
check('decisions model receives only aggregates (no review text)', () => {
  const s = JSON.stringify(agg.json.llmInput);
  assert.ok(!s.includes('review_text') && !s.includes('ساندويش بارد كأنو'));
});
check('email: RTL, ≤600px, all user text escaped', () => {
  assert.ok(mail.json.html.includes('dir="rtl"') && mail.json.html.includes('max-width:600px'));
  assert.ok(!/<script/i.test(mail.json.html));
});
check('sheet write-back has exactly the label columns', () => {
  assert.deepEqual(Object.keys(cols[0].json), ['review_id', 'dish', 'shift', 'issue_type', 'severity', 'summary', 'reply_draft', 'classified_at']);
});

console.log('\nstats:', JSON.stringify(agg.json.stats));
console.log('subject:', mail.json.subject);
mkdirSync(join(root, 'dev/out'), { recursive: true });
writeFileSync(join(root, 'dev/out/email-preview.html'), mail.json.html);
writeFileSync(join(root, 'dev/out/decisions-request.json'), JSON.stringify(agg.json.decisionsBody, null, 2));
console.log('→ dev/out/email-preview.html');
