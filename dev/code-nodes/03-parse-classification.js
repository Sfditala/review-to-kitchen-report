// Join each OpenAI response back to its review (same order, 1:1) and validate it.
// Anything the model returns that breaks the rules is corrected here, in code.
const reviews = $('Prepare week').all();
const responses = $input.all();
if (reviews.length !== responses.length) {
  throw new Error(`Got ${responses.length} classifications for ${reviews.length} reviews`);
}

const classifiedAt = $now.toFormat('yyyy-MM-dd HH:mm');
const cfg = $('Config').first().json;
const DISHES = new Set([...cfg.menu, 'عام', 'غير محدد']);
const ISSUES = new Set(['cold_food', 'taste_quality', 'portion_size', 'hygiene', 'wait_time', 'delivery_delay',
  'order_accuracy', 'packaging', 'staff_behavior', 'price', 'ambience', 'other', 'none']);

return reviews.map((rev, i) => {
  const { openai_body, ...row } = rev.json;
  const res = responses[i].json;
  let c = null;
  let needs_review = false;

  try {
    const msg = res.choices[0].message;
    if (msg.refusal) throw new Error('refusal');
    c = JSON.parse(msg.content);
  } catch (e) {
    needs_review = true;
    c = { dish: 'غير محدد', issue_type: 'other', severity: 2, sentiment: 'mixed',
          summary: 'تعذّر التصنيف تلقائياً، راجعها يدوياً', reply_draft: '' };
  }

  // Values outside the lists are corrected here, whichever model answered
  if (!needs_review) {
    if (!DISHES.has(c.dish)) c.dish = 'غير محدد';
    if (!ISSUES.has(c.issue_type)) { c.issue_type = 'other'; needs_review = true; }
    c.severity = Math.max(0, Math.min(5, Math.round(Number(c.severity) || 0)));
    c.summary = String(c.summary || '');
    c.reply_draft = String(c.reply_draft || '');
  }

  // Consistency rules
  if (c.issue_type === 'none') c.severity = 0;
  if (c.issue_type !== 'none' && c.severity === 0) c.severity = 1;

  const is_issue = c.issue_type !== 'none';
  const is_negative = (row.rating !== null && row.rating <= 3) || c.severity >= 3;

  return {
    json: {
      ...row,
      dish: c.dish,
      issue_type: c.issue_type,
      severity: c.severity,
      sentiment: c.sentiment,
      summary: c.summary,
      reply_draft: is_negative || is_issue ? c.reply_draft : '',
      is_issue,
      is_negative,
      needs_review,
      classified_at: classifiedAt,
      tokens: res.usage ? res.usage.total_tokens : null,
    },
  };
});
