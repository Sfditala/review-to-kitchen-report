// Assembles ../workflow.json from the Code-node sources in ./code-nodes.
// Edit the .js files, then run:  node dev/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const code = (f) => readFileSync(join(here, 'code-nodes', f), 'utf8');
const id = () => randomUUID();
const X = 260; // horizontal spacing

const sheetDoc = { __rl: true, mode: 'id', value: "={{ $('Config').first().json.sheet_id }}" };
const sheetTab = { __rl: true, mode: 'name', value: "={{ $('Config').first().json.sheet_tab }}" };
// Optional dev/local.json (git-ignored) fills in my own IDs and writes workflow.local.json for import.
// The committed workflow.json always keeps placeholders, like my other repos.
import { existsSync } from 'node:fs';
const localPath = join(here, 'local.json');
const local = existsSync(localPath) ? JSON.parse(readFileSync(localPath, 'utf8')) : null;

const openAiCall = (name, pos, batch) => ({
  id: id(), name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos,
  // Two tries only: on a free tier a failed call should not burn the daily quota with retries.
  retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
  parameters: {
    method: 'POST',
    // Works with any OpenAI-compatible chat API (Gemini free tier, OpenAI, Groq…): URL and model live in Config.
    url: "={{ $('Config').first().json.llm_url }}",
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: batch ? '={{ JSON.stringify($json.openai_body) }}' : '={{ JSON.stringify($json.decisionsBody) }}',
    // The whole week goes in one call, so give the model time to answer all of it.
    options: { timeout: 180000 },
  },
});

const codeNode = (name, file, pos) => ({
  id: id(), name, type: 'n8n-nodes-base.code', typeVersion: 2, position: pos,
  parameters: { jsCode: code(file) },
});

const sticky = (name, content, pos, w, h, color) => ({
  id: id(), name, type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: pos,
  parameters: { content, width: w, height: h, color },
});

const y = 300;
const nodes = [
  sticky('Note · Setup', `## ⚙️ قبل أول تشغيل
1. **Config** ← \`sheet_id\` + إيميلك بـ \`report_to\`
2. credentials:
   - **Read reviews** + **Write labels** ← Google Sheets OAuth2
   - **Classify** + **Decisions** ← Header Auth: \`Authorization\` = \`Bearer <مفتاح Gemini>\`
   - **Send report** ← Gmail OAuth2
3. للديمو: خلّي \`reference_date = 2026-11-22\`
4. للإنتاج: \`reference_date = ''\` ثم **Publish**

🔐 ولا مفتاح مكتوب بأي node.`, [-620, 20], 420, 420, 4),

  { id: id(), name: 'Every Sunday 09:00', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [-160, 200],
    parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [0], triggerAtHour: 9, triggerAtMinute: 0 }] } } },
  { id: id(), name: 'Run manually (test)', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [-160, 400], parameters: {} },

  codeNode('Config', '01-config.js', [X * 0 + 80, y]),

  { id: id(), name: 'Read reviews', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position: [X * 1 + 80, y],
    parameters: {
      documentId: sheetDoc, sheetName: sheetTab,
      options: { outputFormatting: { values: { general: 'UNFORMATTED_VALUE', date: 'SERIAL_NUMBER' } } },
    } },

  codeNode('Prepare week', '02-prepare-week.js', [X * 2 + 80, y]),
  codeNode('Batch request', '02b-batch-request.js', [X * 2 + 80, y + 200]),
  openAiCall('Classify reviews (LLM)', [X * 3 + 80, y], true),
  codeNode('Parse classification', '03-parse-classification.js', [X * 4 + 80, y]),
  codeNode('Sheet columns', '04-sheet-columns.js', [X * 5 + 80, y]),

  { id: id(), name: 'Write labels to sheet', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position: [X * 6 + 80, y],
    parameters: {
      operation: 'update', documentId: sheetDoc, sheetName: sheetTab,
      columns: {
        mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['review_id'],
        schema: ['review_id', 'dish', 'shift', 'issue_type', 'severity', 'summary', 'reply_draft', 'classified_at'].map((c) => ({
          id: c, displayName: c, required: false, defaultMatch: c === 'review_id', display: true, type: 'string', canBeUsedToMatch: true,
        })),
      },
      // RAW = text from reviews is never evaluated as a formula (=, +, @)
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' },
    } },

  codeNode('Aggregate patterns', '05-aggregate-patterns.js', [X * 7 + 80, y]),
  openAiCall('Write 3 decisions (LLM)', [X * 8 + 80, y], false),
  codeNode('Build email', '06-build-email.js', [X * 9 + 80, y]),

  { id: id(), name: 'Send report (Gmail)', type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [X * 10 + 80, y],
    parameters: {
      sendTo: '={{ $json.to }}', subject: '={{ $json.subject }}', emailType: 'html', message: '={{ $json.html }}',
      options: { appendAttribution: false },
    } },

  sticky('Note · Classify', `### 1 · تصنيف كل مراجعة
- الشفت **بينحسب بالكود** من \`visit_datetime\`، مش من الموديل
- الصحن من **قائمة مغلقة** (المنيو بـ Config)
- **طلب واحد** لكل مراجعات الأسبوع + تحقق بالكود`, [X * 2 + 40, 40], 560, 200, 1),
  sticky('Note · Count', `### 2 · العدّ بالكود
صحن × شفت × مشكلة، مرتّب بالتكرار ثم مجموع الحدّة.
الموديل بياخد **الأرقام الجاهزة** بس.`, [X * 6 + 40, 40], 500, 200, 1),
  sticky('Note · Report', `### 3 · قرارات + إيميل
3 قرارات تشغيلية + جدول الأنماط + مسودات الردود.
HTML بعرض 600px و RTL للجوال.`, [X * 8 + 40, 40], 560, 200, 1),
];

const byName = Object.fromEntries(nodes.map((n) => [n.name, n]));
const chain = [
  'Config', 'Read reviews', 'Prepare week', 'Batch request', 'Classify reviews (LLM)', 'Parse classification',
  'Sheet columns', 'Write labels to sheet', 'Aggregate patterns', 'Write 3 decisions (LLM)',
  'Build email', 'Send report (Gmail)',
];
const connections = {
  'Every Sunday 09:00': { main: [[{ node: 'Config', type: 'main', index: 0 }]] },
  'Run manually (test)': { main: [[{ node: 'Config', type: 'main', index: 0 }]] },
};
for (let i = 0; i < chain.length - 1; i++) {
  connections[chain[i]] = { main: [[{ node: chain[i + 1], type: 'main', index: 0 }]] };
}
for (const [from, c] of Object.entries(connections)) {
  if (!byName[from]) throw new Error('Unknown node ' + from);
  for (const t of c.main.flat()) if (!byName[t.node]) throw new Error('Unknown target ' + t.node);
}

const workflow = {
  name: 'D1 · review-to-kitchen-report',
  nodes,
  connections,
  pinData: {},
  settings: { executionOrder: 'v1', timezone: 'Asia/Amman', saveManualExecutions: true },
  meta: { templateCredsSetupCompleted: false },
};
writeFileSync(join(here, '..', 'workflow.json'), JSON.stringify(workflow, null, 2) + '\n');

if (local) {
  const mine = JSON.parse(JSON.stringify(workflow));
  for (const n of mine.nodes) {
    if (n.name === 'Config') {
      n.parameters.jsCode = n.parameters.jsCode
        .replace("'YOUR_GOOGLE_SHEET_ID'", JSON.stringify(local.sheet_id))
        .replace("sheet_tab: 'Sheet1'", `sheet_tab: ${JSON.stringify(local.sheet_tab || 'Sheet1')}`)
        .replace("'YOUR_EMAIL@example.com'", JSON.stringify(local.report_to || 'YOUR_EMAIL@example.com'));
    }
    if (n.type === 'n8n-nodes-base.googleSheets' && local.sheets_credential) {
      n.credentials = { googleSheetsOAuth2Api: local.sheets_credential };
    }
  }
  writeFileSync(join(here, '..', 'workflow.local.json'), JSON.stringify(mine, null, 2) + '\n');
  console.log('workflow.local.json written with your own IDs (git-ignored)');
}

// ---------- Shared error-alert workflow (one for all 7 days) ----------
const errorWf = {
  name: 'D0 · error-alert',
  nodes: [
    { id: id(), name: 'On workflow error', type: 'n8n-nodes-base.errorTrigger', typeVersion: 1, position: [0, 0], parameters: {} },
    { id: id(), name: 'Email the error', type: 'n8n-nodes-base.gmail', typeVersion: 2.1, position: [260, 0],
      parameters: {
        sendTo: 'YOUR_EMAIL@example.com',
        subject: "=❌ {{ $json.workflow.name }} فشل",
        emailType: 'html',
        message: "=<div dir=\"rtl\" style=\"font-family:Tahoma,Arial\"><b>Workflow:</b> {{ $json.workflow.name }}<br><b>Node:</b> {{ $json.execution.lastNodeExecuted }}<br><b>الخطأ:</b> {{ $json.execution.error.message }}<br><a href=\"{{ $json.execution.url }}\">افتح التنفيذ</a></div>",
        options: { appendAttribution: false },
      } },
  ],
  connections: { 'On workflow error': { main: [[{ node: 'Email the error', type: 'main', index: 0 }]] } },
  pinData: {},
  settings: { executionOrder: 'v1', timezone: 'Asia/Amman' },
};
writeFileSync(join(here, '..', 'shared', 'error-alert.workflow.json'), JSON.stringify(errorWf, null, 2) + '\n');

console.log(`workflow.json: ${nodes.length} nodes (${nodes.filter((n) => n.type !== 'n8n-nodes-base.stickyNote').length} functional)`);
