import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---------------------------
// App
// ---------------------------
const app = express();

// ---------------------------
// Middleware
// ---------------------------
app.use(express.json());

// Debug: log method + path (helps diagnose 405 immediately)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// CORS: allow browser requests + preflight
app.use(
  cors({
    origin: true, // reflect request origin
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/", (req, res) => {
  res.status(200).send("OK - backend is running");
});

app.get("/api/policies", (req, res) => {
  // return policies
});

app.get("/api/policies/:id/docs", (req, res) => {
  // return docs
});


// Always answer preflight
app.options(/.*/, cors());
app.options(["/api/chat", "/chat"], (_req, res) => res.sendStatus(204));

// ---------------------------
// OpenAI client + config
// ---------------------------
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS || 350);
const MAX_FILE_RESULTS = Number(process.env.MAX_FILE_RESULTS || 3);
const MAX_TOOL_CALLS = Number(process.env.MAX_TOOL_CALLS || 2);

// ---------------------------
// Prompt
// ---------------------------
function systemPrompt(plan, forceCitations = false) {
  return `
You are AIDed, a health insurance helper for college students.
You do NOT diagnose or give medical advice. If asked, redirect back to insurance questions and resources.

Explain insurance terms in plain language for first-time insurance users when asked.

Hard rules:
- First bullet point should be if Student Health Center Referral is Required for the service.
- Do not invent numbers or coverage rules. Only state plan facts found in retrieved text.
- If you cannot find it in the documents, say exactly: Not stated in the document.
- Next steps should have recommendations for less costly actions the student can take.

Answer format:
<b>From the plan:</b> 1–3 bullets (facts only)
<b>Next steps:</b> 1–2 bullets (process tips only; no new numbers)
- Then citations lines:
  Where I found this: SOURCE_PDF | PAGE number

Citation rules:
- For every plan fact you state, you must support it with a citation line.
- If the answer is not in the documents, say exactly: Not stated in the document.
- If force_citations is true, you must double-check you included at least one valid citation line when any plan fact exists.

Selected plan: ${plan || "ASU SHIP"}.
force_citations: ${forceCitations ? "true" : "false"}
`.trim();
}

// ---------------------------
// Health check (useful for debugging)
// ---------------------------
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// ---------------------------
// Chat endpoint
// Supports BOTH /chat and /api/chat
// ---------------------------
app.post(["/chat", "/api/chat"], async (req, res) => {
  try {
    const { message, plan, force_citations } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing message." });
    }

    if (!process.env.VECTOR_STORE_ID) {
      return res.status(500).json({ error: "Missing VECTOR_STORE_ID in .env" });
    }

    const response = await client.responses.create({
      model: MODEL,
      input: [
        { role: "system", content: systemPrompt(plan, !!force_citations) },
        { role: "user", content: message },
      ],
      max_output_tokens: MAX_OUTPUT_TOKENS,

      // If your SDK doesn't support this param, delete the next line.
      max_tool_calls: MAX_TOOL_CALLS,

      tools: [
        {
          type: "file_search",
          vector_store_ids: [process.env.VECTOR_STORE_ID],
          max_num_results: MAX_FILE_RESULTS,
        },
      ],
    });

    const answer = response.output_text || "Sorry — I couldn’t generate a response.";
    return res.json({ answer });
  } catch (e) {
    if (e?.status === 429) {
      const code = e?.code || e?.error?.code;
      if (code === "insufficient_quota") {
        return res.status(429).json({
          error:
            "OpenAI API quota is empty for this project (insufficient_quota). " +
            "Add billing/credits in the OpenAI Platform (Billing → Overview) or raise limits, then retry.",
        });
      }
      return res.status(429).json({ error: "Rate limit hit. Slow down and try again." });
    }

    console.error("Chat error:", e);
    return res.status(500).json({ error: "Chat failed." });
  }
});

// ---------------------------
// Path helpers (ESM)
// ---------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, "..");
const POLICIES_DIR = path.join(ROOT_DIR, "policies");

const ALL_POLICIES_CSV = path.join(POLICIES_DIR, "all_policies.csv");
const POLICY_DOCS_CSV = path.join(POLICIES_DIR, "policy_documents.csv");

// Optional: serve txt outputs
app.use("/policies", express.static(POLICIES_DIR));

// ---------------------------
// Minimal CSV parser
// ---------------------------
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

function readCsvObjects(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = (cols[idx] ?? "").trim()));
    return obj;
  });
}

// ---------------------------
// Data helpers
// ---------------------------
function getPolicies() {
  const rows = readCsvObjects(ALL_POLICIES_CSV);
  return rows
    .map((r) => ({
      policy_id: String(r.policy_id ?? r["policy_id"] ?? "").trim(),
      policy_name: String(r.policy_name ?? r["policy_name"] ?? "").trim(),
    }))
    .filter((p) => p.policy_id && p.policy_name);
}

function getPolicyDocs(policyId) {
  const rows = readCsvObjects(POLICY_DOCS_CSV);

  return rows
    .filter((r) => String(r.policy_id).trim() === String(policyId).trim())
    .map((r) => {
      const txtFile = (r.txt_file || "").trim();
      const pdfFile = (r.pdf_file || "").trim();
      const link = (r.link || "").trim();

      const baseTxt = txtFile ? path.basename(txtFile) : "";
      const basePdf = pdfFile ? path.basename(pdfFile) : "";

      const txtUrl = baseTxt ? `/policies/${baseTxt}` : null;

      return {
        txt_file: baseTxt || null,
        txt_url: txtUrl,
        pdf_file: basePdf || null,
        link: link || null,
      };
    });
}

// ---------------------------
// API endpoints
// ---------------------------
app.get("/api/policies", (_req, res) => {
  try {
    return res.json({ policies: getPolicies() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load policies." });
  }
});

app.get("/api/policies/:id/docs", (req, res) => {
  try {
    const id = req.params.id;
    return res.json({ docs: getPolicyDocs(id) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load policy docs." });
  }
});

// ---------------------------
// 404 handler (helps identify wrong server/path)
// ---------------------------
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

// ---------------------------
// Listen (ONLY ONCE)
// ---------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
