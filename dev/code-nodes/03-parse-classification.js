// Join each OpenAI response back to its review (same order, 1:1) and validate it.
// Anything the model returns that breaks the rules is corrected here, in code.
const reviews = $('Prepare week').all();
const responses = $input.all();
if (reviews.length !== responses.length) {
  throw new Error(`Got ${responses.length} classifications for ${reviews.length} reviews`);
}

const classifiedAt = $now.toFormat('yyyy-MM-dd HH:mm');

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
