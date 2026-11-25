// ============================================================
//  ⚙️ CONFIG: the only node you need to edit
// ============================================================
return [{
  json: {
    // Google Sheet ID: the long string in the sheet's URL between /d/ and /edit
    sheet_id: 'YOUR_GOOGLE_SHEET_ID',
    // Tab name, exactly as it appears at the bottom of the sheet.
    // A sheet created by importing a CSV may call it "Untitled" or "Sheet1".
    sheet_tab: 'Sheet1',

    // Who gets the weekly email (comma separated)
    report_to: 'YOUR_EMAIL@example.com',

    restaurant_name: 'بيت الصاج',
    // Language model, through the OpenAI-compatible chat API.
    // Credential: "Header Auth" with Name = Authorization, Value = Bearer <your key>.
    //   FREE  · Google Gemini (key from aistudio.google.com/apikey):
    llm_url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-3.5-flash',
    //   PAID  · OpenAI: llm_url 'https://api.openai.com/v1/chat/completions', model 'gpt-4.1-mini'

    // Week window. reference_date = "today" for the filter.
    //   DEMO: '2026-11-22' → reads the demo week 15–21 Nov 2026
    //   PRODUCTION: '' → uses the real date when the Schedule fires
    reference_date: '2026-11-22',
    lookback_days: 7,

    // Shift split: visits before this hour = lunch (غداء), after = evening (مسائي)
    evening_starts_at_hour: 16,
    // Jordan weekend = Friday (5) + Saturday (6)
    weekend_days: [5, 6],

    // Closed list of dishes → the model can't invent new dish names,
    // so "شاورما" and "ساندويش شاورما دجاج" end up in the same bucket.
    menu: ['شاورما', 'فلافل', 'حمص', 'فتة', 'منسف', 'مشاوي مشكلة', 'كبة', 'فتوش', 'بطاطا', 'خبز', 'كنافة', 'عصائر'],
  },
}];
