const planSelect = document.getElementById("planSelect");
const selectedPlanText = document.getElementById("selectedPlanText");
const planPill = document.getElementById("planPill");
const confirmPlanBtn = document.getElementById("confirmPlanBtn");
const insuranceOptions = document.querySelectorAll(".insurance-option");

const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const resetChatBtn = document.getElementById("resetChatBtn");

// If your submit button exists, this will find it automatically
const sendBtn = chatForm ? chatForm.querySelector('button[type="submit"], input[type="submit"]') : null;

// ---------------------------
// Helpers
// ---------------------------
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
// Put these near the top of app.js
const SHORT_LINK = "https://eoss.asu.edu/health/billing-insurance/coverage-options"; // your short link
const OTHER_LINK = "https://YOUR-OTHER-LINK-HERE"; // your certificate/other link
const PDF_LINKS = {
  "asu_ship_short_plan.pdf": SHORT_LINK,
  "asu_ship_certificate.pdf": OTHER_LINK,
};

function resolvePdfUrl(pdf, page) {
  if (!pdf) return null;

  // 1) Exact match wins (if you keep PDF_LINKS entries)
  let url = PDF_LINKS[pdf] || null;

  // 2) If no exact match, route by keyword
  if (!url) {
    const lower = pdf.toLowerCase();
    url = lower.includes("short") ? SHORT_LINK : OTHER_LINK;
  }

  // 3) Add #page= if it’s a direct PDF link (optional)
  // If your urls are webpages, #page won't do anything but it's harmless.
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

    cites.push({
      pdf,
      page,
      url: resolvePdfUrl(pdf, page),
    });
  }

  return cites;
}

// Clickable glossary: term -> definition text
const TERM_DEFS = {
  "copay": "Copay: A fixed fee you pay for a visit or service (example: $25 per visit).",
  "co-pay": "Copay: A fixed fee you pay for a visit or service (example: $25 per visit).",
  "deductible": "Deductible: The amount you pay before the plan starts paying for many services.",
  "coinsurance": "Coinsurance: A percent split after deductible (example: plan pays 80%, you pay 20% of the Allowed Amount).",
  "out-of-pocket max": "Out-of-pocket max: The most you pay in a policy year for covered services (then the plan typically pays 100% for covered services).",
  "out of pocket max": "Out-of-pocket max: The most you pay in a policy year for covered services (then the plan typically pays 100% for covered services).",
  "out-of-pocket": "Out-of-pocket: What you pay yourself (copays + deductible + coinsurance for covered care).",
  "allowed amount": "Allowed Amount: The price the plan considers for a service. Your share is calculated from this amount (not always the billed amount).",
  "in-network": "In-network (Preferred Provider): Providers with contracted rates. Usually cheaper for you.",
  "preferred provider": "Preferred Provider: Same idea as in-network—contracted providers with lower costs.",
  "out-of-network": "Out-of-network: Providers without contracted rates. Usually higher cost and different coverage.",
  "premium": "Premium: What you pay to have the insurance coverage (monthly/semester/annual).",
  "referral": "Referral: A required approval/permission before getting certain care. For ASU SHIP, referrals often go through the Student Health Center rules."
};

// Normalize clicked term keys (lowercase, trim punctuation)
function normalizeTermKey(raw) {
  return (raw || "")
    .toLowerCase()
    .replace(/^[^\w]+|[^\w]+$/g, "")  // trim punctuation at ends
    .trim();
}

// When a user clicks a term, show its definition
function showDefinition(termKey) {
  const key = normalizeTermKey(termKey);
  const def = TERM_DEFS[key];
  if (!def) return;
  addMessage(def, "bot");
}


function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function renderBotTextWithClickableTerms(text) {
  const safe = escapeHtml(text || "");

  // Build a regex that matches any term in TERM_DEFS (longer first to avoid partial matches)
  const terms = Object.keys(TERM_DEFS)
    .sort((a, b) => b.length - a.length)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); // escape regex

  if (!terms.length) return safe.replace(/\n/g, "<br/>");

  const re = new RegExp(`\\b(${terms.join("|")})\\b`, "gi");

  // Replace matched term with a clickable span
  const withLinks = safe.replace(re, (match) => {
    const key = normalizeTermKey(match);
    return `<span class="term-link" data-term="${escapeHtml(key)}">${match}</span>`;
  });

  return withLinks.replace(/\n/g, "<br/>");
}


function boot() {
  messagesEl.innerHTML = "";
  addMessage(
    "Hey. Pick your insurance plan, then tell me what’s going on.\n" +
    "I’ll explain likely covered options, cheaper paths, and what to ask to avoid surprise bills."
  );
}

function getPlan() {
  const selected = document.querySelector(".insurance-option.selected");
  return selected ? selected.dataset.plan : "";
}

function updatePlanUI() {
  const p = getPlan();
  selectedPlanText.textContent = p || "None";
  planPill.textContent = `Plan: ${p || "Not selected"}`;
}

// ---------------------------
// Helpers
// ---------------------------
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

// NEW: Bot message renderer with clickable citations
function addBotMessageWithLinks(text, citations = []) {
  const div = document.createElement("div");
  div.className = "msg";

  const safeText = renderBotTextWithClickableTerms(text);

  // Build citations UI (each is clickable if we have a URL)
  const citationsHtml = (citations && citations.length)
    ? `
      <div class="citations" style="margin-top:8px; font-size: 0.9em;">
        <div style="opacity:.8; margin-bottom:4px;">Sources</div>
        ${citations.map(c => {
          const pdf = c.pdf || "Unknown";
          const page = Number(c.page) || "";
          const label = `${pdf}${page ? ` | PAGE ${page}` : ""}`;

          // Prefer url from backend; otherwise map it
          const url = c.url || PDF_LINKS[pdf] || null;

          // Optional: if your URL is a direct PDF link, most viewers support #page=
          const urlWithPage = (url && page) ? `${url}#page=${page}` : url;

          return urlWithPage
            ? `<div><a href="${escapeHtml(urlWithPage)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></div>`
            : `<div>${escapeHtml(label)}</div>`;
        }).join("")}
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
  
    // Attach click handlers for glossary terms inside this message
  div.querySelectorAll(".term-link").forEach(el => {
    el.addEventListener("click", () => {
      const term = el.getAttribute("data-term");
      showDefinition(term);
    });
  });
  
}

// Fallback parser: extracts citations if backend doesn't return them
function parseCitations(text) {
  const cites = [];
  const re = /Where I found this:\s*([^\s|]+)\s*\|\s*PAGE\s*(\d+)/g;
  let m;
  while ((m = re.exec(text || "")) !== null) {
    const pdf = m[1].trim();
    const page = Number(m[2]);
    cites.push({
      pdf,
      page,
      url: PDF_LINKS[pdf] || null
    });
  }
  return cites;
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}


// ---------------------------
// Insurance selection handler
// (prevents re-adding the same “selected plan” message over and over)
// ---------------------------
let lastPlanAnnounced = "";

insuranceOptions.forEach(option => {
  option.addEventListener("click", () => {
    insuranceOptions.forEach(opt => opt.classList.remove("selected"));
    option.classList.add("selected");

    const plan = option.dataset.plan;
    selectedPlanText.textContent = plan;
    planPill.textContent = `Plan: ${plan}`;

    if (plan && plan !== lastPlanAnnounced) {
      lastPlanAnnounced = plan;
      addMessage(
        `Great! I see you've selected ${plan}. How can I help you today with your health insurance needs?`,
        "bot"
      );
    }
  });
});

// Keep old select handler for backwards compatibility
if (planSelect) {
  planSelect.addEventListener("change", updatePlanUI);
}

if (confirmPlanBtn) {
  confirmPlanBtn.addEventListener("click", () => {
    updatePlanUI();
    if (!getPlan()) {
      addMessage("Pick a plan first so I can tailor coverage guidance.");
      return;
    }
    addMessage(`Locked in: ${getPlan()}. Now ask your question.`, "bot");
  });
}

document.querySelectorAll(".chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    chatInput.value = btn.dataset.prompt || "";
    chatInput.focus();
  });
});

if (resetChatBtn) {
  resetChatBtn.addEventListener("click", boot);
}

// ---------------------------
// Chat submit handler (REAL backend call)
// Adds: inFlight lock + cooldown + better error handling
// ---------------------------
let inFlight = false;
let lastSubmitAt = 0;

const API_URL = "http://localhost:3000/chat";
const COOLDOWN_MS = 1200;

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = chatInput.value.trim();
  if (!text) return;

  // Cooldown to prevent rapid spam clicks
  const now = Date.now();
  if (now - lastSubmitAt < COOLDOWN_MS) {
    addMessage("One sec — sending too fast. Try again in a moment.", "bot");
    return;
  }
  lastSubmitAt = now;

  // Prevent double-submit while request is running
  if (inFlight) return;
  inFlight = true;
  if (sendBtn) sendBtn.disabled = true;

  addMessage(text, "you");
  chatInput.value = "";

  const plan = getPlan();

  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, plan })
    });

    // Try to parse JSON safely (even if server returns non-JSON)
    let data = {};
    const contentType = r.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await r.json();
    } else {
      const t = await r.text();
      data = { error: t };
    }

    // Handle backend 429 (your server may return this if OpenAI rate/quota is hit)
    if (r.status === 429) {
      addMessage(
        data.error ||
          "We hit a rate/quota limit. If this is OpenAI quota, check billing/usage; otherwise slow down requests.",
        "bot"
      );
      return;
    }

    // Handle other server errors
    if (!r.ok) {
      addMessage(data.error || `Server error (${r.status}).`, "bot");
      return;
    }

    const answerText = data.answer || "No response.";
    const citations = (data.citations && Array.isArray(data.citations) && data.citations.length)
      ? data.citations
      : parseCitations(answerText);

    addBotMessageWithLinks(answerText, citations);

  } catch (err) {
    addMessage("Server error. Is the backend running?", "bot");
  } finally {
    inFlight = false;
    if (sendBtn) sendBtn.disabled = false;
  }
});

// Keep fakeBotResponse if you still want it as fallback, otherwise remove it.
function fakeBotResponse(userText, plan) {
  const p = plan ? `Under "${plan}",` : "If you select your plan,";
  const lower = userText.toLowerCase();

  const common = [
    `${p} I can compare telehealth vs campus clinic vs urgent care and explain what is typically covered.`,
    "A couple quick questions: how long has this been going on, how severe is it, and are there any red-flag symptoms (trouble breathing, chest pain, fainting)?",
    "Money saver tip: confirm in-network status before booking, and ask for the estimated cost and billing code if possible."
  ];

  if (lower.includes("telehealth")) {
    return `${p} telehealth is often a cheaper first step for common issues.\n\n` +
      `To avoid surprise bills: confirm the provider is in-network, ask about copay vs deductible, and whether the visit is billed as telehealth/virtual.\n\n` +
      common[1];
  }

  if (lower.includes("urgent") || lower.includes("urgent care")) {
    return `${p} urgent care can cost more than telehealth or a clinic visit, but less than an ER.\n\n` +
      `Savings: pick in-network urgent care, ask about facility fees, and consider telehealth first if appropriate.\n\n` +
      common[1];
  }

  if (lower.includes("er") || lower.includes("emergency")) {
    return `If this feels severe or sudden, please seek urgent medical care immediately.\n\n` +
      `${p} ER can be expensive. If it’s not an emergency, we can compare cheaper options.\n\n` +
      common[1];
  }

  return common.join("\n\n");
}

boot();
updatePlanUI();
