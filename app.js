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

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
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

    addMessage(data.answer || "No response.", "bot");
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
