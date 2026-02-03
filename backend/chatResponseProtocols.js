// Instructions for chatbot when SPECIFIC OPTIONS are given

// VALIDATE CITATION
function showDefinition(response) {

    const terms = Object.keys(TERM_DEFS)
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const key = normalizeTermKey(termKey);
  const def = TERM_DEFS[key];
  if (!def) return;
  addMessage(def, "bot");
}


// Need to go to (Doctor, Specialist, Urgent Care)

// Need to go to (Emergency Room)

// Need to fill (Prescription)