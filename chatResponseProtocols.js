// chatResponseProtocols.js
// ----------------------------------------------------
// Interactive protocols (button-based flows).
// Exposes window.ChatProtocols.
//
// Design goals:
// - Deterministic, task-oriented flows (no model calls needed).
// - One place for triggers -> task start.
// - UI order: bot text first, then buttons.
// ----------------------------------------------------

const flowState = {
  activeTask: null, // e.g. "appointment"
  step: null,
  data: {},
};

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
  let s = escapeHtml(str);
  s = s.replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>");
  return s;
}

function formatSectionsForDisplay(raw = "") {
  let s = String(raw || "");

  // Ensure section headers start on a new line
  const headers = [
    "From the plan:",
    "Next steps:",
    "Find Urgent Care Centers:",
    "Appointment/Walk-Ins:",
    "Call script:",
    "Prep checklist:",
  ];

  headers.forEach((h) => {
    // put header on its own line, with a blank line before it (if not at start)
    const re = new RegExp(`\\s*${h.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*`, "gi");
    s = s.replace(re, (m) => `\n\n${h}\n`);
  });

  // If the model gives dash-bullets in the same line, force each "- " onto its own line
  // e.g. "From the plan: - A - B" -> "From the plan:\n- A\n- B"
  s = s.replace(/\s-\s+/g, "\n- ");

  // Clean up: remove 3+ newlines
  s = s.replace(/\n{3,}/g, "\n\n").trim();

  return s;
}


// Always add a plain bot message first
function addBotText(text) {
  const messagesEl = document.getElementById("messages");
  if (!messagesEl) return;

  const div = document.createElement("div");
  div.className = "msg";

  const formatted = formatSectionsForDisplay(text);

  const html = window.Formatting?.renderBotHtmlSafe
    ? window.Formatting.renderBotHtmlSafe(formatted).replace(/\n/g, "<br/>")
    : renderBotTextSafe(formatted).replace(/\n/g, "<br/>");

  div.innerHTML = `
    <div>${html}</div>
    <div class="meta">Bot</div>
  `;

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}


// Add a "bot message" that contains ONLY buttons
function addChoiceButtons(choices) {
  const messagesEl = document.getElementById("messages");
  if (!messagesEl) return;

  const div = document.createElement("div");
  div.className = "msg";

  const buttonsHtml = (choices || [])
    .map((c, idx) => {
      const label = c.label || `Option ${idx + 1}`;
      return `<button class="chip protocol-btn" type="button" data-choice="${idx}">${escapeHtml(label)}</button>`;
    })
    .join("");

  div.innerHTML = `
    <div class="quick" style="display:flex; gap:10px; flex-wrap:wrap;">
      ${buttonsHtml}
    </div>
    <div class="meta">Bot</div>
  `;

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  div.querySelectorAll(".protocol-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      // disable all buttons once picked
      div.querySelectorAll(".protocol-btn").forEach((b) => (b.disabled = true));

      const idx = Number(btn.getAttribute("data-choice"));
      const choice = choices[idx];
      if (!choice) return;

      // show user's click as their own message
      if (window.addMessage) window.addMessage(choice.label, "you");

      choice.onClick?.();
    });
  });
}

/**
 * One bot bubble that can include:
 *  - text (supports ONLY <b>...</b>)
 *  - quick reply buttons (chips)
 *
 * Usage:
 * addBotBubble({
 *   text: "Hello <b>world</b>\nPick one:",
 *   choices: [
 *     { label: "Option A", value: "a", onClick: () => ... },
 *     { label: "Option B", value: "b", onClick: () => ... },
 *   ]
 * })
 */
function addBotBubble({ text = "", choices = [] } = {}) {
  // If your main renderer exists, still use DOM here because we need text+buttons together.
  const messagesEl = document.getElementById("messages");
  if (!messagesEl) return;

  const div = document.createElement("div");
  div.className = "msg";

  const hasText = String(text || "").trim().length > 0;
  const hasChoices = Array.isArray(choices) && choices.length > 0;

  const textHtml = hasText
    ? `<div class="msg-text">${renderBotTextSafe(String(text || "")).replace(/\n/g, "<br/>")}</div>`
    : "";

  const buttonsHtml = hasChoices
    ? `
      <div class="quick" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:${hasText ? "10px" : "0"};">
        ${choices
          .map((c, idx) => {
            const label = c.label || `Option ${idx + 1}`;
            return `<button class="chip protocol-btn" type="button" data-choice="${idx}">
                      ${escapeHtml(label)}
                    </button>`;
          })
          .join("")}
      </div>
    `
    : "";

  div.innerHTML = `
    ${textHtml}
    ${buttonsHtml}
    <div class="meta">Bot</div>
  `;

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Attach handlers if choices exist
  if (hasChoices) {
    div.querySelectorAll(".protocol-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        // disable all buttons once picked
        div.querySelectorAll(".protocol-btn").forEach((b) => (b.disabled = true));

        const idx = Number(btn.getAttribute("data-choice"));
        const choice = choices[idx];
        if (!choice) return;

        // show user's click as their own message
        if (window.addMessage) window.addMessage(choice.label, "you");

        // optional direct click handler
        choice.onClick?.(choice);

        // or if you prefer a "return value" style, you can also use choice.value
      });
    });
  }
}


function addChoiceCardMessage(promptText, choices = [], onPick) {
  const messagesEl = document.getElementById("messages");
  if (!messagesEl) return;

  const div = document.createElement("div");
  div.className = "msg";

  // ✅ render prompt with safe HTML (so <b> and <a href=""> work)
  const promptHtml = window.Formatting?.renderBotHtmlSafe
    ? window.Formatting.renderBotHtmlSafe(String(promptText || "")).replace(/\n/g, "<br/>")
    : renderBotTextSafe(String(promptText || "")).replace(/\n/g, "<br/>"); // fallback: only <b>

  // ✅ cards may contain HTML too (your labelHtml uses <b>)
  const cards = (choices || [])
    .map(
      (c, i) => `
        <button class="choice-card" data-idx="${i}" type="button">
          <div class="choice-card-body">
            ${
              c.labelHtml
                ? (window.Formatting?.renderBotHtmlSafe
                    ? window.Formatting.renderBotHtmlSafe(String(c.labelHtml))
                    : renderBotTextSafe(String(c.labelHtml)))
                : escapeHtml(c.label || "")
            }
          </div>
        </button>
      `
    )
    .join("");

  div.innerHTML = `
    <div class="msg-text">${promptHtml}</div>
    <div class="choice-cards">${cards}</div>
    <div class="meta">Bot</div>
  `;

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  div.querySelectorAll(".choice-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const picked = choices[idx];
      if (!picked) return;

      div.querySelectorAll(".choice-card").forEach((b) => (b.disabled = true));
      btn.classList.add("picked");

      onPick?.(picked);
    });
  });
}



function askWithButtons(promptText, choices) {
  addBotText(promptText);
  addChoiceButtons(choices);
}

function resetFlow() {
  flowState.activeTask = null;
  flowState.step = null;
  flowState.data = {};
}

function normalize(text) {
  return String(text || "").toLowerCase();
}

// ----------------------------------------------------
// Task: Appointment
// (1) where to get appointment
// (2) call script
// (3) prepare checklist
// ----------------------------------------------------

function startAppointmentTask() {
  flowState.activeTask = "appointment";
  flowState.step = "where";

  addChoiceCardMessage(
    "<b>Where do you want to go for care?</b>",
    [
      {
        value: "emergency",
        labelHtml: `⚠️ <b>Emergency room</b>: Go to the ER for life- or limb-threatening, severe, or unknown-severity conditions (e.g., chest pain, stroke signs, major trauma, heavy bleeding, difficulty breathing).`,
      },
      {
        value: "urgent",
        labelHtml: `🏥 <b>Urgent care</b>: Faster than ER for non-life-threatening issues that still need same-day attention (e.g., minor fractures, infections, fever, sprains).`,
      },
      {
        value: "shc",
        labelHtml: `🩺 <b>Student Health Center</b>: Best for routine and ongoing issues, follow-ups, and longer-term care coordination.`,
      },
    ],
    (picked) => {
      if (!picked || !picked.value) return;
      appointmentWhere(picked.value);
    }
  );
}


function appointmentWhere(choice) {
  flowState.data.where = choice;
  flowState.step = "call";

  if (choice === "emergency") {
    addBotText(
      "⚠️ Emergency route:\n" +
        "- If you think this is life-threatening, call 911 now.\n" +
        "- If you can get there safely, go to the nearest ER.\n" +
        "- When you're safe, I can help you with insurance/billing questions.\n" + 
        "\n" +
        "<b>From the plan:</b>\n" +
        "- The Copay for emergency room visits is $200 for both in-network and out-of-network services.\n" +
        "- This Copay is waived if the patient is admitted to the hospital following the emergency room visit.\n" +
        "- The coverage pays 100% of the Allowed Amount after the Copay is met.\n"
    );
    // Still offer prep checklist in case this becomes non-emergency follow-up
    return appointmentPrep();
  }

  if (choice === "urgent") {

    addChoiceCardMessage(
      "🏥 <b>Urgent care</b>:\n" +
          "If you feel this is a non-life-threatening issue that still needs same-day attention, urgent care is a good option.\n" +
          "\n" +
          "<b>From the plan:</b>\n" +
          "- <b>In-network urgent care:</b> $25 copay (deductible does not apply).\n" +
          "- <b>Important:</b> This $25 copay only applies if you were referred by SHC <b>or</b> SHC was closed.\n" +
          "- If SHC is open and you go to urgent care anyway (without a referral), you may be treated as <b>out-of-network</b>.\n" +
          "- <b>Out-of-network:</b> You pay the deductible first, then the plan pays 50% of the allowed amount (you pay the other 50%).\n" +
          "\n" +
          "<b>Find Urgent Care Centers:</b>\n" +
          "1. You can find in network urgent care centers by seraching 'Urgent Care' on <a href=\"http://www.uhcsr.com/lookupredirect.aspx?delsys=52\">United Healthcare Medical Care Finder</a>.\n" +
          "2. You can google 'Urgent Care near me' to find local options, then call and ask if they take your insurance. If you decide on a Urgent Care that is not in-network, you will pay 50% of the allowed amount after the deductible.\n" +
          "\n" +
          "<b>Appointment/Walk-Ins:</b>\n" +
          "- Most urgent care centers accept walk-ins, but it's a good idea to call ahead and confirm their hours and insurance acceptance.\n" +
          "\n" + 
          "Here are some more steps I could help you with:",
      [
        {
          value: "shc",
          labelHtml: `Help me get treated at the Student Health Center (SHC).`,
        },
        {
          value: "script",
          labelHtml: `Provide a call script to help book appointment.`,
        },
        {
          value: "appointment",
          labelHtml: `Help me prepare for my appointment.`,
        }
      ],
      (picked) => {
        if (!picked || !picked.value) return;
        if(picked.value === "shc") return appointmentWhere("shc");
        if(picked.value === "insurance") return insuranceCardHelp();
        if(picked.value === "script") return appointmentCallScript();
        else return appointmentPrep(picked.value);
      }
    );
  }

  if (choice === "shc") {

    addChoiceCardMessage(
      "🩺 <b>Student Health Center</b>:\n" +
        "Visting the student health center is the best solution for routine and ongoing issues, follow-ups, and longer-term care coordination.\n" +
        "\n" +
        "<b>From the plan:</b>\n" +
        "- The Student Health Center visit costs include a $15 copay for general medicine, counseling, and psychiatric services.\n"+ 
        "- Lab and X-ray services incur a $10 copay, while specialist and chiropractic care costs $25 per visit.\n"+
        "- The deductible is waived and benefits are paid at 100% for certain services like travel immunizations, well-woman care, preventive care, and initial counseling assessments\n" +
        "\n" +
        "<b>Appointment Types:</b>\n" +
        "- The SHC offers both scheduled appointments and walk-in services, depending on availability and the nature of your health concern. You can book appointments online or by phone.\n" +
        "Online booking: <a href=\"https://asuportal.pointnclick.com/Mvc/Portal/Login\">ASU Health Portal</a>\n" +
        "Phone booking: 480-965-3349\n" +
        "\n" +
        "Here are some more steps I could help you with:\n",
      [
        {
          value: "script",
          labelHtml: `Provide a call script to help book appointment.`,
        },
        {
          value: "walkin",
          labelHtml: `Provide a checklist of what to prepare for a walk-in visit.`,
        },
      ],
      (picked) => {
        if (!picked || !picked.value) return;
        if(picked.value === "script") return appointmentCallScript();
        else return appointmentPrep(picked.value);
      }
    );
  }

}

function appointmentCallScript() {

  addChoiceCardMessage(
      "<b>Call Script</b>:\n" +
        "Tips for call:\n" +
        "- Make sure to have insurance card handy.\n" +
        "\n" +
        "Script:\n" +
        "- Hello my name is [Your Name], I would like to make an appointment for [Reason For Appointment].\n" +
        "- What is your soonest appointment availablity?\n" +
        "- (Optional) Can you confirm if you are a preferred provider for my United Healthcare plan, I have my insurance card ready?\n" +
        "\n" + 
        "Here are some more steps I could help you with:"
        ,
      [
        {
          value: "insurance",
          labelHtml: `Help me find my insurance card before the call.`,
        },
        {
          value: "walkin",
          labelHtml: `Provide a checklist of what to prepare for a walk-in visit.`,
        },
      ],
      (picked) => {
        if (!picked || !picked.value) return;
        if(picked.value === "insurance") return insuranceCardHelp();
        if(picked.value === "shc") return appointmentWhere("shc");
        else return appointmentPrep(picked.value);
      }
    );

}

function appointmentPrep(where) {

  addChoiceCardMessage(
    "<b>What to prepare before you go:</b>\n" +
      "- Insurance card (digital is usually OK) + photo ID\n" +
      "- A short symptom timeline (when it started, what makes it better/worse)\n" +
      "- Current meds + allergies (even over-the-counter)\n" +
      "- 1–2 questions you want answered\n" +
      "- Arrive 10–15 minutes early for check-in paperwork" +
      "\n\n" +
      "Here are some more steps I could help you with:",
    [
      {
        value: "insurance",
        labelHtml: `Help me find my insurance card before the call.`,
      }
    ],
    (picked) => {
      if (!picked || !picked.value) return;
      if(picked.value === "insurance") return insuranceCardHelp();
      else return appointmentPrep(picked.value);
    }
  );

}

function insuranceCardHelp() {
  addBotText(
    "<b>Finding your insurance card:</b>\n" +
      "- You can download your ID card via My Account at www.uhcsr.com/asu or uhcsr.com/myaccount. \n" +
      "- An option is available to request delivery of a permanent ID card through the My Account portal.\n" +
      "- You can download the UHCSR Mobile App where you can save the card.\n\n" +
      "If you need help with anything else, just ask!"
  );
  // doctorTalkingPoints();
}

function doctorTalkingPoints() {
  askWithButtons("Want a quick ‘what to say to the doctor’ script?", [
    {
      label: "Yes, give me a script",
      onClick: () => {
        addBotText(
          "Doctor script:\n" +
            "- “My main problem is ____.”\n" +
            "- “It started on ____.”\n" +
            "- “The worst symptom is ____.”\n" +
            "- “I’ve tried ____ (meds/home care).”\n" +
            "- “I’m hoping to get ____ (test/refill/referral).”"
        );
        wrapUp();
      },
    },
    { label: "No thanks", onClick: () => wrapUp() },
  ]);
}

function wrapUp() {
  addBotText(
    "If you get a prescription after your visit, tell me the medication name and I can help you think through cost-saving steps (generic options, in-network pharmacies, and what to ask)."
  );
  resetFlow();
}

// ----------------------------------------------------
// Triggers
// ----------------------------------------------------

function looksLikeExplicitBookingIntent(userText) {
  const t = normalize(userText);

  // must include an action word that implies "walk me through booking"
  const bookingVerbs = [
    "book", "schedule", "make an appointment", "set up an appointment",
    "call to book", "help me book", "help me schedule"
  ];

  return bookingVerbs.some((k) => t.includes(k));
}

function looksLikeCostOrMoneyQuestion(userText) {
  const t = normalize(userText);

  const moneyWords = [
    "cost", "price", "how much", "copay", "co-pay", "deductible",
    "coinsurance", "bill", "charge", "pay", "money", "expensive"
  ];

  const careContext = [
    "doctor", "appointment", "urgent care", "er", "emergency room",
    "clinic", "specialist", "telehealth", "primary care"
  ];

  return moneyWords.some((w) => t.includes(w)) && careContext.some((c) => t.includes(c));
}


function maybeStartAppointmentFlow(userText) {
  if (flowState.activeTask) return false;

  if (!looksLikeExplicitBookingIntent(userText)) return false;

  startAppointmentTask();
  return true;
}


function maybeOfferDoctorCTA(answerText) {
  if (flowState.activeTask) return;

  const t = normalize(answerText);
  const hints = ["appointment", "referral", "urgent care", "doctor", "clinic", "telehealth"];
  if (!hints.some((h) => t.includes(h))) return;

  // askWithButtons("Want me to walk you through booking care step-by-step?", [
  //   { label: "Yes", onClick: () => startAppointmentTask() },
  //   { label: "No", onClick: () => addBotText("Okay — ask me about coverage/costs anytime.") },
  // ]);
}

function handleUserInput(_text) {
  // Current protocols are button-driven; typed input shouldn't hijack chat.
  return false;
}

function maybeOfferAppointmentCTAFromUserText(userText) {
  if (flowState.activeTask) return false;

  // If they asked about money/cost for a visit, offer booking help (but don't hijack the answer)
  if (!looksLikeCostOrMoneyQuestion(userText)) return false;

  askWithButtons("Want help booking the appointment after we talk costs?", [
    { label: "Yes, walk me through booking", onClick: () => startAppointmentTask() },
    { label: "No, just explain costs", onClick: () => addBotText("Okay — ask me anything about coverage/costs.") },
  ]);

  return true;
}


window.ChatProtocols = {
  resetFlow,
  handleUserInput,
  maybeStartAppointmentFlow,
  maybeOfferDoctorCTA,
  maybeOfferAppointmentCTAFromUserText, // optional public start (useful for future chips)
  startAppointmentTask,
};