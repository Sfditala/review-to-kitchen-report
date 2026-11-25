// Runs in CI. Fails if the workflow carries credentials, webhook ids, tokens or personal addresses,
// or if a connection points at a node that doesn't exist.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const problems = [];

for (const file of ["workflow.json", "shared/error-alert.workflow.json"]) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  const wf = JSON.parse(text);
  const patterns = [
    [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, "JWT-like token"],
    [/\bsk-[A-Za-z0-9_-]{16,}/, "OpenAI-style key"],
    [/\bAIza[A-Za-z0-9_-]{20,}/, "Google API key"],
    [/[\w.+-]+@(gmail|outlook|hotmail|yahoo)\.[a-z.]+/i, "personal email address"],
    [/(docs|drive)\.google\.com\/[^\s"']+/, "private Google link"],
    [/sheet_id: '(?!YOUR_GOOGLE_SHEET_ID)[^']+'/, "real Google Sheet ID"],
  ];
  for (const [pattern, label] of patterns) if (pattern.test(text)) problems.push(`${file}: ${label}`);

  const names = new Set(wf.nodes.map((n) => n.name));
  for (const node of wf.nodes) {
    if (node.webhookId) problems.push(`${file} · ${node.name}: webhookId`);
    for (const [type, cred] of Object.entries(node.credentials || {})) {
      if (cred.id) problems.push(`${file} · ${node.name}: ${type} credential id`);
    }
  }
  for (const [from, conn] of Object.entries(wf.connections)) {
    if (!names.has(from)) problems.push(`${file}: connection from missing node ${from}`);
    for (const t of conn.main.flat()) if (!names.has(t.node)) problems.push(`${file}: connection to missing node ${t.node}`);
  }
  console.log(`${file}: ${wf.nodes.length} nodes`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("All clean.");
