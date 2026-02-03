const planSelect = document.getElementById("planSelect");
const selectedPlanText = document.getElementById("selectedPlanText");
const planPill = document.getElementById("planPill");
const confirmPlanBtn = document.getElementById("confirmPlanBtn");
const insuranceOptions = document.querySelectorAll(".insurance-option");

const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const resetChatBtn = document.getElementById("resetChatBtn");

// Insurance selection handler
insuranceOptions.forEach(option => {
  option.addEventListener("click", () => {
    insuranceOptions.forEach(opt => opt.classList.remove("selected"));
    option.classList.add("selected");
    const plan = option.dataset.plan;
    selectedPlanText.textContent = plan;
    planPill.textContent = `Plan: ${plan}`;
    addMessage(`Great! I see you've selected ${plan}. How can I help you today with your health insurance needs?`, "bot");
  });
});

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

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  addMessage(text, "you");
  chatInput.value = "";

  const plan = getPlan();
  const response = fakeBotResponse(text, plan);
  setTimeout(() => addMessage(response, "bot"), 350);
});

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
