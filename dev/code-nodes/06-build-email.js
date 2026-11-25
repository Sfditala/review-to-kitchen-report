// Build a mobile-friendly RTL HTML email (inline styles only: Gmail strips <style>).
const cfg = $('Config').first().json;
const agg = $('Aggregate patterns').first().json;
const rows = $('Parse classification').all().map((i) => i.json);
const res = $input.first().json;

let plan;
try {
  plan = JSON.parse(res.choices[0].message.content);
} catch (e) {
  throw new Error('Could not parse decisions from the model: ' + JSON.stringify(res).slice(0, 300));
}
const decisions = (plan.decisions || []).slice(0, 3);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stars = (n) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '');
const { stats } = agg;

// "15 إلى 21 نوفمبر 2026": a dash between two numbers gets flipped in Arabic text, a word doesn't
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const week = rows[0] ? rows[0].week : { from: '', to: '' };
function weekLabel(from, to) {
  if (!from || !to) return '';
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  if (y1 === y2 && m1 === m2) return `${d1} إلى ${d2} ${MONTHS[m1 - 1]} ${y1}`;
  return `${d1} ${MONTHS[m1 - 1]} إلى ${d2} ${MONTHS[m2 - 1]} ${y2}`;
}
const weekText = weekLabel(week.from, week.to);

// Palette
const C = {
  page: '#f4f1ec', card: '#ffffff', line: '#ebe6dd', ink: '#1c1917', soft: '#57534e', mute: '#8a8178',
  brand: '#1c1917', accent: '#ea580c', accentBg: '#fff4ec', accentLine: '#fdba8c',
  green: '#15803d', greenBg: '#effaf2', red: '#b42318', amber: '#b45309',
};
const FONT = "font-family:'Segoe UI',Tahoma,Arial,sans-serif;";
const prio = { 'عالية': C.red, 'متوسطة': C.amber, 'منخفضة': C.soft };
const sevColor = (s) => (s >= 5 ? C.red : s >= 3 ? C.accent : C.amber);
const pill = (text, color) =>
  `<span style="display:inline-block;padding:3px 10px;border-radius:999px;border:1px solid ${color};color:${color};font-size:12px;font-weight:600;margin-left:6px;">${esc(text)}</span>`;
const section = (title, inner, note = '') => `
  <tr><td style="padding:28px 24px 0;">
    <div style="font-size:18px;font-weight:700;color:${C.ink};margin:0 0 4px;">${title}</div>
    ${note ? `<div style="font-size:13px;color:${C.mute};margin:0 0 12px;">${note}</div>` : '<div style="height:12px;"></div>'}
    ${inner}
  </td></tr>`;

// Stats
const statCell = (value, label, color) => `
  <td width="25%" style="padding:0 4px;">
    <div style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:14px 4px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:${color};line-height:1.1;">${esc(value)}</div>
      <div style="font-size:13px;color:${C.mute};margin-top:4px;">${label}</div>
    </div>
  </td>`;

// Decisions
const decisionsHtml = decisions.map((d, i) => `
  <div style="background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:18px 18px 16px;margin:0 0 12px;">
    <table role="presentation" width="100%" style="border-collapse:collapse;"><tr>
      <td width="36" valign="top" style="padding-left:10px;">
        <div style="width:28px;height:28px;border-radius:50%;background:${C.brand};color:#fff;font-size:14px;font-weight:700;text-align:center;line-height:28px;">${i + 1}</div>
      </td>
      <td valign="top">
        <div style="margin:0 0 6px;">${pill('أولوية ' + d.priority, prio[d.priority] || C.soft)}${pill(d.owner, C.soft)}</div>
        <div style="font-size:17px;font-weight:700;color:${C.ink};margin:0 0 8px;line-height:1.5;">${esc(d.title)}</div>
        <div style="font-size:14px;color:${C.soft};margin:0 0 10px;line-height:1.7;">${esc(d.evidence)}</div>
        <div style="font-size:15px;color:${C.ink};background:${C.greenBg};border-radius:10px;padding:10px 12px;line-height:1.7;">
          <b style="color:${C.green};">الإجراء:</b> ${esc(d.action)}</div>
      </td>
    </tr></table>
  </div>`).join('');

// Patterns
const tableRow = (cells, header = false) =>
  `<tr>${cells.map((c, i) => `<${header ? 'th' : 'td'} style="padding:10px 8px;border-bottom:1px solid ${C.line};text-align:${i >= 2 ? 'center' : 'right'};font-size:14px;${header ? `color:${C.mute};font-weight:600;font-size:12px;` : `color:${C.ink};`}">${c}</${header ? 'th' : 'td'}>`).join('')}</tr>`;
const repeated = agg.byDishShiftIssue.filter((g) => g.count >= 2);
const singles = agg.byDishShiftIssue.filter((g) => g.count === 1).length;
const weekPart = agg.byIssueWeekPart.filter((g) => g.count >= 2);
const patternsHtml = `
  <div style="background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:6px 14px 14px;">
    ${repeated.length ? `<table role="presentation" width="100%" style="border-collapse:collapse;">
      ${tableRow(['الصحن · الشفت', 'المشكلة', 'العدد', 'الحدّة'], true)}
      ${repeated.map((g) => tableRow([
        `<b>${esc(g.dish)}</b><div style="color:${C.mute};font-size:12px;">${esc(g.shift)}</div>`,
        esc(g.issue_ar), `<b style="font-size:18px;">${g.count}</b>`,
        `<span style="color:${sevColor(g.severity_avg)};font-weight:600;">${g.severity_avg}/5</span>`])).join('')}
    </table>` : `<div style="font-size:14px;color:${C.mute};padding:10px 0;">ما في أنماط متكررة لنفس الصحن بنفس الشفت هالأسبوع.</div>`}
    ${weekPart.length ? `<div style="font-size:13px;font-weight:700;color:${C.soft};margin:16px 0 0;">حسب الفترة (كل الأصناف)</div>
    <table role="presentation" width="100%" style="border-collapse:collapse;">
      ${weekPart.map((g) => tableRow([esc(g.issue_ar), esc(g.week_part), `<b style="font-size:18px;">${g.count}</b>`, ''])).join('')}
    </table>` : ''}
    <div style="font-size:13px;color:${C.mute};margin-top:12px;">+ ${singles} شكوى منفردة، تفاصيلها بالشيت</div>
  </div>`;

// Draft replies
const negatives = rows.filter((r) => r.reply_draft).sort((a, b) => b.severity - a.severity);
const repliesHtml = negatives.map((r) => `
  <div style="background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:14px 16px;margin:0 0 10px;">
    <div style="font-size:12px;color:${C.mute};">${esc(r.source)} · ${esc(r.shift)} · <span style="color:#d97706;letter-spacing:1px;">${stars(r.rating)}</span></div>
    <div style="font-size:14px;color:${C.ink};margin:8px 0;line-height:1.7;">«${esc(r.review_text.slice(0, 220))}»</div>
    <div style="font-size:12px;color:${sevColor(r.severity)};font-weight:600;margin:0 0 8px;">${esc(r.summary)}</div>
    <div style="font-size:14px;color:${C.soft};background:#f7f5f1;border-radius:10px;padding:10px 12px;line-height:1.7;" dir="auto">${esc(r.reply_draft)}</div>
  </div>`).join('');

const sheetUrl = 'https://docs.google.com' + `/spreadsheets/d/${cfg.sheet_id}`;

const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.page};">
<table role="presentation" width="100%" style="border-collapse:collapse;background:${C.page};"><tr><td align="center" style="padding:24px 10px;">
<table role="presentation" width="100%" dir="rtl" style="${FONT}max-width:640px;border-collapse:collapse;color:${C.ink};line-height:1.6;">

  <tr><td style="background:${C.brand};border-radius:18px 18px 0 0;padding:26px 24px 22px;">
    <div style="font-size:13px;color:#d6d3d1;letter-spacing:.5px;">تقرير المطبخ الأسبوعي</div>
    <div style="font-size:26px;font-weight:800;color:#ffffff;margin:4px 0 2px;">${esc(cfg.restaurant_name)}</div>
    <div style="font-size:14px;color:#a8a29e;">${esc(weekText)} · ${stats.total} مراجعة</div>
  </td></tr>

  <tr><td style="background:${C.accentBg};border:1px solid ${C.accentLine};border-top:0;border-radius:0 0 18px 18px;padding:18px 24px;">
    <div style="font-size:12px;font-weight:700;color:${C.accent};margin:0 0 4px;">أهم إشي هالأسبوع</div>
    <div style="font-size:19px;font-weight:700;color:#7c2d12;line-height:1.6;">${esc(plan.headline)}</div>
  </td></tr>

  <tr><td style="padding:16px 20px 0;">
    <table role="presentation" width="100%" style="border-collapse:collapse;"><tr>
      ${statCell(stats.total, 'مراجعة', C.ink)}
      ${statCell(stats.issues, 'فيها مشكلة', C.accent)}
      ${statCell(stats.positive, 'إيجابية', C.green)}
      ${statCell(stats.avg_rating ?? '-', 'التقييم', C.amber)}
    </tr></table>
  </td></tr>

  ${section('3 قرارات لهالأسبوع', decisionsHtml, 'كل قرار مبني على أرقام الأسبوع، وإله مسؤول وإجراء بينفحص بالشفت الجاي.')}
  ${section('الأنماط المتكررة', patternsHtml, 'نفس الصحن، نفس الشفت، نفس المشكلة.')}
  ${negatives.length ? section(`مسودات ردود جاهزة (${negatives.length})`, repliesHtml, 'راجعها قبل النشر. ما بتوعد بتعويض وما بتلوم الزبون.') : ''}
  ${stats.needs_review ? `<tr><td style="padding:16px 24px 0;"><div style="background:#fff1f0;border:1px solid #fecaca;border-radius:12px;padding:12px 14px;font-size:14px;color:${C.red};">⚠️ ${stats.needs_review} مراجعة ما انصنّفت تلقائياً، معلّمة بالشيت.</div></td></tr>` : ''}

  <tr><td align="center" style="padding:28px 24px 8px;">
    <a href="${sheetUrl}" style="display:inline-block;background:${C.brand};color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:999px;font-size:15px;font-weight:600;">افتح الشيت الكامل</a>
  </td></tr>
  <tr><td align="center" style="padding:8px 24px 0;font-size:12px;color:${C.mute};">
    تقرير تلقائي كل أحد الساعة 9 · التصنيف بالذكاء الاصطناعي، والعدّ بالكود
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

return [{
  json: {
    to: cfg.report_to,
    subject: `تقرير المطبخ · ${cfg.restaurant_name} · ${weekText}`,
    headline: plan.headline,
    decisions,
    html,
  },
}];
