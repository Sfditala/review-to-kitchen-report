// Build a mobile-friendly RTL HTML email (inline styles only: Gmail strips <style>).
const cfg = $('Config').first().json;
const agg = $('Aggregate patterns').first().json;
const rows = $('Parse classification').all().map((i) => i.json);
const res = $input.first().json;

let plan;
try {
  plan = JSON.parse(res.choices[0].message.content);
} catch (e) {
  throw new Error('Could not parse decisions from OpenAI: ' + JSON.stringify(res).slice(0, 300));
}
const decisions = (plan.decisions || []).slice(0, 3);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sevColor = (s) => (s >= 5 ? '#b42318' : s >= 3 ? '#c2410c' : '#a16207');
const prioColor = { 'عالية': '#b42318', 'متوسطة': '#c2410c', 'منخفضة': '#4b5563' };
const stars = (n) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '');
const week = rows[0] ? rows[0].week : { from: '', to: '' };
const { stats } = agg;

const FONT = "font-family:Tahoma,Arial,sans-serif;";
const card = 'background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:0 0 12px;';
const h2 = 'font-size:16px;margin:22px 0 10px;color:#111827;';

const statCell = (label, value, color) =>
  `<td style="width:25%;text-align:center;padding:10px 4px;background:#f9fafb;border-radius:8px;">
     <div style="font-size:20px;font-weight:bold;color:${color};">${esc(value)}</div>
     <div style="font-size:12px;color:#6b7280;">${label}</div></td>`;

const decisionsHtml = decisions.map((d, i) => `
  <div style="${card}border-right:4px solid ${prioColor[d.priority] || '#4b5563'};">
    <div style="font-size:12px;color:${prioColor[d.priority] || '#4b5563'};font-weight:bold;">قرار ${i + 1} · أولوية ${esc(d.priority)} · ${esc(d.owner)}</div>
    <div style="font-size:15px;font-weight:bold;margin:6px 0;color:#111827;">${esc(d.title)}</div>
    <div style="font-size:13px;color:#374151;margin:0 0 6px;">📊 ${esc(d.evidence)}</div>
    <div style="font-size:13px;color:#111827;background:#f0fdf4;border-radius:6px;padding:8px;">✅ ${esc(d.action)}</div>
  </div>`).join('');

const tableRow = (cells, header = false) =>
  `<tr>${cells.map((c) => `<${header ? 'th' : 'td'} style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;${header ? 'color:#6b7280;font-weight:normal;' : ''}">${c}</${header ? 'th' : 'td'}>`).join('')}</tr>`;

const repeated = agg.byDishShiftIssue.filter((g) => g.count >= 2);
const singles = agg.byDishShiftIssue.filter((g) => g.count === 1).length;
const patternsHtml = repeated.length
  ? `<table role="presentation" style="width:100%;border-collapse:collapse;">
      ${tableRow(['الصحن · الشفت', 'المشكلة', 'العدد', 'الحدّة'], true)}
      ${repeated.map((g) => tableRow([
        `<b>${esc(g.dish)}</b><br><span style="color:#6b7280;font-size:12px;">${esc(g.shift)}</span>`,
        esc(g.issue_ar), `<b>${g.count}</b>`,
        `<span style="color:${sevColor(g.severity_avg)};">${g.severity_avg}/5</span>`])).join('')}
    </table>`
  : '<p style="font-size:13px;color:#6b7280;">ما في أنماط متكررة لنفس الصحن بنفس الشفت هالأسبوع.</p>';

const weekPart = agg.byIssueWeekPart.filter((g) => g.count >= 2);
const weekPartHtml = weekPart.length
  ? `<div style="font-size:13px;font-weight:bold;margin:16px 0 0;color:#111827;">📅 حسب الفترة (كل الأصناف)</div>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:4px;">
      ${tableRow(['المشكلة', 'الفترة', 'العدد'], true)}
      ${weekPart.map((g) => tableRow([esc(g.issue_ar), esc(g.week_part), `<b>${g.count}</b>`])).join('')}
    </table>` : '';

const negatives = rows.filter((r) => r.reply_draft).sort((a, b) => b.severity - a.severity);
const repliesHtml = negatives.map((r) => `
  <div style="${card}">
    <div style="font-size:12px;color:#6b7280;">${esc(r.review_id)} · ${esc(r.source)} · ${esc(r.shift)} · <span style="color:#d97706;">${stars(r.rating)}</span></div>
    <div style="font-size:13px;color:#374151;margin:6px 0;">«${esc(r.review_text.slice(0, 220))}»</div>
    <div style="font-size:12px;color:${sevColor(r.severity)};margin:0 0 6px;">${esc(r.summary)}</div>
    <div style="font-size:13px;color:#111827;background:#f3f4f6;border-radius:6px;padding:8px;" dir="auto">✍️ ${esc(r.reply_draft)}</div>
  </div>`).join('');

const sheetUrl = 'https://docs.google.com' + `/spreadsheets/d/${cfg.sheet_id}`;

const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<div dir="rtl" style="${FONT}max-width:600px;margin:0 auto;padding:16px;background:#f3f4f6;color:#111827;line-height:1.6;">
  <div style="font-size:13px;color:#6b7280;">${esc(cfg.restaurant_name)} · تقرير المراجعات الأسبوعي</div>
  <div style="font-size:12px;color:#9ca3af;margin-bottom:12px;">${esc(week.from)} ← ${esc(week.to)}</div>

  <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:14px 16px;font-size:16px;font-weight:bold;color:#9a3412;">${esc(plan.headline)}</div>

  <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:6px;margin:12px 0;"><tr>
    ${statCell('مراجعة', stats.total, '#111827')}
    ${statCell('فيها مشكلة', stats.issues, '#c2410c')}
    ${statCell('إيجابية', stats.positive, '#15803d')}
    ${statCell('معدّل التقييم', stats.avg_rating ?? '-', '#d97706')}
  </tr></table>

  <h2 style="${h2}">🎯 3 قرارات لهالأسبوع</h2>
  ${decisionsHtml}

  <h2 style="${h2}">🔁 الأنماط المتكررة (نفس الصحن · نفس الشفت)</h2>
  <div style="${card}">${patternsHtml}${weekPartHtml}
    <div style="font-size:12px;color:#6b7280;margin-top:8px;">+ ${singles} شكوى منفردة (التفاصيل بالشيت)</div>
  </div>

  <h2 style="${h2}">✍️ مسودات ردود جاهزة (${negatives.length})</h2>
  <div style="font-size:12px;color:#6b7280;margin:-4px 0 8px;">راجعها قبل النشر. المسودة ما بتوعد بتعويض.</div>
  ${repliesHtml}

  ${stats.needs_review ? `<div style="${card}color:#b42318;font-size:13px;">⚠️ ${stats.needs_review} مراجعة ما انصنّفت تلقائياً، معلّمة بالشيت.</div>` : ''}

  <div style="text-align:center;margin:20px 0 8px;">
    <a href="${sheetUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;">افتح الشيت الكامل</a>
  </div>
  <div style="font-size:11px;color:#9ca3af;text-align:center;">تقرير تلقائي · التصنيف بالذكاء الاصطناعي، والعدّ بالكود</div>
</div></body></html>`;

return [{
  json: {
    to: cfg.report_to,
    subject: `📋 مراجعات الأسبوع · ${cfg.restaurant_name} · ${week.from} ← ${week.to}`,
    headline: plan.headline,
    decisions,
    html,
  },
}];
