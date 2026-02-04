// formatting.js
// ----------------------------------------------------
// Formatting helpers: headings, definitions, citations
// ----------------------------------------------------

// Canonical PDF keys + links
const SHORT_LINK = "https://eoss.asu.edu/health/billing-insurance/coverage-options";
const CERT_LINK  = "https://www.uhcsr.com/asu";

const SHORT_PDF = "asu_ship_short_plan.pdf";
const CERT_PDF  = "asu_ship_certificate.pdf";

const PDF_LINKS = {
  [SHORT_PDF]: SHORT_LINK,
  [CERT_PDF]: CERT_LINK,
};

// Glossary (clickable terms)
const TERM_DEFS = {
  "copay": "Copay: A fixed fee you pay for a visit or service (example: $25 per visit).",
  "co-pay": "Copay: A fixed fee you pay for a visit or service (example: $25 per visit).",
  "deductible": "Deductible: The amount you pay before the plan starts paying for many services.",
  "deductibles": "Deductible: The amount you pay before the plan starts paying for many services.",
  "coinsurance": "Coinsurance: A percent split after deductible (example: plan pays 80%, you pay 20%).",
  "out-of-pocket max": "Out-of-pocket max: The most you pay in a policy year for covered services.",
  "out of pocket max": "Out-of-pocket max: The most you pay in a policy year for covered services.",
  "out-of-pocket": "Out-of-pocket: What you pay yourself (copays + deductible + coinsurance).",
  "allowed amount": "Allowed Amount: Maximum payment an insurer will cover for a specific healthcare service, often called a negotiated rate, which is typically less than the provider's full billed charge. For in-network providers, they agree to accept this amount as full payment (minus your copay/deductible), while out-of-network providers can 'balance bill' you for the difference above the allowed amount, which you'd have to pay.",
  "in-network": "In-network: Providers with contracted rates. Usually cheaper.",
  "preferred provider": "Preferred Provider: Same idea as in-network—contracted providers with lower costs.",
  "out-of-network": "Out-of-network: Providers without contracted rates. Usually higher cost.",
  "premium": "Premium: What you pay to have the insurance coverage.",
  "referral": "Referral: Required approval before certain care. ASU SHIP referrals often follow Student Health Center rules.",
  "shc": "Student Health Center (SHC): ASU student health center, should be your first stop for non-emergency care. Located at: 451 E University Dr, Tempe, AZ 85281.",
  "insurance provider": "Insurance Provider: The company that offers the insurance plan (for ASU SHIP, it's UnitedHealthcare StudentResources).",
};

// ---- basic HTML escaping ----
function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

function renderBotHtmlSafe(str = "") {
  const input = String(str || "");

  // Replace allowed tags with placeholders so we can escape everything else safely.
  const tokens = [];
  let s = input.replace(/<\s*(\/?)\s*(b|a)\b([^>]*)>/gi, (full, slash, tag, attrs) => {
    tag = tag.toLowerCase();
    const closing = !!slash;

    if (tag === "b") {
      // allow <b> and </b>
      const token = closing ? "</b>" : "<b>";
      tokens.push(token);
      return `@@TOKEN_${tokens.length - 1}@@`;
    }

    if (tag === "a") {
      if (closing) {
        tokens.push("</a>");
        return `@@TOKEN_${tokens.length - 1}@@`;
      }

      // opening <a ...> — only allow href with http/https
      const hrefMatch = attrs.match(/href\s*=\s*["']([^"']+)["']/i);
      const hrefRaw = hrefMatch ? hrefMatch[1].trim() : "";

      const isSafe =
        /^https?:\/\//i.test(hrefRaw) &&
        !hrefRaw.toLowerCase().startsWith("javascript:") &&
        !hrefRaw.toLowerCase().startsWith("data:");

      if (!isSafe) {
        // If href is missing/unsafe, do NOT allow tag; render as plain text.
        return escapeHtml(full);
      }

      // Safe link: add rel/target for safety + UX
      const token = `<a href="${escapeHtml(hrefRaw)}" target="_blank" rel="noopener noreferrer">`;
      tokens.push(token);
      return `@@TOKEN_${tokens.length - 1}@@`;
    }

    return escapeHtml(full);
  });

  // Escape everything else
  s = escapeHtml(s);

  // Restore tokens
  s = s.replace(/@@TOKEN_(\d+)@@/g, (_, i) => tokens[Number(i)] || "");

  return s;
}

function renderBotTextSafe(str = "") {
  // Escape everything first (prevents HTML injection)
  let s = escapeHtml(str);

  // Allow only <b> and </b> by un-escaping them
  s = s.replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>");

  return s;
}


function normalizeTermKey(raw) {
  return (raw || "")
    .toLowerCase()
    .replace(/^[^\w]+|[^\w]+$/g, "")
    .trim();
}

// ---- SOURCE → canonical PDF mapping ----
// Rule: if .txt contains "short" => SHORT_PDF, else CERT_PDF
function mapSourceToCanonicalPdf(sourceName) {
  const s = String(sourceName || "").trim().toLowerCase();

  if (s === SHORT_PDF.toLowerCase()) return SHORT_PDF;
  if (s === CERT_PDF.toLowerCase()) return CERT_PDF;

  if (s.endsWith(".txt")) {
    return s.includes("short") ? SHORT_PDF : CERT_PDF;
  }

  if (s.includes("short")) return SHORT_PDF;
  return CERT_PDF;
}

function resolveSourceUrl(sourceName, page) {
  if (!sourceName) return null;

  const canonicalPdf = mapSourceToCanonicalPdf(sourceName);
  const baseUrl = PDF_LINKS[canonicalPdf] || null;
  if (!baseUrl) return null;

  const pageNum = Number(page);
  if (Number.isFinite(pageNum) && pageNum > 0) return `${baseUrl}#page=${pageNum}`;
  return baseUrl;
}

// ---- Parse + validate citations ----
// Reads: Where I found this: <file> | PAGE <n>
function parseAndValidateCitations(answerText) {
  // Accepts BOTH:
    // Where I found this: <asu_ship_short_plan.pdf> | PAGE 2
    // Where I found this: asu_ship_short_plan.pdf | PAGE 2
    const re = /Where I found this:\s*<?([^\s|>]+)>?\s*\|\s*PAGE\s*(\d+)/gi;


  const citations = [];
  let m;

  while ((m = re.exec(answerText || "")) !== null) {
    const source = (m[1] || "").trim(); // .pdf or .txt
    const pageNum = Number(m[2]);

    const pageOk = Number.isFinite(pageNum) && pageNum > 0;
    const pdf = mapSourceToCanonicalPdf(source);
    const baseExists = !!PDF_LINKS[pdf];

    const url = baseExists ? resolveSourceUrl(source, pageNum) : null;
    const isValid = baseExists && pageOk;

    citations.push({ source, pdf, page: pageNum, isValid, url });
  }

  return citations;
}

// ---- Render bot text with safe <b> headings + clickable terms ----
function renderBotTextAllowBoldAndTerms(text) {
  const tokenized = String(text || "")
    .replace(/<\s*b\s*>/gi, "__B_OPEN__")
    .replace(/<\s*\/\s*b\s*>/gi, "__B_CLOSE__");

  let safe = escapeHtml(tokenized)
    .replace(/__B_OPEN__/g, "<b>")
    .replace(/__B_CLOSE__/g, "</b>");

  const terms = Object.keys(TERM_DEFS)
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (terms.length) {
    const re = new RegExp(`\\b(${terms.join("|")})\\b`, "gi");
    safe = safe.replace(re, (match) => {
      const key = normalizeTermKey(match);
      return `<span class="term-link" data-term="${escapeHtml(key)}" title="Click to see definition">${match}</span>`;
    });
  }

  return safe.replace(/\n/g, "<br/>");
}

// ---- UI: addBotMessage ----
// Requires globals: messagesEl and addMessage/showDefinition provided by main.js
function addBotMessage(text, citations = []) {
  const div = document.createElement("div");
  div.className = "msg";

    // 1) Remove the raw citation lines from the visible answer text
    const cleanedText = String(text || "")
    // remove lines like: Where I found this: <file> | PAGE 2
    .replace(/^\s*Where I found this:\s*<?([^\s|>]+)>?\s*\|\s*PAGE\s*\d+\s*$/gim, "")
    // remove a trailing "Sources" header if the model printed one
    .replace(/^\s*Sources\s*$/gim, "")
    // clean up extra blank lines created by removals
    .replace(/\n{3,}/g, "\n\n")
    .trim();

    const safeText = renderBotHtmlSafe(cleanedText);


  const citationsHtml =
    citations && citations.length
      ? `
      <div class="citations" style="margin-top:8px; font-size:0.9em;">
        <div style="opacity:.8; margin-bottom:4px;">Sources</div>
        ${citations.map((c) => {
          const pdf = c.pdf || "Unknown";
          const page = Number(c.page) || "";
          const label = `${pdf}${page ? ` | PAGE ${page}` : ""}`;

          return c.isValid && c.url
            ? `<div><a href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></div>`
            : `<div>${escapeHtml(label)}</div>`;
        }).join("")}
      </div>`
      : "";

  div.innerHTML = `
    <div>${safeText}</div>
    ${citationsHtml}
    <div class="meta">Bot</div>
  `;

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  div.querySelectorAll(".term-link").forEach((el) => {
    el.addEventListener("click", () => {
      const t = el.getAttribute("data-term");
      const def = TERM_DEFS[normalizeTermKey(t)];
      if (def) addMessage(def, "bot");
    });
  });
}

function addChoiceMessage(promptText, choices = [], onPick) {
  // choices: [{ label: "Yes", value: "yes" }, ...]
  const div = document.createElement("div");
  div.className = "msg";

  // Render prompt with your safe formatter if available (prevents raw <b> showing)
  const promptHtml = window.Formatting?.renderBotTextAllowBoldAndTerms
    ? window.Formatting.renderBotTextAllowBoldAndTerms(promptText)
    : escapeHtml(promptText).replace(/\n/g, "<br/>");

  const btns = choices
    .map(
      (c, i) => `
      <button
        class="choice-btn"
        data-idx="${i}"
        type="button"
        title="Click to choose"
        aria-label="${escapeHtml(c.label)}"
      >
        ${escapeHtml(c.label)}
      </button>`
    )
    .join("");

  div.innerHTML = `
    <div>${promptHtml}</div>
    <div class="choices" style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
      ${btns}
    </div>
    <div class="meta">Bot</div>
  `;

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // attach handlers
  div.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-idx"));
      const picked = choices[idx];
      if (!picked) return;

      // lock buttons after pick (prevents double clicks)
      div.querySelectorAll(".choice-btn").forEach((b) => (b.disabled = true));

      // show user's selection as a message
      addMessage(picked.label, "you");

      if (typeof onPick === "function") onPick(picked.value, picked);
    });
  });
}



// Export to global (no bundler needed)
window.Formatting = {
  parseAndValidateCitations,
  addBotMessage,
  TERM_DEFS,
  renderBotHtmlSafe,              // ✅ add
  renderBotTextAllowBoldAndTerms, // ✅ add (optional but useful)
};
