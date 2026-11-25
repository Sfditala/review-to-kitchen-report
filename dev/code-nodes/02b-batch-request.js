// ONE request for the whole week instead of one per review.
// 40 reviews → 1 call. That keeps a free-tier key far below its daily limit,
// and the run takes seconds instead of minutes.
const cfg = $('Config').first().json;
const reviews = $input.all().map((i) => i.json);
if (!reviews.length) return [];

const ISSUE_TYPES = [
  'cold_food', 'taste_quality', 'portion_size', 'hygiene', 'wait_time', 'delivery_delay',
  'order_accuracy', 'packaging', 'staff_behavior', 'price', 'ambience', 'other', 'none',
];

// OpenAI's strict mode needs additionalProperties:false on every object; Gemini's
// OpenAI-compatible endpoint is happier without it. The code validates the answer either way.
const STRICT = /api\.openai\.com/.test(cfg.llm_url);
function lock(schema) {
  if (!STRICT || !schema || typeof schema !== 'object') return schema;
  const s = { ...schema };
  if (s.type === 'object') s.additionalProperties = false;
  if (s.properties) s.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, lock(v)]));
  if (s.items) s.items = lock(s.items);
  return s;
}

const systemPrompt = `You classify restaurant reviews for the kitchen and floor managers of "${cfg.restaurant_name}" (Amman, Jordan).
Reviews may be in Modern Standard Arabic, Levantine/Jordanian dialect, or English.
You get a JSON list of reviews. Return ONE result per review, with the same review_id. Judge each review on its own.

Rules:
- dish: the menu item the review is mainly about. Use "عام" when the point is not about a specific dish (delivery, staff, wait, ambience, general praise). Use "غير محدد" only if a dish is clearly meant but cannot be identified. A "ساندويش" in a shawarma context is "شاورما".
- issue_type: the PRIMARY problem. "none" if the review has no complaint at all.
  cold_food = food served cold/lukewarm. delivery_delay = late delivery (even if the food arrived cold because of it). wait_time = slow service or crowding in the restaurant.
- severity (0-5): 0 = no problem. 1 = minor remark inside a positive review. 2 = noticeable problem. 3 = clear failure that spoiled part of the meal. 4 = ruined the visit / customer says they won't return. 5 = health or safety (hair, foreign object, food poisoning, allergen).
- sentiment: overall tone.
- summary: Arabic, max 12 words, factual, no exaggeration.
- reply_draft: ONLY if the review contains a complaint or the rating is 3 or less; otherwise "". Same language as the review (dialect → warm, clear Arabic). Max 60 words. Thank them, acknowledge the specific issue, say what will be checked. Never promise refunds or free meals, never blame the customer, never invent facts. Sign as "${cfg.restaurant_name}".`;

const input = reviews.map((r) => ({ review_id: r.review_id, rating: r.rating, source: r.source, text: r.review_text }));

const body = {
  model: cfg.model,
  temperature: 0,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: JSON.stringify(input) },
  ],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'review_classifications',
      strict: STRICT,
      schema: lock({
        type: 'object',
        required: ['results'],
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              required: ['review_id', 'dish', 'issue_type', 'severity', 'sentiment', 'summary', 'reply_draft'],
              properties: {
                review_id: { type: 'string' },
                dish: { type: 'string', enum: [...cfg.menu, 'عام', 'غير محدد'] },
                issue_type: { type: 'string', enum: ISSUE_TYPES },
                severity: { type: 'integer', description: '0 to 5' },
                sentiment: { type: 'string', enum: ['positive', 'mixed', 'negative'] },
                summary: { type: 'string' },
                reply_draft: { type: 'string' },
              },
            },
          },
        },
      }),
    },
  },
};

return [{ json: { openai_body: body, review_count: reviews.length } }];
