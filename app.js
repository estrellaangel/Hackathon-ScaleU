// ---------------------------
// DOM
// ---------------------------
const selectedPlanText = document.getElementById("selectedPlanText");
const planPill = document.getElementById("planPill");

const insuranceOptions = document.querySelectorAll(".insurance-option"); // sidebar
const planBtns = document.querySelectorAll(".plan-btn"); // optional top buttons

const planDropdown = document.getElementById("planDropdown"); // optional dropdown
const planDocsEl = document.getElementById("planDocs"); // optional docs row

const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const resetChatBtn = document.getElementById("resetChatBtn");
const chips = document.querySelectorAll(".chip");

// Submit button
const sendBtn = chatForm
  ? chatForm.querySelector('button[type="submit"], input[type="submit"]')
  : null;

// ---------------------------
// Config
// ---------------------------
// Use /api/chat in production (same origin).
// In local dev, if your frontend is served from a different port (Live Server, Vite, etc),
// call the backend explicitly on :3000.
const API_URL = "http://localhost:3000/api/chat";

// Links for “Sources”
const SHORT_LINK = "https://eoss.asu.edu/health/billing-insurance/coverage-options";
const CERT_LINK = "https://www.uhcsr.com/asu";

// Exact SOURCE_PDF filename -> link
const PDF_LINKS = {
  "asu_ship_short_plan.pdf": SHORT_LINK,
  "asu_ship_certificate.pdf": CERT_LINK,
};

// Plan docs shown in the UI after selection
const PLAN_DOCS = {
  "ASU SHIP": [
    { label: "ASU Plan Summary", url: SHORT_LINK },
    { label: "Certificate / Full Policy", url: CERT_LINK },
  ],
  // Add more plans later:
  // "Some Other Plan": [{ label: "...", url: "..." }]
};

// ---------------------------
// State
// ---------------------------
let selectedPlan = null;
let inFlight = false;
let lastSubmitAt = 0;
const COOLDOWN_MS = 1200;
let lastPlanAnnounced = "";

// ---------------------------
// Helpers
// ---------------------------
function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

function addMessage(text, who = "bot") {
  const div = document.createElement("div");
  div.className = "msg" + (who === "you" ? " you" : "");
  div.innerHTML = `
    <div>${escapeHtml(text).replace(/\n/g, "<br/>")}</div>
    <div class="meta">${who === "you" ? "You" : "Bot"}</div>
  `;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setChatEnabled(enabled) {
  chatInput.disabled = !enabled;
  if (sendBtn) sendBtn.disabled = !enabled;
  document.querySelectorAll(".chip").forEach(btn => (btn.disabled = !enabled));

  chatInput.placeholder = enabled
    ? "Type your question..."
    : "Select an insurance plan to start...";

  // NEW: show/hide overlay + lock styling
  const lockEl = document.getElementById("chatLock");
  const chatCard = document.querySelector(".chat.card");

  if (lockEl) lockEl.classList.toggle("hidden", !!enabled);
  if (chatCard) chatCard.classList.toggle("is-locked", !enabled);
}


function resolvePdfUrl(pdf, page) {
  if (!pdf) return null;

  let url = PDF_LINKS[pdf] || null;

  // fallback heuristic: if it contains "short", treat as short link; otherwise certificate link
  if (!url) {
    const lower = pdf.toLowerCase();
    url = lower.includes("short") ? SHORT_LINK : CERT_LINK;
  }

  if (url && page) return `${url}#page=${page}`;
  return url;
}

function parseCitations(text) {
  const cites = [];
  const re = /Where I found this:\s*([^\s|]+)\s*\|\s*PAGE\s*(\d+)/g;
  let m;

  while ((m = re.exec(text || "")) !== null) {
    const pdf = (m[1] || "").trim();
    const page = Number(m[2]);
    cites.push({ pdf, page, url: resolvePdfUrl(pdf, page) });
  }
  return cites;
}

// ---------------------------
// Glossary (clickable terms)
// ---------------------------
const TERM_DEFS = {
  "copay": "Copay: A fixed fee you pay for a visit or service (example: $25 per visit).",
  "co-pay": "Copay: A fixed fee you pay for a visit or service (example: $25 per visit).",
  "deductible": "Deductible: The amount you pay before the plan starts paying for many services.",
  "deductibles": "Deductible: The amount you pay before the plan starts paying for many services.",
  "coinsurance": "Coinsurance: A percent split after deductible (example: plan pays 80%, you pay 20%).",
  "out-of-pocket max": "Out-of-pocket max: The most you pay in a policy year for covered services.",
  "out of pocket max": "Out-of-pocket max: The most you pay in a policy year for covered services.",
  "out-of-pocket": "Out-of-pocket: What you pay yourself (copays + deductible + coinsurance).",
  "allowed amount": "Allowed Amount: The price the plan uses to calculate your share (not always the billed amount).",
  "in-network": "In-network: Providers with contracted rates. Usually cheaper.",
  "SHC": "Student Health Center (SHC): ASU student health center, should be your first stop for non-emergency care. Located at: 451 E University Dr, Tempe, AZ 85281.",
  "preferred provider": "Preferred Provider: Same idea as in-network—contracted providers with lower costs.",
  "out-of-network": "Out-of-network: Providers without contracted rates. Usually higher cost.",
  "premium": "Premium: What you pay to have the insurance coverage.",
  "referral": "Referral: Required approval before certain care. ASU SHIP referrals often follow Student Health Center rules.",
  "insurance provider" : "Insurance Provider: The company that offers the insurance plan (for ASU SHIP, it's UnitedHealthcare StudentResources).",
  
};

function normalizeTermKey(raw) {
  return (raw || "")
    .toLowerCase()
    .replace(/^[^\w]+|[^\w]+$/g, "")
    .trim();
}

function showDefinition(termKey) {
  const key = normalizeTermKey(termKey);
  const def = TERM_DEFS[key];
  if (!def) return;
  addMessage(def, "bot");
}

function renderBotTextWithClickableTerms(text) {
  const safe = escapeHtml(text || "");

  const terms = Object.keys(TERM_DEFS)
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (!terms.length) return safe.replace(/\n/g, "<br/>");

  const re = new RegExp(`\\b(${terms.join("|")})\\b`, "gi");

  const withLinks = safe.replace(re, (match) => {
    const key = normalizeTermKey(match);
    return `<span class="term-link" data-term="${escapeHtml(key)}" title="Click to see definition">${match}</span>`;
  });

  return withLinks.replace(/\n/g, "<br/>");
}

function renderBotTextAllowBoldAndTerms(text) {
  // Convert <b>...</b> to a temporary token so it won't get escaped
  const tokenized = String(text || "")
    .replace(/<\s*b\s*>/gi, "__B_OPEN__")
    .replace(/<\s*\/\s*b\s*>/gi, "__B_CLOSE__");

  // Escape everything (prevents arbitrary HTML injection)
  let safe = escapeHtml(tokenized);

  // Restore only the <b> tags we intentionally allow
  safe = safe
    .replace(/__B_OPEN__/g, "<b>")
    .replace(/__B_CLOSE__/g, "</b>");

  // Now apply clickable term highlighting (same logic as before)
  const terms = Object.keys(TERM_DEFS)
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (terms.length) {
    const re = new RegExp(`\\b(${terms.join("|")})\\b`, "gi");
    safe = safe.replace(re, (match) => {
      const key = normalizeTermKey(match);
      return `<span class="term-link" data-term="${escapeHtml(
        key
      )}" title="Click to see definition">${match}</span>`;
    });
  }

  // Newlines -> <br/>
  return safe.replace(/\n/g, "<br/>");
}


function addBotMessage(text, citations = []) {
  const div = document.createElement("div");
  div.className = "msg";

  // const safeText = renderBotTextWithClickableTerms(text);
  const safeText = renderBotTextAllowBoldAndTerms(text);


  const citationsHtml =
    citations && citations.length
      ? `
      <div class="citations" style="margin-top:8px; font-size:0.9em;">
        <div style="opacity:.8; margin-bottom:4px;">Sources</div>
        ${citations
          .map((c) => {
            const pdf = c.pdf || "Unknown";
            const page = Number(c.page) || "";
            const label = `${pdf}${page ? ` | PAGE ${page}` : ""}`;
            const url = c.url || null;

            return url
              ? `<div><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></div>`
              : `<div>${escapeHtml(label)}</div>`;
          })
          .join("")}
      </div>
    `
      : "";

  div.innerHTML = `
    <div>${safeText}</div>
    ${citationsHtml}
    <div class="meta">Bot</div>
  `;

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // term click handlers inside this message
  div.querySelectorAll(".term-link").forEach((el) => {
    el.addEventListener("click", () => showDefinition(el.getAttribute("data-term")));
  });
}

// ---------------------------
// Plan docs renderer
// ---------------------------
function renderPlanDocs(plan) {
  if (!planDocsEl) return;

  const docs = PLAN_DOCS[plan] || [];
  if (!plan || !docs.length) {
    planDocsEl.classList.add("hidden");
    planDocsEl.innerHTML = "";
    return;
  }

  planDocsEl.classList.remove("hidden");
  planDocsEl.innerHTML = `
    <div class="doc-row" style="display:flex; gap:10px; flex-wrap:wrap;">
      ${docs
        .map(
          (d) => `
        <a class="doc-pill" target="_blank" rel="noopener noreferrer" href="${escapeHtml(d.url)}">
          ${escapeHtml(d.label)}
        </a>
      `
        )
        .join("")}
    </div>
  `;
}

// ---------------------------
// Plan selection (single source of truth)
// ---------------------------
function setSelectedPlan(plan) {
  selectedPlan = plan || null;

  if (planPill) planPill.textContent = `Plan: ${selectedPlan || "Not selected"}`;
  if (selectedPlanText) selectedPlanText.textContent = selectedPlan || "None";

  setChatEnabled(!!selectedPlan);
  renderPlanDocs(selectedPlan);

  // sync selected class on sidebar
  insuranceOptions.forEach((opt) => {
    opt.classList.toggle("selected", opt.dataset.plan === selectedPlan);
  });

  // sync selected class on buttons
  planBtns.forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.plan === selectedPlan);
  });

  // sync dropdown
  if (planDropdown) {
    planDropdown.value = selectedPlan || "";
  }

  // announce once per plan
  if (selectedPlan && selectedPlan !== lastPlanAnnounced) {
    lastPlanAnnounced = selectedPlan;
    addMessage(`Welcome to AIDed, I'm here to help navigate your healthcare policy. You selected plan: ${selectedPlan}. Ask about costs, coverage, or what to do next.`, "bot");
  }
}

// Sidebar plan click
insuranceOptions.forEach((option) => {
  option.addEventListener("click", () => setSelectedPlan(option.dataset.plan));
});

// Top plan button click
planBtns.forEach((btn) => {
  btn.addEventListener("click", () => setSelectedPlan(btn.dataset.plan));
});

// Dropdown setup + change handler (optional)
function initDropdownIfPresent() {
  if (!planDropdown) return;

  // populate from PLAN_DOCS keys
  const plans = Object.keys(PLAN_DOCS);
  planDropdown.innerHTML = `<option value="">Choose a plan…</option>`;
  plans.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    planDropdown.appendChild(opt);
  });

  planDropdown.addEventListener("change", () => {
    setSelectedPlan(planDropdown.value);
  });
}

// Chips should not work until plan selected
chips.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!selectedPlan) {
      addMessage("Select an insurance plan first, then you can use quick prompts.", "bot");
      return;
    }
    chatInput.value = btn.dataset.prompt || "";
    chatInput.focus();
  });
});

// ---------------------------
// Reset / boot
// ---------------------------
function boot() {
  // messagesEl.innerHTML = "";
  // addMessage(

  // );
}

if (resetChatBtn) {
  resetChatBtn.addEventListener("click", boot);
}

// ---------------------------
// Chat submit handler
// ---------------------------
if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!selectedPlan) {
      addMessage("Select an insurance plan first so I can tailor answers.", "bot");
      return;
    }

    const text = (chatInput.value || "").trim();
    if (!text) return;

    const now = Date.now();
    if (now - lastSubmitAt < COOLDOWN_MS) {
      addMessage("One sec — sending too fast. Try again in a moment.", "bot");
      return;
    }
    lastSubmitAt = now;

    if (inFlight) return;
    inFlight = true;
    if (sendBtn) sendBtn.disabled = true;

    addMessage(text, "you");
    chatInput.value = "";

    try {
      const r = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, plan: selectedPlan }),
      });

      let data = {};
      const contentType = r.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await r.json();
      } else {
        data = { error: await r.text() };
      }

      if (r.status === 429) {
        addMessage(
          data.error ||
            "We hit a rate/quota limit. Check OpenAI billing/usage or slow down requests.",
          "bot"
        );
        return;
      }

      if (!r.ok) {
        addMessage(data.error || `Server error (${r.status}).`, "bot");
        return;
      }

      const answerText = data.answer || "No response.";
      const citations =
        Array.isArray(data.citations) && data.citations.length
          ? data.citations
          : parseCitations(answerText);

      addBotMessage(answerText, citations);
    } catch (err) {
      addMessage("Server error. Is the backend running?", "bot");
    } finally {
      inFlight = false;
      if (sendBtn) sendBtn.disabled = !selectedPlan;
    }
  });
}

// ---------------------------
// Init
// ---------------------------
boot();
initDropdownIfPresent();
setChatEnabled(false);
renderPlanDocs(null);
if (planPill) planPill.textContent = "Plan: Not selected";
if (selectedPlanText) selectedPlanText.textContent = "None";
