import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
console.log("VECTOR_STORE_ID:", process.env.VECTOR_STORE_ID);

// Optional: control model from .env
// OPENAI_MODEL=gpt-4o-mini  (cheap + solid)
// OPENAI_MODEL=gpt-5-mini   (stronger reasoning)
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));

const PDF_LINKS = {
  "asu_ship_short_plan.pdf": "https://eoss.asu.edu/health/billing-insurance/coverage-options",
  "asu_ship_certificate.pdf": "https://www.uhcsr.com/asu",
  // Add more as needed
};

// Keep these small to control cost + avoid huge prompts
const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS || 350);
const MAX_FILE_RESULTS = Number(process.env.MAX_FILE_RESULTS || 3);
const MAX_TOOL_CALLS = Number(process.env.MAX_TOOL_CALLS || 2);

function systemPrompt(plan) {
  return `
You are AIDed, a health insurance helper for college students.
You do NOT diagnose or give medical advice. If asked, give a redirected question onto insurance, do not answer medical questions.
Explain insurance terms in plain language for first-time insurance users when asked.

Hard rules:
- First bullet point should be if Student Health Center Referral is Required for the service.
- Do not invent numbers or coverage rules. Only state plan facts found in retrieved text.
- If you cannot find it in the documents, say exactly: Not stated in the document.
- Next steps should have recommendations for less costly actions the student can take.

Answer format:
- From the plan: 1–3 bullets (facts only)
- Next steps: 1–2 bullets (process tips only; no new numbers)
- Then citations lines:
  Where I found this: <SOURCE_PDF> | PAGE <number>

Selected plan: ${plan || "ASU SHIP"}.
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
