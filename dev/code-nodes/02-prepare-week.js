// Filter this week's reviews, compute the shift FROM THE DATA (not from the model),
// and build one OpenAI Structured Output request per review.
const cfg = $('Config').first().json;

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ISSUE_TYPES = [
  'cold_food', 'taste_quality', 'portion_size', 'hygiene', 'wait_time', 'delivery_delay',
  'order_accuracy', 'packaging', 'staff_behavior', 'price', 'ambience', 'other', 'none',
];

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

const systemPrompt = `You classify restaurant reviews for the kitchen and floor managers of "${cfg.restaurant_name}" (Amman, Jordan).
Reviews may be in Modern Standard Arabic, Levantine/Jordanian dialect, or English.

Return ONLY the JSON defined by the schema. Rules:
- dish: the menu item the review is mainly about. Use "عام" when the point is not about a specific dish (delivery, staff, wait, ambience, general praise). Use "غير محدد" only if a dish is clearly meant but cannot be identified. A "ساندويش" in a shawarma context is "شاورما".
- issue_type: the PRIMARY problem. "none" if the review has no complaint at all.
  cold_food = food served cold/lukewarm. delivery_delay = late delivery (even if the food arrived cold because of it). wait_time = slow service or crowding in the restaurant.
- severity (0-5): 0 = no problem. 1 = minor remark inside a positive review. 2 = noticeable problem. 3 = clear failure that spoiled part of the meal. 4 = ruined the visit / customer says they won't return. 5 = health or safety (hair, foreign object, food poisoning, allergen).
- sentiment: overall tone.
- summary: Arabic, max 12 words, factual, no exaggeration.
- reply_draft: ONLY if the review contains a complaint or the rating is 3 or less; otherwise "". Same language as the review (dialect → warm, clear Arabic). Max 60 words. Thank them, acknowledge the specific issue, say what will be checked. Never promise refunds or free meals, never blame the customer, never invent facts. Sign as "${cfg.restaurant_name}".`;

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

  row.openai_body = {
    model: cfg.model,
    temperature: 0,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Rating: ${row.rating ?? 'n/a'}/5\nSource: ${row.source}\nReview:\n${row.review_text}` },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'review_classification',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['dish', 'issue_type', 'severity', 'sentiment', 'summary', 'reply_draft'],
          properties: {
            dish: { type: 'string', enum: [...cfg.menu, 'عام', 'غير محدد'] },
            issue_type: { type: 'string', enum: ISSUE_TYPES },
            severity: { type: 'integer', enum: [0, 1, 2, 3, 4, 5] },
            sentiment: { type: 'string', enum: ['positive', 'mixed', 'negative'] },
            summary: { type: 'string' },
            reply_draft: { type: 'string' },
          },
        },
      },
    },
  };
  out.push({ json: row });
}

// Keep the window on every item so later nodes (and the email) can show it.
const window = { from: fmt(start), to: fmt(new Date(end.getTime() - 86400000)) };
return out.map((o) => ({ json: { ...o.json, week: window } }));
