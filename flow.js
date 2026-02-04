// flows.js
// ----------------------------------------------------
// Preemptive flows: detect intent and provide scripted help
// ----------------------------------------------------

function normalize(text) {
  return String(text || "").toLowerCase();
}

function detectIntent(text) {
  const t = normalize(text);

  const appointmentTriggers = [
    "appointment",
    "book",
    "schedule",
    "doctor",
    "dr.",
    "specialist",
    "urgent care",
    "clinic",
    "primary care",
    "referral",
    "telehealth",
  ];

  if (appointmentTriggers.some(k => t.includes(k))) return "appointment";
  return null;
}

function appointmentFlow(planName) {
  // You can customize planName behavior later.
  // For now, this is a solid general ASU-friendly script.
  return [
`<b>Appointment help:</b> Want me to walk you through using your insurance to make an appointment?`,

`<b>Step 1 — Choose where to go:</b>
- If it’s not an emergency, start with the Student Health Center (SHC) if your plan uses SHC referrals.
- If you need same-day care: urgent care or a walk-in clinic.
- Emergency symptoms: go to the ER or call 911.`,

`<b>Step 2 — Check if you need a referral:</b>
- Some plans require SHC referral before specialists.
- If you’re unsure: tell me the type of visit (primary care, specialist, urgent care, telehealth) and I’ll help you check.`,

`<b>Step 3 — Find a provider:</b>
- For ASU SHIP / UHC StudentResources, use the provider search tool to find “Preferred Providers” (in-network).
- If you tell me “specialist type + city”, I can suggest what to search for.`,

`<b>Step 4 — Call and book (script you can copy):</b>
“Hi, I’m calling to schedule an appointment. I have student health insurance. Are you in-network / a preferred provider? What’s the earliest available appointment? What is the expected copay or patient responsibility?”`,

`<b>Step 5 — Before your appointment:</b>
- Bring your insurance card (digital is usually okay) and a photo ID.
- Don’t have your card? Log in to your insurance portal and download a digital card to your phone.`,

`<b>Step 6 — Prep what to say:</b>
- Your top 2–3 symptoms
- When it started + what makes it better/worse
- Any meds you’ve tried
- What you’re hoping to get out of the visit (tests, refill, referral, etc.)`
  ];
}

// Main entry
function maybeHandleFlow(text, selectedPlan) {
  const intent = detectIntent(text);
  if (!intent) return { handled: false };

  if (intent === "appointment") {
    return {
      handled: true,
      messages: appointmentFlow(selectedPlan),
    };
  }

  return { handled: false };
}



// Export
window.Flows = { maybeHandleFlow };