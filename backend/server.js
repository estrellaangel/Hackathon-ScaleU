import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Optional: control model from .env
// OPENAI_MODEL=gpt-4o-mini  (cheap + solid)
// OPENAI_MODEL=gpt-5-mini   (stronger reasoning)
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Keep these small to control cost + avoid huge prompts
const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS || 350);
const MAX_FILE_RESULTS = Number(process.env.MAX_FILE_RESULTS || 3);
const MAX_TOOL_CALLS = Number(process.env.MAX_TOOL_CALLS || 2);

function systemPrompt(plan) {
  return `
You are AIDed, a health insurance helper for college students.
You do NOT diagnose. You explain benefits and insurance terms in plain, easiest to understand, casual language.

RESPONSE FORMAT (keep it short):
- Use at most 3 bullet points.
CITATION RULE (MUST FOLLOW):
- You MUST cite using the SOURCE_PDF from the same document you used to answer.
- Each retrieved document has a header near its top like:
  "SOURCE_PDF: <filename>"
- When you use information from a retrieved chunk, you must:
  1) Identify that chunk’s SOURCE_PDF (from its header),
  2) Use the PAGE marker that appears in the text (e.g., "===== <filename> PAGE 2 ====="),
  3) Output exactly:
     Where I found this: <SOURCE_PDF> | PAGE <number>
- If multiple documents were used, list multiple lines (one per SOURCE_PDF).
- If the retrieved chunk does NOT contain a SOURCE_PDF line, fall back to:
  Where I found this: Unknown source | PAGE <number>
If you cannot find the answer in the provided documents, say: "Not stated in the document."

When the user asks for a number (copay, deductible, coinsurance, out-of-pocket max):
- Use the retrieved sources.
- State BOTH in-network (Preferred Provider) and out-of-network when available.
- Prefer key-value blocks for tables and percentages.

Doc priority:
- Prefer the ASU short summary for: eligibility, plan dates/cost, deductible, OOP max, referral rules.
- Prefer key-value blocks for: tables (in-network vs out-of-network).
- Use the certificate text for: exclusions, limitations, definitions and details.

Selected plan: ${plan || "Unknown"}.
`.trim();
}

app.post("/chat", async (req, res) => {
  try {
    const { message, plan } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing message." });
    }
    if (!process.env.VECTOR_STORE_ID) {
      return res.status(500).json({ error: "Missing VECTOR_STORE_ID in .env" });
    }

    const response = await client.responses.create({
      model: MODEL,

      // Keep context + instructions separate from user text
      input: [
        { role: "system", content: systemPrompt(plan) },
        { role: "user", content: message }
      ],

      // Keep answers short
      max_output_tokens: MAX_OUTPUT_TOKENS,

      // Prevent runaway tool calls
      max_tool_calls: MAX_TOOL_CALLS,

      tools: [
        {
          type: "file_search",
          vector_store_ids: [process.env.VECTOR_STORE_ID],

          // Limit how many chunks come back from RAG
          max_num_results: MAX_FILE_RESULTS
        }
      ]
    });

    // Easiest safe extraction
    const answer = response.output_text || "Sorry — I couldn’t generate a response.";
    return res.json({ answer });

  } catch (e) {
    // Cleanly handle quota/rate errors
    if (e?.status === 429) {
      const code = e?.code || e?.error?.code;
      if (code === "insufficient_quota") {
        return res.status(429).json({
          error:
            "OpenAI API quota is empty for this project (insufficient_quota). " +
            "Add billing/credits in the OpenAI Platform (Billing → Overview) or raise limits, then retry."
        });
      }
      return res.status(429).json({
        error: "Rate limit hit. Slow down and try again."
      });
    }

    console.error(e);
    return res.status(500).json({ error: "Chat failed." });
  }
});

app.listen(3000, () => console.log("Backend running on http://localhost:3000"));
