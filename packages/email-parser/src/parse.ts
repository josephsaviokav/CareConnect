import type { ParsedIntent } from "./types.js";
import type { InboundEmailInput } from "./types.js";
import { callLLM } from "./llm-client.js";

/**
 * Regex mock fallback — deterministic, no network needed.
 * Used when OLLAMA_URL / LLM_API_KEY are unset or unreachable.
 */

function mockParse(text: string): Omit<ParsedIntent, "patient_email"> {
  const t = text.toLowerCase();

  const has = (...words: string[]) => words.some((w) => t.includes(w));

  // Spam first (avoid misclassifying promos as bookings)
  if (has("crypto", "lottery", "winner", "free money", "viagra", "inheritance", "click here to claim", "double your bitcoin")) {
    return {
      intent: "spam",
      urgency: "low",
      summary: "Unsolicited promotional message, unrelated to dental care.",
      suggested_action: "ignore and mark as spam",
    };
  }

  // Post-op complication — high urgency signals
  if (has("bleeding", "won't stop bleeding", "wont stop bleeding", "blood", "severe pain", "hurts badly", "extraction", "swelling", "infection", "emergency", "numbness", "fever after")) {
    const high = has("bleeding", "won't stop", "wont stop", "severe", "hurts badly", "emergency", "blood");
    return {
      intent: "post_op_complication",
      urgency: high ? "high" : "medium",
      summary: "Patient reports post-procedure symptoms requiring clinical triage.",
      suggested_action: high ? "alert staff immediately" : "schedule urgent follow-up within 24h",
    };
  }

  // Review response
  if (has("review", "stars", "great service", "thank you for", "5 star", "google review", "excellent experience")) {
    return {
      intent: "review_response",
      urgency: "low",
      summary: "Patient feedback / review about their visit.",
      suggested_action: "thank patient and log review",
    };
  }

  // Booking request
  if (has("book", "appointment", "schedule", "available", "checkup", "cleaning", "enquiry", "enquire", "price", "cost of", "opening hours", "new patient")) {
    const medium = has("soon", "this week", "pain", "broken", "chipped", "toothache");
    return {
      intent: "booking_request",
      urgency: medium ? "medium" : "low",
      summary: "Patient wants to book or enquire about an appointment.",
      suggested_action: "send booking link and available slots",
    };
  }

  return {
    intent: "general",
    urgency: "low",
    summary: "General enquiry, no clear booking or clinical intent.",
    suggested_action: "reply with helpful info or route to staff",
  };
}

/** Sync API required by AGENTS.md acceptance: parse(email:string): ParsedIntent */
export function parse(emailText: string, patientEmail?: string): ParsedIntent {
  const m = mockParse(emailText);
  return { ...m, patient_email: patientEmail };
}

/** Async API: tries LLM first, falls back to regex mock. */
export async function parseInboundEmail(input: InboundEmailInput): Promise<ParsedIntent> {
  const combined = `From: ${input.from}\nSubject: ${input.subject}\nBody: ${input.body}`;
  try {
    const llm = await callLLM(combined);
    if (llm) return { ...llm, patient_email: input.from };
  } catch {
    // ignore — fallback below
  }
  return parse(combined, input.from);
}

export { mockParse };
