// Filter this week's reviews and compute the shift FROM THE DATA (not from the model).
const cfg = $('Config').first().json;


const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
// Sheets may return a date as a serial number (auto-detected) or as text.
// All times are handled as "wall clock" via UTC methods, so no timezone shift.
function parseWallClock(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000));
  const m = String(v).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)));
}

function todayWallClock() {
  if (cfg.reference_date) return parseWallClock(cfg.reference_date);
  // $now is a Luxon DateTime in the workflow timezone (Asia/Amman)
  return new Date(Date.UTC($now.year, $now.month - 1, $now.day));
}

const end = todayWallClock();                                   // exclusive
const start = new Date(end.getTime() - cfg.lookback_days * 86400000);
const fmt = (d) => d.toISOString().slice(0, 10);

const out = [];
for (const item of $input.all()) {
  const r = item.json;
  if (!r.review_id || !String(r.review_text || '').trim()) continue;

  const visit = parseWallClock(r.visit_datetime) || parseWallClock(r.review_date);
  if (!visit || visit < start || visit >= end) continue;

  const dow = visit.getUTCDay();
  const part = visit.getUTCHours() < cfg.evening_starts_at_hour ? 'غداء' : 'مسائي';

  const row = {
    review_id: String(r.review_id),
    visit_date: fmt(visit),
    visit_hour: visit.getUTCHours(),
    weekday: dow,
    shift: `${DAYS_AR[dow]} · ${part}`,
    week_part: cfg.weekend_days.includes(dow) ? 'الويكند' : 'أيام الدوام',
    source: r.source || '',
    rating: Number(r.rating) || null,
    reviewer: r.reviewer || '',
    review_text: String(r.review_text).trim(),
  };

  out.push({ json: row });
}

// Keep the window on every item so later nodes (and the email) can show it.
const window = { from: fmt(start), to: fmt(new Date(end.getTime() - 86400000)) };
return out.map((o) => ({ json: { ...o.json, week: window } }));
