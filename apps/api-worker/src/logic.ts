/**
 * Pure helpers for the Cloudflare worker (mirrors apps/api-server logic).
 * Self-contained: Workers builds cannot import node-only modules (pg),
 * so the small pure functions live here. Canonical sources noted inline.
 */

export interface TemplatePatient {
  first_name: string;
  last_visit_date?: string | null;
  source?: string;
}

// Canonical: apps/api-server/src/lib/campaigns.ts
export function renderTemplate(
  body: string,
  patient: TemplatePatient,
  extra: { last_procedure?: string } = {}
): string {
  const lastVisit = patient.last_visit_date || "recently";
  let months = "6+";
  if (patient.last_visit_date) {
    const diff = Date.now() - new Date(patient.last_visit_date).getTime();
    months = String(Math.max(0, Math.round(diff / (30 * 24 * 3600 * 1000))));
  }
  return body
    .replaceAll("{{first_name}}", patient.first_name)
    .replaceAll("{{last_procedure}}", extra.last_procedure || "checkup")
    .replaceAll("{{last_visit_date}}", lastVisit)
    .replaceAll("{{months_since_visit}}", months)
    .replaceAll("{{source}}", patient.source || "website")
    .replaceAll("{{interest}}", extra.last_procedure || "a checkup");
}

export type Intent = "booking_request" | "post_op_complication" | "review_response" | "general" | "spam";
export type Urgency = "low" | "medium" | "high";

export interface ParsedIntent {
  intent: Intent;
  urgency: Urgency;
  patient_email?: string;
  summary: string;
  suggested_action: string;
}

// Canonical: packages/email-parser/src/parse.ts (regex fallback)
export function mockParse(text: string): Omit<ParsedIntent, "patient_email"> {
  const t = text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));
  if (has("crypto", "lottery", "winner", "free money", "viagra", "inheritance", "click here to claim", "double your bitcoin")) {
    return { intent: "spam", urgency: "low", summary: "Unsolicited promotional message, unrelated to dental care.", suggested_action: "ignore and mark as spam" };
  }
  if (has("bleeding", "won't stop bleeding", "wont stop bleeding", "blood", "severe pain", "hurts badly", "extraction", "swelling", "infection", "emergency", "numbness", "fever after")) {
    const high = has("bleeding", "won't stop", "wont stop", "severe", "hurts badly", "emergency", "blood");
    return {
      intent: "post_op_complication",
      urgency: high ? "high" : "medium",
      summary: "Patient reports post-procedure symptoms requiring clinical triage.",
      suggested_action: high ? "alert staff immediately" : "schedule urgent follow-up within 24h",
    };
  }
  if (has("review", "stars", "great service", "thank you for", "5 star", "google review", "excellent experience")) {
    return { intent: "review_response", urgency: "low", summary: "Patient feedback / review about their visit.", suggested_action: "thank patient and log review" };
  }
  if (has("book", "appointment", "schedule", "available", "checkup", "cleaning", "enquiry", "enquire", "price", "cost of", "opening hours", "new patient")) {
    const medium = has("soon", "this week", "pain", "broken", "chipped", "toothache");
    return { intent: "booking_request", urgency: medium ? "medium" : "low", summary: "Patient wants to book or enquire about an appointment.", suggested_action: "send booking link and available slots" };
  }
  return { intent: "general", urgency: "low", summary: "General enquiry, no clear booking or clinical intent.", suggested_action: "reply with helpful info or route to staff" };
}

const SYSTEM_PROMPT = `You are a dental practice triage assistant. Classify the inbound email into exactly one intent: booking_request, post_op_complication, review_response, general, spam. Also assign urgency low/medium/high. Return ONLY valid JSON: {"intent":..., "urgency":..., "summary":..., "suggested_action":...}.`;

function tryParseIntent(raw: string): ParsedIntent | null {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    const validIntents = ["booking_request", "post_op_complication", "review_response", "general", "spam"];
    const validUrgency = ["low", "medium", "high"];
    if (!validIntents.includes(obj.intent) || !validUrgency.includes(obj.urgency)) return null;
    return {
      intent: obj.intent,
      urgency: obj.urgency,
      summary: String(obj.summary || "").slice(0, 300),
      suggested_action: String(obj.suggested_action || "").slice(0, 300),
    };
  } catch {
    return null;
  }
}

// Canonical: packages/email-parser/src/llm-client.ts (Ollama → API key → null)
export async function callLLM(emailText: string, env: { OLLAMA_URL?: string; LLM_API_KEY?: string; LLM_BASE_URL?: string; LLM_MODEL?: string; OLLAMA_MODEL?: string }): Promise<ParsedIntent | null> {
  if (env.OLLAMA_URL) {
    try {
      const res = await fetch(`${env.OLLAMA_URL.replace(/\/$/, "")}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: env.OLLAMA_MODEL || "phi3", prompt: `${SYSTEM_PROMPT}\n\nEmail:\n${emailText}`, stream: false, format: "json" }),
      });
      if (res.ok) {
        const data = (await res.json()) as { response?: string };
        const parsed = tryParseIntent(data.response || "");
        if (parsed) return parsed;
      }
    } catch { /* fallback */ }
  }
  if (env.LLM_API_KEY) {
    try {
      const base = env.LLM_BASE_URL || "https://api.openai.com/v1";
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.LLM_API_KEY}` },
        body: JSON.stringify({
          model: env.LLM_MODEL || "gpt-4o-mini",
          messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: emailText }],
          response_format: { type: "json_object" },
          max_tokens: 300,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const parsed = tryParseIntent(data.choices?.[0]?.message?.content || "");
        if (parsed) return parsed;
      }
    } catch { /* fallback */ }
  }
  return null;
}

export async function parseInboundEmail(
  input: { from: string; subject: string; body: string },
  env: { OLLAMA_URL?: string; LLM_API_KEY?: string; LLM_BASE_URL?: string; LLM_MODEL?: string; OLLAMA_MODEL?: string }
): Promise<ParsedIntent & { llm_used: boolean }> {
  const combined = `From: ${input.from}\nSubject: ${input.subject}\nBody: ${input.body}`;
  try {
    const llm = await callLLM(combined, env);
    if (llm) return { ...llm, patient_email: input.from, llm_used: true };
  } catch { /* ignore */ }
  return { ...mockParse(combined), patient_email: input.from, llm_used: false };
}
