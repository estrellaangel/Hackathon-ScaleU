// app.js
// ----------------------------------------------------
// Main UI logic: policy dropdown, chat submit, backend calls.
// Uses window.Formatting and window.ChatProtocols
// ----------------------------------------------------

// ---------------------------
// DOM
// ---------------------------
const planPill = document.getElementById("planPill");
const selectedPlanText = document.getElementById("selectedPlanText"); // optional if present
const planDropdown = document.getElementById("planDropdown");
const planDocsEl = document.getElementById("planDocs");

const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const resetChatBtn = document.getElementById("resetChatBtn");
const chips = document.querySelectorAll(".chip");

const sendBtn = chatForm
  ? chatForm.querySelector('button[type="submit"], input[type="submit"]')
  : null;

// ---------------------------
// API base
// ---------------------------
// IMPORTANT: Live Server runs on 127.0.0.1:5500.
// If you POST to "/api/chat" there, you'll hit the STATIC server => 405.
// So when hostname is localhost/127.0.0.1, use backend at :3000.
function getApiBase() {
  const host = window.location.hostname;
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0";

  // Local dev
  if (isLocal) console.log("IS LOCAL");
  if (isLocal) return "http://localhost:3000";

  console.log("NOT LOCAL");
  // Production (GitHub Pages → Render)
  return "https://hackathon-scaleu-backend.onrender.com";
}

const API_BASE = getApiBase();
const CHAT_URL = `${API_BASE}/api/chat`;
const POLICIES_URL = `${API_BASE}/api/policies`;

// ---------------------------
// State
// ---------------------------
let selectedPolicyId = null;
let selectedPolicyName = null;

let inFlight = false;
let lastSubmitAt = 0;
const COOLDOWN_MS = 800;

// If the model forgets to include citations, we do ONE automatic retry.
// Prevents infinite loops and gives you a clean signal when citations are missing.
const citationRetryByQuestion = new Map(); // questionText -> count

// ---------------------------
// UI helpers
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

function renderBotTextSafe(str = "") {
  // Escape everything first
  let s = escapeHtml(str);

  // Allow ONLY <b> and </b>
  s = s.replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>");

  return s;
}

function addMessage(text, who = "bot") {
  const div = document.createElement("div");
  div.className = "msg" + (who === "you" ? " you" : "");
  const safe = who === "bot" ? renderBotTextSafe(text) : escapeHtml(text);
  div.innerHTML = `
    <div>${safe.replace(/\n/g, "<br/>")}</div>
    <div class="meta">${who === "you" ? "You" : "Bot"}</div>
  `;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// formatting.js calls addMessage internally, so expose it globally:
window.addMessage = addMessage;

function hasValidCitations(citations) {
  const arr = Array.isArray(citations) ? citations : [];
  return arr.some((c) => !!c && c.isValid === true);
}

async function reaskForCitations(originalQuestion) {
  const count = Number(citationRetryByQuestion.get(originalQuestion) || 0);
  if (count >= 1) return null; // only retry once
  citationRetryByQuestion.set(originalQuestion, count + 1);

  // Ask the backend again with a stronger instruction and a flag.
  // Backend will tighten formatting + require citations.
  const r = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message:
      originalQuestion +
      "\n\nIMPORTANT: did not give a citation before needs to give a citation. " +
      "Include at least one 'Where I found this: <SOURCE_PDF> | PAGE <number>' line for every plan fact. " +
      "If you cannot find it, say: Not stated in the document.",
      plan: selectedPolicyName || selectedPolicyId,
      policy_id: selectedPolicyId,
      force_citations: true,
    }),
  });

  let data = {};
  const contentType = r.headers.get("content-type") || "";
  if (contentType.includes("application/json")) data = await r.json();
  else data = { error: await r.text() };

  if (!r.ok) return null;
  return data.answer || null;
}

function setChatEnabled(enabled) {
  if (chatInput) chatInput.disabled = !enabled;
  if (sendBtn) sendBtn.disabled = !enabled;

  chips.forEach((btn) => (btn.disabled = !enabled));

  if (chatInput) {
    chatInput.placeholder = enabled
      ? "Type your question..."
      : "Select a healthcare policy to start...";
  }

  const lockEl = document.getElementById("chatLock");
  const chatCard = document.querySelector(".chat.card");
  if (lockEl) lockEl.classList.toggle("hidden", !!enabled);
  if (chatCard) chatCard.classList.toggle("is-locked", !enabled);
}

function setSelectedPolicy(id, name) {
  selectedPolicyId = id || null;
  selectedPolicyName = name || null;

  if (planPill) {
    planPill.textContent = selectedPolicyName
      ? `Plan: ${selectedPolicyName}`
      : "Plan: Not selected";
  }

  if (selectedPlanText) {
    selectedPlanText.textContent = selectedPolicyName || "None";
  }

  setChatEnabled(!!selectedPolicyId);

  // Reset any active protocol flow when switching plans
  if (window.ChatProtocols?.resetFlow) window.ChatProtocols.resetFlow();
}

// ---------------------------
// Plan docs UI
// ---------------------------
function renderPlanDocs(docs) {
  if (!planDocsEl) return;

  const arr = Array.isArray(docs) ? docs : [];
  if (!arr.length) {
    planDocsEl.classList.add("hidden");
    planDocsEl.innerHTML = "";
    return;
  }

  planDocsEl.classList.remove("hidden");

  planDocsEl.innerHTML = `
    <div class="doc-row" style="display:flex; gap:10px; flex-wrap:wrap;">
      ${arr
        .map((d) => {
          const label = d.pdf_file || d.txt_file || "Document";
          const url = d.link || d.txt_url || "";
          if (!url) return `<span class="doc-pill">${escapeHtml(label)}</span>`;
          return `
            <a class="doc-pill" target="_blank" rel="noopener noreferrer" href="${escapeHtml(url)}">
              ${escapeHtml(label)}
            </a>
          `;
        })
        .join("")}
    </div>
  `;
}

async function loadDocsForPolicy(policyId) {
  if (!policyId) return renderPlanDocs([]);

  try {
    const r = await fetch(`${API_BASE}/api/policies/${encodeURIComponent(policyId)}/docs`);
    if (!r.ok) throw new Error(`docs http ${r.status}`);
    const data = await r.json();
    renderPlanDocs(data.docs || []);
  } catch (e) {
    console.error("Failed to load docs:", e);
    renderPlanDocs([]);
  }
}

// ---------------------------
// Dropdown: load policies from backend CSV
// ---------------------------
async function loadPoliciesIntoDropdown() {
  console.log("Loading policies from:", POLICIES_URL);

  const res = await fetch(POLICIES_URL, { method: "GET" });

  console.log("Policies status:", res.status);
  const raw = await res.text();
  console.log("Policies raw response:", raw.slice(0, 500));

  if (!res.ok) throw new Error(`policies http ${res.status}`);

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Policies response was not valid JSON");
  }

  // If your backend returns { policies: [...] }
  const policies = Array.isArray(data) ? data : data.policies;

  if (!Array.isArray(policies)) {
    throw new Error("Policies JSON did not contain an array");
  }

  // populate dropdown
  planDropdown.innerHTML = `<option value="">Choose a plan…</option>`;
  policies.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.policy_id ?? p.id ?? p.policyId ?? "";
    opt.textContent = p.policy_name ?? p.name ?? "(Unnamed policy)";
    planDropdown.appendChild(opt);
  });

  console.log("Loaded policies:", policies.length);
}


function initDropdownHandlers() {
  if (!planDropdown) return;

  planDropdown.addEventListener("change", async () => {
    const id = planDropdown.value || "";
    if (!id) {
      setSelectedPolicy(null, null);
      renderPlanDocs([]);
      return;
    }

    const name =
      planDropdown.options[planDropdown.selectedIndex]?.textContent || "Selected plan";

    setSelectedPolicy(id, name);
    await loadDocsForPolicy(id);

    addMessage(
      `Welcome to AIDed. You selected: ${name}. Ask about costs, coverage, or what to do next.`,
      "bot"
    );
  });
}

// ---------------------------
// Chips (quick prompts)
// ---------------------------
chips.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!selectedPolicyId) {
      addMessage("Select a healthcare policy first, then use quick prompts.", "bot");
      return;
    }
    chatInput.value = btn.dataset.prompt || "";
    chatInput.focus();
  });
});

// ---------------------------
// Reset
// ---------------------------
function boot() {
  if (messagesEl) messagesEl.innerHTML = "";
  if (window.ChatProtocols?.resetFlow) window.ChatProtocols.resetFlow();

  addMessage("Select a plan, then ask a question like: “Is urgent care covered?”", "bot");
}

if (resetChatBtn) resetChatBtn.addEventListener("click", boot);

// ---------------------------
// Chat submit handler
// ---------------------------
if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!selectedPolicyId) {
      addMessage("Select a healthcare policy first so I can tailor answers.", "bot");
      return;
    }

    const text = (chatInput.value || "").trim();
    if (!text) return;

    // cooldown
    const now = Date.now();
    if (now - lastSubmitAt < COOLDOWN_MS) return;
    lastSubmitAt = now;

    if (inFlight) return;

    // ✅ 1) Always print user message FIRST
    addMessage(text, "you");
    chatInput.value = "";

    // ✅ 2) If a protocol flow is active, let it consume input
    if (window.ChatProtocols?.handleUserInput?.(text)) {
      return;
    }

    // ✅ 3) Trigger protocol AFTER user message is in DOM
    let started = false;
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        started = !!window.ChatProtocols?.maybeStartAppointmentFlow?.(text);
        resolve();
      });
    });
    if (started) return;

    // ✅ 4) No protocol → proceed to backend
    inFlight = true;
    if (sendBtn) sendBtn.disabled = true;

    try {
      const r = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          plan: selectedPolicyName || selectedPolicyId,
          policy_id: selectedPolicyId,
        }),
      });

      let data = {};
      const contentType = r.headers.get("content-type") || "";
      if (contentType.includes("application/json")) data = await r.json();
      else data = { error: await r.text() };

      if (!r.ok) {
        addMessage(data.error || `Server error (${r.status}).`, "bot");
        return;
      }

      let answerText = data.answer || "No response.";

      let citations = window.Formatting?.parseAndValidateCitations
        ? window.Formatting.parseAndValidateCitations(answerText)
        : [];

      // --- Citation guardrail ---
      // If there are NO valid citations, automatically retry once.
      if (!hasValidCitations(citations)) {
        addMessage(
          "⚠️ I couldn’t verify that answer in your plan documents (no valid citations). Retrying with stricter citation requirements…",
          "bot"
        );

        const retried = await reaskForCitations(text);
        if (retried) {
          answerText = retried;
          citations = window.Formatting?.parseAndValidateCitations
            ? window.Formatting.parseAndValidateCitations(answerText)
            : [];
        }
      }

      // Final render
      if (window.Formatting?.addBotMessage) {
        window.Formatting.addBotMessage(answerText, citations);
      } else {
        addMessage(answerText, "bot");
      }

      // If STILL no valid citations after retry, emit a clear UI signal
      // If STILL no valid citations after retry, stop and give a safe fallback
      if (!hasValidCitations(citations)) {
        window.ChatProtocols?.resetFlow?.();

        addMessage(
          "<b>Bot is unsure.</b>\n" +
            "I couldn’t find a verifiable citation in your plan documents for that question.\n\n" +
            "Here’s a general explanation (not plan-specific):\n" +
            "- Costs usually depend on visit type (SHC vs urgent care vs ER), network status (in/out), and whether deductible applies.\n" +
            "- If you tell me the exact service + where you plan to go (SHC / urgent care / ER) I can try again and look for a cited plan rule.",
          "bot"
        );

        return;
      }


      // After AI responds, optionally offer interactive appointment help
      requestAnimationFrame(() => {
        // Offer appointment help if the USER asked a cost/money question about care
        window.ChatProtocols?.maybeOfferAppointmentCTAFromUserText?.(text);

        // Also offer if the AI answer implies appointment/referral/etc.
        window.ChatProtocols?.maybeOfferDoctorCTA?.(answerText);
      });

    } catch (err) {
      console.error(err);
      addMessage(
        `Server error. If you're using Live Server, make sure API_BASE is http://localhost:3000. Current CHAT_URL: ${CHAT_URL}`,
        "bot"
      );
    } finally {
      inFlight = false;
      if (sendBtn) sendBtn.disabled = !selectedPolicyId;
    }
  });
}


// ---------------------------
// Init
// ---------------------------
setChatEnabled(false);
renderPlanDocs([]);
loadPoliciesIntoDropdown();
initDropdownHandlers();
boot();
