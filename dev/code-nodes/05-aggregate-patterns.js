// Counting happens HERE in code, not inside the model.
// The model only receives the finished numbers and turns them into decisions.
const cfg = $('Config').first().json;
const rows = $('Parse classification').all().map((i) => i.json);

const ISSUE_AR = {
  cold_food: 'أكل بارد', taste_quality: 'طعم/جودة', portion_size: 'الكمية', hygiene: 'نظافة',
  wait_time: 'انتظار', delivery_delay: 'تأخير توصيل', order_accuracy: 'غلط بالطلب',
  packaging: 'تغليف', staff_behavior: 'تعامل الموظفين', price: 'السعر', ambience: 'الأجواء',
  other: 'أخرى', none: 'لا يوجد',
};

const issues = rows.filter((r) => r.is_issue);

function groupBy(list, keyFields) {
  const map = new Map();
  for (const r of list) {
    const key = keyFields.map((f) => r[f]).join(' | ');
    if (!map.has(key)) {
      const g = { count: 0, severity_sum: 0, review_ids: [], visit_hours: [], examples: [] };
      keyFields.forEach((f) => (g[f] = r[f]));
      map.set(key, g);
    }
    const g = map.get(key);
    g.count++;
    g.severity_sum += r.severity;
    g.review_ids.push(r.review_id);
    g.visit_hours.push(r.visit_hour);
    if (g.examples.length < 3) g.examples.push(r.summary);
  }
  return [...map.values()]
    .map((g) => ({ ...g, issue_ar: ISSUE_AR[g.issue_type], severity_avg: +(g.severity_sum / g.count).toFixed(1) }))
    .sort((a, b) => b.count - a.count || b.severity_sum - a.severity_sum);
}

const byDishShiftIssue = groupBy(issues, ['dish', 'shift', 'issue_type']);
const byIssueWeekPart = groupBy(issues, ['issue_type', 'week_part']);
const byDishIssue = groupBy(issues, ['dish', 'issue_type']);

const rated = rows.filter((r) => r.rating !== null);
const stats = {
  total: rows.length,
  issues: issues.length,
  negative: rows.filter((r) => r.is_negative).length,
  positive: rows.filter((r) => !r.is_issue).length,
  avg_rating: rated.length ? +(rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1) : null,
  needs_review: rows.filter((r) => r.needs_review).length,
  tokens: rows.reduce((s, r) => s + (r.tokens || 0), 0),
};

const strip = ({ review_ids, severity_sum, ...g }) => g;
const llmInput = {
  week: rows[0] ? rows[0].week : null,
  stats,
  repeated_patterns_same_dish_same_shift: byDishShiftIssue.filter((g) => g.count >= 2).slice(0, 8).map(strip),
  issue_by_week_part: byIssueWeekPart.filter((g) => g.count >= 2).slice(0, 6).map(strip),
  dish_issue_all_shifts: byDishIssue.filter((g) => g.count >= 2).slice(0, 6).map(strip),
  critical_single_complaints: issues.filter((r) => r.severity >= 4)
    .map((r) => ({ dish: r.dish, shift: r.shift, issue_ar: ISSUE_AR[r.issue_type], severity: r.severity, summary: r.summary })),
};

const systemPrompt = `You are an operations consultant for "${cfg.restaurant_name}", a restaurant in Amman.
You get a weekly digest of customer complaints that was ALREADY counted by code. Write exactly 3 operational decisions for the manager and the head chef.

Rules:
- Decision 1 MUST address the first item of repeated_patterns_same_dish_same_shift (the strongest repeated pattern), if it exists.
- Decisions 2 and 3: the next strongest patterns. A critical single complaint (severity 5, hygiene/safety) outranks weaker repeated patterns.
- evidence: cite ONLY numbers present in the input (counts, shifts, visit_hours). Never invent numbers, staff names or causes stated as facts. A likely cause must be phrased as a hypothesis to check ("غالباً"، "تأكدوا إذا").
- action: one concrete, physical action that can be checked during the next shift (who checks what, when). Not "improve quality".
- If visit_hours show a time window, use it (e.g. between 18:00 and 21:30).
- Language: clear, simple Arabic (Jordanian-friendly), short sentences.
- headline: one line, format: "⚠️ <dish> بشفت <shift>: <count> شكاوى <issue>. الاقتراح: <short action>"`;

const decisionsBody = {
  model: cfg.model,
  temperature: 0.2,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: JSON.stringify(llmInput) },
  ],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'weekly_decisions',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['headline', 'decisions'],
        properties: {
          headline: { type: 'string' },
          decisions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'evidence', 'action', 'owner', 'priority'],
              properties: {
                title: { type: 'string' },
                evidence: { type: 'string' },
                action: { type: 'string' },
                owner: { type: 'string', enum: ['الشيف', 'مدير الصالة', 'مسؤول التوصيل', 'الإدارة'] },
                priority: { type: 'string', enum: ['عالية', 'متوسطة', 'منخفضة'] },
              },
            },
          },
        },
      },
    },
  },
};

return [{ json: { stats, byDishShiftIssue, byIssueWeekPart, llmInput, decisionsBody } }];
